// Chat telemetry + failure taxonomy (W0.2 / W0.5 — C-2, C-14).
//
// Every LLM turn should leave a cost + token trail (the July 2026 spending-cap
// outage was invisible precisely because cost_usd was never recorded), and
// every failure should leave a typed error row instead of a silent 502.

import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

export type ChatUsage = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

/**
 * USD per 1M tokens. Keep in sync with https://ai.google.dev/pricing.
 * Matched by substring so "-latest"/dated variants inherit their family price.
 */
const PRICING_PER_MTOK: Array<{ match: string; input: number; output: number }> = [
  { match: "flash-lite", input: 0.1, output: 0.4 },
  { match: "2.5-flash", input: 0.3, output: 2.5 },
  { match: "2.0-flash", input: 0.1, output: 0.4 },
];
const DEFAULT_PRICING = { input: 0.3, output: 2.5 }; // assume 2.5-flash

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING_PER_MTOK.find((row) => model.includes(row.match)) ?? DEFAULT_PRICING;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

type GeminiUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  /** Thinking tokens are billed as output; count them in. */
  thoughtsTokenCount?: number;
};

/** Extract usage from a Gemini response (buffered or aggregated stream). */
export function usageFromGeminiResponse(
  response: { usageMetadata?: GeminiUsageMetadata } | null | undefined,
  model: string,
): ChatUsage | null {
  const u = response?.usageMetadata;
  if (!u) return null;
  const inputTokens = u.promptTokenCount ?? 0;
  const outputTokens = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
  if (inputTokens === 0 && outputTokens === 0) return null;
  return { inputTokens, outputTokens, costUsd: estimateCostUsd(model, inputTokens, outputTokens) };
}

// ── Failure taxonomy ─────────────────────────────────────────────────────────

export type GenErrorCode = "quota" | "key" | "timeout" | "network" | "unknown";

/** Classify a Gemini/OpenAI call failure into an actionable error code. */
export function classifyGenError(err: unknown): GenErrorCode {
  const msg = (err instanceof Error ? `${err.name} ${err.message}` : String(err)).toLowerCase();
  if (msg.includes("429") || msg.includes("resource_exhausted") || msg.includes("quota") || msg.includes("spending"))
    return "quota";
  if (
    msg.includes("api key") ||
    msg.includes("api_key") ||
    msg.includes("permission_denied") ||
    msg.includes("unauthenticated") ||
    msg.includes("401") ||
    msg.includes("403")
  )
    return "key";
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("deadline") || msg.includes("abort"))
    return "timeout";
  if (msg.includes("fetch failed") || msg.includes("network") || msg.includes("econn") || msg.includes("socket"))
    return "network";
  return "unknown";
}

/** Only transient failures are worth one retry; a bad key never heals in 350ms. */
export function isRetryableGenError(code: GenErrorCode): boolean {
  return code !== "key";
}

/**
 * W0.4 — honest outage reply when generation failed even after a retry.
 * Always paired with handoff_offered so the visitor has a human path;
 * NEVER a bare 502 (which the widget renders as a dead bot).
 */
export function assistantOutageReply(locale: TourProductPageLocale): string {
  const m: Record<TourProductPageLocale, string> = {
    en: "I'm having a temporary technical problem generating answers right now. Your question was not lost — would you like me to connect you with our team in this chat? You can also try again in a moment.",
    ko: "지금 답변 생성에 일시적인 문제가 있어요. 질문이 사라진 건 아니니 잠시 후 다시 시도하시거나, 이 채팅에서 바로 담당자에게 연결해 드릴까요?",
    ja: "現在、回答の生成に一時的な問題が発生しています。少し後にもう一度お試しいただくか、このチャットで担当者におつなぎしましょうか？",
    zh: "目前生成回答遇到临时问题。你的问题没有丢失——可以稍后再试，或者我在此聊天中为你连接工作人员？",
    "zh-TW": "目前生成回答遇到臨時問題。你的問題沒有遺失——可以稍後再試，或者我在此聊天中為你連接工作人員？",
    es: "Tengo un problema técnico temporal para generar respuestas. Tu pregunta no se perdió: ¿quieres que te conecte con nuestro equipo en este chat? También puedes intentarlo de nuevo en un momento.",
  };
  return m[locale] ?? m.en;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
