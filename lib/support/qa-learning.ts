import type { SupabaseClient } from "@supabase/supabase-js";

type QaDraftResult =
  | { created: true; qaId: number; question: string; answer: string }
  | { created: false; reason: string; qaId?: number };

type TicketRow = {
  id: number;
  session_id: string;
  initial_user_message: string;
  user_locale: string | null;
  tour_slug: string | null;
};

type SupportMessageRow = {
  id: number;
  message_index: number;
  sender: "user" | "admin" | "system";
  content: string;
  promoted_to_qa?: boolean;
  promoted_qa_id?: number | null;
};

type ChatMessageRow = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  user_locale: string | null;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const BOOKING_RE = /\b(?:booking|reservation|ticket|order)\s*#?\s*[A-Z0-9-]{4,}\b/gi;

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function sanitizeQaText(value: string): string {
  return compact(value)
    .replace(EMAIL_RE, "[email]")
    .replace(PHONE_RE, "[phone]")
    .replace(BOOKING_RE, "[booking]");
}

export function inferQaLocale(text: string, fallback = "ko"): string {
  if (/\p{Script=Hangul}/u.test(text)) return "ko";
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return "ja";
  if (/\p{Script=Han}/u.test(text)) return "zh";
  if (/[¿¡ñáéíóúü]/i.test(text)) return "es";
  if (/[A-Za-z]/.test(text)) return "en";
  return fallback;
}

export function inferQaCategory(question: string, answer = ""): string {
  const text = `${question} ${answer}`.toLowerCase();
  const checks: Array<[string, RegExp]> = [
    ["refund", /refund|cancel|cancellation|환불|취소|취소수수료|返金|取消/],
    ["pickup", /pickup|pick[-\s]?up|meeting|hotel|lobby|port|cruise|픽업|미팅|호텔|로비|항구|크루즈/],
    ["pricing", /price|cost|fee|charge|payment|discount|요금|가격|비용|수수료|결제|할인/],
    ["accessibility", /wheelchair|stroller|mobility|senior|accessib|휠체어|유모차|거동|고령|접근성/],
    ["pet", /pet|dog|cat|animal|반려동물|강아지|고양이|동물/],
    ["children", /child|children|kid|infant|seat|car seat|아동|아이|유아|좌석|카시트/],
    ["itinerary", /itinerary|schedule|route|stop|course|일정|코스|경로|방문|스팟/],
    ["weather", /weather|rain|snow|typhoon|날씨|비|눈|태풍/],
  ];
  return checks.find(([, re]) => re.test(text))?.[0] ?? "general";
}

export function buildQaTags(input: { category: string; tourSlug?: string | null; source?: string }): string[] {
  return Array.from(
    new Set(
      [
        input.source ?? "support_ticket",
        "auto_draft",
        input.category,
        input.tourSlug ? `tour:${input.tourSlug}` : null,
      ].filter((tag): tag is string => Boolean(tag)),
    ),
  );
}

async function latestChatUserQuestion(sb: SupabaseClient, sessionId: string): Promise<ChatMessageRow | null> {
  const { data } = await sb
    .from("chat_messages")
    .select("id, role, content, user_locale")
    .eq("session_id", sessionId)
    .eq("role", "user")
    .order("message_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ChatMessageRow | null) ?? null;
}

export async function createQaDraftFromSupportReply(
  sb: SupabaseClient,
  input: {
    ticketId: number;
    supportMessageId: number;
    adminAnswer: string;
  },
): Promise<QaDraftResult> {
  const answer = sanitizeQaText(input.adminAnswer);
  if (answer.length < 8) return { created: false, reason: "answer_too_short" };

  const { data: supportMessage } = await sb
    .from("support_messages")
    .select("id, message_index, sender, content, promoted_to_qa, promoted_qa_id")
    .eq("id", input.supportMessageId)
    .maybeSingle();
  const current = supportMessage as SupportMessageRow | null;
  if (current?.promoted_to_qa && current.promoted_qa_id) {
    return { created: false, reason: "already_promoted", qaId: current.promoted_qa_id };
  }
  if (current && current.sender !== "admin") return { created: false, reason: "not_admin_message" };

  const { data: ticketData } = await sb
    .from("support_tickets")
    .select("id, session_id, initial_user_message, user_locale, tour_slug")
    .eq("id", input.ticketId)
    .maybeSingle();
  const ticket = ticketData as TicketRow | null;
  if (!ticket) return { created: false, reason: "ticket_not_found" };

  let question = "";
  if (current) {
    const { data: thread } = await sb
      .from("support_messages")
      .select("id, message_index, sender, content")
      .eq("ticket_id", input.ticketId)
      .lt("message_index", current.message_index)
      .order("message_index", { ascending: false })
      .limit(8);
    const priorUser = ((thread as SupportMessageRow[] | null) ?? []).find((m) => m.sender === "user");
    question = priorUser?.content ?? "";
  }

  if (!question) {
    const chatQuestion = await latestChatUserQuestion(sb, ticket.session_id);
    question = chatQuestion?.content ?? ticket.initial_user_message;
  }

  question = sanitizeQaText(question);
  if (question.length < 4) return { created: false, reason: "question_too_short" };

  const { data: duplicate } = await sb
    .from("qa_pairs")
    .select("id")
    .eq("source", "support_ticket")
    .eq("source_ticket_id", input.ticketId)
    .eq("question", question)
    .eq("answer", answer)
    .maybeSingle();
  if (duplicate?.id) {
    await sb
      .from("support_messages")
      .update({ promoted_to_qa: true, promoted_qa_id: duplicate.id })
      .eq("id", input.supportMessageId);
    return { created: false, reason: "duplicate", qaId: duplicate.id as number };
  }

  const category = inferQaCategory(question, answer);
  const { data: qa, error } = await sb
    .from("qa_pairs")
    .insert({
      source: "support_ticket",
      source_ticket_id: input.ticketId,
      question,
      answer,
      question_locale: inferQaLocale(question, ticket.user_locale ?? "ko"),
      answer_locale: inferQaLocale(answer, ticket.user_locale ?? "ko"),
      category,
      tour_slug: ticket.tour_slug,
      tags: buildQaTags({ category, tourSlug: ticket.tour_slug }),
      review_status: "draft",
      is_active: false,
    })
    .select("id")
    .single();
  if (error || !qa) return { created: false, reason: error?.message ?? "insert_failed" };

  await sb
    .from("support_messages")
    .update({ promoted_to_qa: true, promoted_qa_id: qa.id })
    .eq("id", input.supportMessageId);

  return { created: true, qaId: qa.id as number, question, answer };
}
