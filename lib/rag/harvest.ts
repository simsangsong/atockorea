/**
 * Q&A harvest core (W5.1) — shared by the CLI script
 * (`scripts/harvest-qa-candidates.ts`) and the weekly Vercel cron
 * (`/api/cron/rag-harvest`), so the learning loop actually runs (C-5: the
 * harvest → review → embed cycle never turned because harvesting was a
 * manual CLI only).
 *
 * Scans confident, non-escalated assistant answers + their preceding user
 * question, asks Gemini whether the pair is a generalizable FAQ (not personal
 * / booking-specific), sanitizes PII, dedupes, and inserts qa_pairs drafts
 * (source='chat_message', review_status='draft'). Admins review them in
 * /admin/qa-review; approval embeds them into the RAG index.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sanitizeQaText,
  inferQaLocale,
  inferQaCategory,
  buildQaTags,
} from "@/lib/support/qa-learning";
import { assistantReplyShouldOfferHandoff } from "@/lib/support/handoff";

type Msg = {
  id: number;
  session_id: string;
  message_index: number;
  role: "user" | "assistant" | "system";
  content: string;
  user_locale: string | null;
  tour_slug: string | null;
  escalated: boolean | null;
};

type Candidate = {
  assistantId: number;
  question: string;
  answer: string;
  locale: string;
  tourSlug: string | null;
};

export type HarvestSummary = {
  messages: number;
  candidates: number;
  created: number;
  rejected: number;
  dupes: number;
  dryRun: boolean;
};

async function loadMessages(sb: SupabaseClient): Promise<Msg[]> {
  const all: Msg[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("chat_messages")
      .select("id, session_id, message_index, role, content, user_locale, tour_slug, escalated")
      .order("session_id", { ascending: true })
      .order("message_index", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`load chat_messages: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as Msg[]));
    if (data.length < PAGE) break;
  }
  return all;
}

/** Pair each assistant answer with the immediately preceding user question. */
function buildPairs(messages: Msg[]): Candidate[] {
  const pairs: Candidate[] = [];
  for (let i = 1; i < messages.length; i += 1) {
    const a = messages[i];
    const u = messages[i - 1];
    if (a.role !== "assistant" || u.role !== "user") continue;
    if (a.session_id !== u.session_id) continue;
    if (a.escalated) continue;
    const answer = a.content?.trim() ?? "";
    const question = u.content?.trim() ?? "";
    if (answer.length < 40 || question.length < 6) continue;
    if (answer.startsWith("[error:")) continue; // W0.2 failure rows are not knowledge
    if (assistantReplyShouldOfferHandoff(answer)) continue; // low-confidence
    pairs.push({
      assistantId: a.id,
      question,
      answer,
      locale: a.user_locale ?? u.user_locale ?? "ko",
      tourSlug: a.tour_slug ?? u.tour_slug ?? null,
    });
  }
  return pairs;
}

async function alreadyHarvested(sb: SupabaseClient): Promise<Set<number>> {
  const ids = new Set<number>();
  const { data } = await sb
    .from("qa_pairs")
    .select("source_message_id")
    .eq("source", "chat_message")
    .not("source_message_id", "is", null);
  for (const row of (data as Array<{ source_message_id: number }> | null) ?? []) {
    ids.add(row.source_message_id);
  }
  return ids;
}

function normAnswer(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 400);
}

/** Quality signal: answers users marked 👎 (skip) and 👍 (prioritize). */
async function loadFeedback(sb: SupabaseClient): Promise<{ neg: Set<string>; pos: Set<string> }> {
  const neg = new Set<string>();
  const pos = new Set<string>();
  const { data } = await sb.from("chat_feedback").select("rating, answer");
  for (const row of (data as Array<{ rating: number; answer: string | null }> | null) ?? []) {
    if (!row.answer) continue;
    (row.rating < 0 ? neg : pos).add(normAnswer(row.answer));
  }
  return { neg, pos };
}

type Judgement = { reusable: boolean; question?: string; answer?: string; category?: string };

async function judge(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  c: Candidate,
): Promise<Judgement> {
  const prompt = [
    "You curate an FAQ knowledge base for a Korea tour booking site (AtoC Korea).",
    "Decide whether the following chat turn is a GENERALIZABLE, reusable FAQ that would help future visitors.",
    "Reject if it is personal/booking-specific (a named booking, a specific date/person, payment status), low quality, an error, off-topic, or just chit-chat.",
    "If reusable, rewrite the question to a clean, general form and tighten the answer (keep facts; drop greetings, names, and any personal data).",
    'Respond ONLY as JSON: {"reusable": boolean, "question": string, "answer": string, "category": string}.',
    "category is one of: refund, pickup, pricing, accessibility, pet, children, itinerary, weather, general.",
    "",
    `USER QUESTION: ${c.question}`,
    `ASSISTANT ANSWER: ${c.answer}`,
  ].join("\n");
  const res = await model.generateContent(prompt);
  const text = res.response.text()?.trim() ?? "";
  try {
    return JSON.parse(text) as Judgement;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as Judgement) : { reusable: false };
  }
}

export async function harvestQaCandidates(
  sb: SupabaseClient,
  opts: { limit?: number; dryRun?: boolean; log?: (line: string) => void } = {},
): Promise<HarvestSummary> {
  const log = opts.log ?? (() => {});
  const limit = opts.limit ?? 40;
  const dryRun = opts.dryRun === true;

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) throw new Error("GEMINI_API_KEY required");
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_TOUR_PRODUCT_ASSISTANT_MODEL?.trim() || "gemini-2.5-flash",
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  });

  log("Loading chat messages…");
  const messages = await loadMessages(sb);
  const harvested = await alreadyHarvested(sb);
  const { neg, pos } = await loadFeedback(sb);
  const pairs = buildPairs(messages)
    .filter((p) => !harvested.has(p.assistantId))
    .filter((p) => !neg.has(normAnswer(p.answer))) // skip answers users flagged 👎
    // Prioritize 👍-rated answers for review.
    .sort((a, b) => Number(pos.has(normAnswer(b.answer))) - Number(pos.has(normAnswer(a.answer))));
  log(
    `  ${messages.length} messages → ${pairs.length} new candidate pairs (👍${pos.size}/👎${neg.size} feedback, cap ${limit})`,
  );

  const candidates = pairs.slice(0, limit);
  let created = 0;
  let rejected = 0;
  let dupes = 0;

  for (const c of candidates) {
    let verdict: Judgement;
    try {
      verdict = await judge(model, c);
    } catch (e) {
      log(`  judge error msg#${c.assistantId}: ${(e as Error).message}`);
      continue;
    }
    if (!verdict.reusable) {
      rejected += 1;
      continue;
    }
    const question = sanitizeQaText(verdict.question || c.question);
    const answer = sanitizeQaText(verdict.answer || c.answer);
    if (question.length < 6 || answer.length < 12) {
      rejected += 1;
      continue;
    }
    const category = verdict.category || inferQaCategory(question, answer);

    // Dedup: same question text already in qa_pairs.
    const { data: dup } = await sb.from("qa_pairs").select("id").eq("question", question).maybeSingle();
    if (dup?.id) {
      dupes += 1;
      continue;
    }

    if (dryRun) {
      log(`  [draft] (${category}) ${question.slice(0, 70)}`);
      created += 1;
      continue;
    }

    const { error } = await sb.from("qa_pairs").insert({
      source: "chat_message",
      source_message_id: c.assistantId,
      question,
      answer,
      question_locale: inferQaLocale(question, c.locale),
      answer_locale: inferQaLocale(answer, c.locale),
      category,
      tour_slug: c.tourSlug,
      tags: buildQaTags({ category, tourSlug: c.tourSlug, source: "chat_message" }),
      review_status: "draft",
      is_active: false,
    });
    if (error) {
      log(`  insert error msg#${c.assistantId}: ${error.message}`);
      continue;
    }
    created += 1;
    log(`  + draft (${category}) ${question.slice(0, 70)}`);
  }

  log(`Done. drafts ${dryRun ? "(dry) " : ""}created=${created} rejected=${rejected} dupes=${dupes}`);
  return { messages: messages.length, candidates: pairs.length, created, rejected, dupes, dryRun };
}
