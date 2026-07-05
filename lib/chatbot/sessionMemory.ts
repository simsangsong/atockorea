/**
 * Track 3.2 — rolling cross-session memory.
 *
 * Keeps ONE short, PII-excluded recollection of a traveler's durable
 * preferences (regions of interest, party size, dates/season discussed,
 * language, budget sensitivity, accessibility, tour type) so the assistant
 * feels continuous across visits.
 *
 * Identity:
 *   - logged in  -> keyed by user_id (persistent)
 *   - anonymous  -> keyed by session_token (the chat cookie)
 *
 * Privacy (decision D2): the summary NEVER contains names, emails, phone
 * numbers, booking references, addresses, or card data. The model is told to
 * exclude them and we scrub defensively on top. It is a soft recollection, not
 * a verified fact — the prompt labels it as such.
 *
 * All access is server-side via the service-role client (RLS denies the rest).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GoogleGenerativeAI } from "@google/generative-ai";

export type MemoryKey = { userId: string } | { sessionToken: string };

const MAX_SUMMARY_CHARS = 320;

/** Intents whose turns can carry durable traveler preferences worth remembering.
 *  Generic policy/legal/company answers don't reveal who the traveler is, so we
 *  skip them — cheaper and keeps the memory focused. */
const MEMORY_RELEVANT_INTENTS = new Set([
  "quote_request",
  "tour_recommendation",
  "tour_catalog",
  "booking_specific",
  "poi",
]);

export function isMemoryRelevantIntent(intent: string): boolean {
  return MEMORY_RELEVANT_INTENTS.has(intent);
}

/** Defensive PII scrub — runs on top of the model's own exclusion instruction.
 *  NOTE: travel dates/seasons are intentionally KEPT — they are the memory's
 *  whole point ("regions, party size, dates"). Only identity-shaped tokens go. */
export function scrubPii(text: string): string {
  return text
    .replace(/\S+@\S+\.\S+/g, "")                         // emails
    .replace(/\bA2C[-\s]?[A-Z0-9]{2,}\b/gi, "")           // booking refs, incl. partial (C-33)
    .replace(/[+]?\d[\d\s().\-]{7,}\d/g, "")              // phone-like runs
    .replace(/\b\d{6,}\b/g, "")                            // long digit runs (card/IDs)
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Collapse to a single clean line and cap length (defence against a chatty model). */
function normalizeSummary(text: string): string {
  const oneLine = scrubPii(text).replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
  if (oneLine.length <= MAX_SUMMARY_CHARS) return oneLine;
  return oneLine.slice(0, MAX_SUMMARY_CHARS).replace(/\s+\S*$/, "").trim();
}

function eqKey(sb: SupabaseClient, key: MemoryKey) {
  // For anonymous rows we also require user_id IS NULL so a session_token can't
  // collide with a (future) user-owned row.
  const base = sb.from("chat_memory").select("summary, turn_count");
  return "userId" in key
    ? base.eq("user_id", key.userId)
    : base.is("user_id", null).eq("session_token", key.sessionToken);
}

export async function fetchSessionMemory(
  sb: SupabaseClient,
  key: MemoryKey,
): Promise<{ summary: string; turnCount: number } | null> {
  try {
    const { data } = await eqKey(sb, key).maybeSingle();
    const row = data as { summary?: string; turn_count?: number } | null;
    if (!row?.summary) return null;
    const summary = scrubPii(row.summary);
    return summary ? { summary, turnCount: row.turn_count ?? 0 } : null;
  } catch {
    return null;
  }
}

/** Labelled, neutralized context block for the system prompt. */
export function buildMemoryContext(summary: string): string {
  const clean = scrubPii(summary).replace(/[\r\n]+/g, " ").trim();
  if (!clean) return "";
  return `\n--- TRAVELER MEMORY (soft recollection of preferences from this traveler's past chats; NOT a verified booking/policy fact) ---\n${clean}`;
}

const SUMMARIZER_SYSTEM = [
  "You maintain a tiny rolling memory of a traveler for a Korea private-tour assistant.",
  "Given the PRIOR MEMORY (may be empty) and the LATEST EXCHANGE, output an UPDATED memory.",
  "Capture only DURABLE, useful preferences and intent: regions/places of interest, party size, travel dates or season, preferred language, budget sensitivity, accessibility or mobility needs, pace, tour type (private/cruise/group), and clear likes/dislikes.",
  "STRICTLY EXCLUDE personally identifying info: no names, emails, phone numbers, booking references, addresses, or card/payment data.",
  "Merge — keep still-relevant prior facts, add new ones, drop anything contradicted by the latest exchange.",
  "Max 2 short sentences, under 300 characters, plain text, no preamble.",
  "If there is nothing durable to remember, output the prior memory unchanged (or empty if it was empty).",
].join(" ");

/**
 * Regenerate + upsert the rolling memory for this identity. Best-effort: any
 * failure is swallowed (memory is an enhancement, never blocks a reply).
 */
export async function updateSessionMemory(
  sb: SupabaseClient,
  opts: {
    key: MemoryKey;
    priorSummary: string | null;
    turnCount: number;
    userMessage: string;
    assistantReply: string;
    genAI: GoogleGenerativeAI;
    modelName: string;
  },
): Promise<void> {
  try {
    const model = opts.genAI.getGenerativeModel({
      model: opts.modelName,
      systemInstruction: SUMMARIZER_SYSTEM,
    });
    const prompt = [
      `PRIOR MEMORY: ${opts.priorSummary?.trim() || "(none)"}`,
      "",
      "LATEST EXCHANGE:",
      `User: ${opts.userMessage.slice(0, 1500)}`,
      `Assistant: ${opts.assistantReply.slice(0, 1500)}`,
      "",
      "UPDATED MEMORY:",
    ].join("\n");

    const res = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 160, temperature: 0.2 },
    });
    const next = normalizeSummary(res.response.text() ?? "");
    // Don't store an empty memory, and don't churn a write if nothing changed.
    if (!next || next === scrubPii(opts.priorSummary ?? "")) return;

    const now = new Date().toISOString();
    const row =
      "userId" in opts.key
        ? { user_id: opts.key.userId, session_token: null as string | null }
        : { user_id: null as string | null, session_token: opts.key.sessionToken };

    // Upsert by identity. Conflict targets are the partial unique indexes; we do
    // a manual update-or-insert to stay portable across them.
    const existing = await eqKey(sb, opts.key).maybeSingle();
    if (existing.data) {
      await sb
        .from("chat_memory")
        .update({ summary: next, turn_count: opts.turnCount + 1, updated_at: now })
        .match(row.user_id ? { user_id: row.user_id } : { session_token: row.session_token, user_id: null });
    } else {
      await sb.from("chat_memory").insert({ ...row, summary: next, turn_count: 1 });
    }
  } catch (err) {
    console.error("[sessionMemory] update failed:", (err as Error).message);
  }
}
