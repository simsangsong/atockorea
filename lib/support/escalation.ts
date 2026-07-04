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

// W1.5.2 (C-21) — complaint/anger tone. Keyword-DB escalation only fired on
// literal trigger words like "환불", so "서비스 정말 별로였어요" (no keyword)
// sailed past while the customer fumed. These patterns catch dissatisfaction,
// anger, scam accusations, and gone-unanswered complaints in 5 languages.
const COMPLAINT_PATTERNS = [
  /(별로였|별로예요|별로네|실망|최악|화가\s*나|화나|짜증|불쾌|엉망|어이가\s*없|말이\s*돼|말이\s*안\s*되|사기\s*(?:꾼|아니|당한|치)|속았|따질)/,
  /\b(terrible|awful|horrible|worst|disappointed|disappointing|unacceptable|ridiculous|furious|outrageous|scam|rip[-\s]?off|never\s+again|waste\s+of\s+money)\b/i,
  /(ひどい|最悪|残念でした|失望しました|詐欺|ふざけ)/,
  /(太差|很差|糟糕|太失望|气死|氣死|骗人|騙人|坑人|投诉|投訴)/,
  /\b(p[ée]simo|decepcionado|decepcionante|estafa|indignante|una\s+verg[üu]enza)\b/i,
  // Gone-unanswered complaints ("답장이 없어요", "no one replied").
  /(답장이\s*없|연락이\s*없|응답이\s*없|아무도\s*답|no\s+(?:one|body)\s+(?:has\s+)?(?:replied|responded|answered)|no\s+response|no\s+reply|nadie\s+respond)/i,
  // Rage punctuation.
  /[!！]{3,}/,
];

export function looksLikeComplaint(message: string): boolean {
  return COMPLAINT_PATTERNS.some((r) => r.test(message));
}

export type EscalationDecision = {
  escalate: boolean;
  reason: "user_requested_human" | "sensitive_topic" | "low_confidence" | "keyword_match" | "complaint" | null;
  matched_keyword?: string | null;
  category?: string | null;
};

// W1.5.1 (C-20): informational intents where a policy keyword ("환불",
// "refund") appearing in the QUESTION is normal and must NOT create a ticket
// ("환불 정책이 뭐예요?" generated real ops tickets #64/#66). booking_specific
// and unknown stay OUT of this set so real personal-booking issues still
// escalate on keywords.
const INFORMATIONAL_INTENTS = new Set([
  "policy",
  "legal",
  "company",
  "poi",
  "tour_recommendation",
  "tour_catalog",
  "quote_request",
  "price_question",
]);

// An actual ACTION request ("환불해주세요", "cancel my booking") always keeps
// keyword escalation live, whatever the classified intent.
const ACTION_REQUEST_PATTERNS = [
  /환불\s*(?:해\s*주|해줘|해달라|요청|원해|받고\s*싶|처리)/,
  /취소\s*(?:해\s*주|해줘|해달라|하고\s*싶|요청|할게|부탁|처리)/,
  /(?:refund|cancel)\s+(?:my|this|the|our)\b/i,
  /\b(?:i\s+want|i'?d\s+like|i\s+need|please)\s+(?:a\s+)?(?:refund|cancellation|to\s+cancel)\b/i,
  /\brefund\s+me\b/i,
  /返金(?:して|をお願い|希望|お願い)/,
  /キャンセル(?:して|をお願い|したい)/,
  /退款|退钱|退錢/,
  /取消(?:我的)?(?:预订|預訂|订单|訂單|预约|預約)/,
  /(?:quiero|necesito|solicito)\s+(?:un\s+)?reembolso/i,
  /cancelar\s+mi\b/i,
];

export function isActionRequest(message: string): boolean {
  return ACTION_REQUEST_PATTERNS.some((r) => r.test(message));
}

export async function detectEscalation(
  sb: SupabaseClient,
  userMessage: string,
  assistantReply: string,
  locale: string,
  opts: {
    /** classifyChatbotQuery intent for this turn — gates keyword escalation. */
    intent?: string;
  } = {},
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

  // 2.5 — complaint / anger tone (W1.5.2). Checked before the informational
  // gate on purpose: an angry customer escalates whatever the intent is.
  if (looksLikeComplaint(um)) {
    return { escalate: true, reason: "complaint", category: "complaint" };
  }

  // 3. DB-curated escalation keywords.
  // W1.5.1: skipped for informational questions ("환불 정책이 뭐예요?" is a
  // policy QUESTION, not a refund REQUEST) unless the message is an explicit
  // action request. Intent+substring together, not substring alone (C-20).
  const informationalTurn =
    opts.intent !== undefined && INFORMATIONAL_INTENTS.has(opts.intent) && !isActionRequest(um);
  if (!informationalTurn) {
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
    complaint: "컴플레인/불만 톤 감지",
  };
  return `[${reasonLabel[reason] ?? reason}] ${trimmed}`;
}
