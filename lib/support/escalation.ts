/**
 * Escalation detection — decide whether a chatbot turn should hand off to a
 * human admin and create a `support_tickets` row.
 *
 * Triggers (any one is sufficient):
 *   1. **escalation_keywords** match — admin-curated trigger words (refund,
 *      legal, medical, complaint, explicit human handoff request).
 *   2. **explicit human handoff** — natural-language request like "관리자",
 *      "상담원", "speak to a human", regardless of keyword table state.
 *   3. **assistant low-confidence reply** — model output literally says
 *      "I don't know" / "확실하지 않습니다" / "정확한 답변을 드리기 어렵습니다"
 *      / safety refusal patterns.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const HARD_HANDOFF_PATTERNS_KO = [
  /관리자\s*(?:연결|호출|불러|이야기)/,
  /상담원\s*(?:연결|호출|불러|이야기)/,
  /담당자\s*(?:연결|호출|이야기|에게)/,
  /사람.*?(?:이야기|연결|문의)/,
  /직접\s*(?:연락|문의|통화)/,
];

const HARD_HANDOFF_PATTERNS_EN = [
  /\b(?:speak|talk|connect|chat)\s+(?:to|with)\s+(?:a\s+)?(?:human|agent|person|representative|manager)\b/i,
  /\bhuman\s+(?:agent|support|help)\b/i,
  /\bcustomer\s+service\s+(?:rep|representative|agent)\b/i,
];

const LOW_CONFIDENCE_PATTERNS_KO = [
  /확실하지\s*않(?:습니다|아요)/,
  /정확한\s*답변을?\s*드리기\s*어렵/,
  /잘\s*모르겠(?:습니다|어요)/,
  /답변\s*드릴\s*수\s*없/,
  /제\s*권한\s*밖/,
];

const LOW_CONFIDENCE_PATTERNS_EN = [
  /\bI(?:'m|\s*am)?\s*not\s*sure\b/i,
  /\bI\s+don'?t\s+(?:know|have)\b.{0,40}\b(?:answer|information)\b/i,
  /\bI\s*can'?t\s*(?:provide|answer|help)\b/i,
  /\bI\s*don'?t\s+have\s+(?:that|the)\s+information\b/i,
];

const SENSITIVE_TOPIC_PATTERNS = [
  /\b(?:lawsuit|sue|attorney|legal\s+action)\b/i,
  /(?:소송|법적|변호사)/,
];

export type EscalationDecision = {
  escalate: boolean;
  reason: "user_requested_human" | "sensitive_topic" | "low_confidence" | "keyword_match" | null;
  matched_keyword?: string | null;
  category?: string | null;
};

export async function detectEscalation(
  sb: SupabaseClient,
  userMessage: string,
  assistantReply: string,
  locale: string,
): Promise<EscalationDecision> {
  const um = userMessage ?? "";
  const ar = assistantReply ?? "";

  // 1. Explicit human handoff
  if (HARD_HANDOFF_PATTERNS_KO.some((r) => r.test(um))) {
    return { escalate: true, reason: "user_requested_human", category: "human_handoff" };
  }
  if (HARD_HANDOFF_PATTERNS_EN.some((r) => r.test(um))) {
    return { escalate: true, reason: "user_requested_human", category: "human_handoff" };
  }

  // 2. Sensitive topic in user message
  if (SENSITIVE_TOPIC_PATTERNS.some((r) => r.test(um))) {
    return { escalate: true, reason: "sensitive_topic", category: "legal" };
  }

  // 3. DB-curated escalation keywords
  try {
    const { data } = await sb
      .from("escalation_keywords")
      .select("keyword, category, locale")
      .eq("enabled", true);
    if (data && data.length) {
      for (const row of data) {
        if (row.locale && row.locale !== locale && row.locale !== "any") continue;
        if (typeof row.keyword === "string" && um.toLowerCase().includes(row.keyword.toLowerCase())) {
          return {
            escalate: true,
            reason: "keyword_match",
            matched_keyword: row.keyword,
            category: row.category ?? null,
          };
        }
      }
    }
  } catch {
    // best-effort; never block the chat reply on escalation lookup failure
  }

  // 4. Low-confidence assistant reply
  if (LOW_CONFIDENCE_PATTERNS_KO.some((r) => r.test(ar)) ||
      LOW_CONFIDENCE_PATTERNS_EN.some((r) => r.test(ar))) {
    return { escalate: true, reason: "low_confidence", category: "uncertain_answer" };
  }

  return { escalate: false, reason: null };
}

/**
 * Build a 1-2 sentence admin-facing summary from the user message.
 */
export function buildAdminSummary(userMessage: string, decision: EscalationDecision): string {
  const reason = decision.reason ?? "unknown";
  const trimmed = userMessage.length > 200 ? userMessage.slice(0, 197) + "…" : userMessage;
  const reasonLabel: Record<string, string> = {
    user_requested_human: "고객이 사람 상담 요청",
    sensitive_topic: "민감 토픽 (법적/소송)",
    low_confidence: "챗봇 답변 신뢰도 낮음",
    keyword_match: `키워드 매치${decision.matched_keyword ? `: "${decision.matched_keyword}"` : ""}`,
  };
  return `[${reasonLabel[reason] ?? reason}] ${trimmed}`;
}
