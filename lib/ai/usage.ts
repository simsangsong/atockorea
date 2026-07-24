/**
 * §L L0/L1 — LLM 호출 계측의 순수부 + 목적별 출력 토큰 상한 기본값.
 *
 * 순수부만 여기 산다(`node:crypto`도 supabase도 import하지 않는다) — 기록기는
 * `usage.server.ts`이고 라우터가 동적 import로 집는다. §H-1(client 페이지가
 * 서버 모듈을 끌어와 `next build --webpack`만 깨지는 부류)을 피하는 이
 * 저장소의 기존 패턴(`facilityPins/.server`, `eta/.server`)을 그대로 따른다.
 */

import type { AiProvider, AiPurpose } from './router';

/**
 * §L-D5 — 목적별 출력 상한 기본값.
 *
 * 지금은 호출부 7곳이 전부 손으로 `maxOutputTokens`를 걸고 있다. 규율이 사람
 * 기억에 있으면 8번째 호출부가 상한 없이 추가되고, 그때 새는 것은 출력 토큰이다
 * (입력보다 단가가 몇 배 높다). 값은 현행 호출부의 실제 값을 그대로 옮긴 것이라
 * 이 기본값이 켜져도 **기존 호출 결과는 바이트 단위로 동일하다** — 호출부가
 * 명시한 값이 항상 우선하기 때문이다.
 *
 * 기본값은 "이 목적이 정상 동작할 때 필요한 최대"이지 "넉넉한 여유"가 아니다.
 * 넉넉하게 잡으면 상한이 있으나 마나 해진다.
 */
export const DEFAULT_MAX_OUTPUT_TOKENS: Record<AiPurpose, number> = {
  // 실시간 자막 — 여러 로케일을 한 JSON에 담아 돌려받는다.
  caption: 1000,
  // 손님 질문 1개에 대한 답 1개. 길면 손님이 안 읽는다(S4).
  concierge: 400,
  // N로케일 배치 번역 1콜. 다이닝 10로케일이 이 상한을 먹는 최대 케이스다.
  translate: 1200,
  // 사진 1장에 대한 설명.
  vision: 800,
  // 오프라인 생성(POI 서사·영상 스크립트). 손님이 기다리지 않는 경로라 가장 넉넉하다.
  batch: 1400,
};

/**
 * 호출부가 명시했으면 그 값, 아니면 목적별 기본값.
 * 0이나 음수는 "상한 없음"이 아니라 실수로 본다 — 기본값으로 되돌린다.
 */
export function resolveMaxOutputTokens(purpose: AiPurpose, explicit?: number): number {
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) {
    return Math.floor(explicit);
  }
  return DEFAULT_MAX_OUTPUT_TOKENS[purpose] ?? 800;
}

/** 호출 결과의 처분. failed(장애)와 skipped(예산·휴리스틱)를 반드시 구분한다. */
export type AiUsageOutcome = 'ok' | 'failed' | 'skipped';

export interface AiUsageContext {
  /** 어느 투어의 비용인가. 오프라인 배치는 undefined. */
  bookingId?: string | null;
  /** 호출부 식별용(집계 시 라우트별 분해). 자유 텍스트, PII 금지. */
  label?: string | null;
}

export interface AiUsageRow {
  purpose: string;
  provider: string;
  model: string;
  booking_id: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cache_hit: boolean;
  latency_ms: number | null;
  outcome: AiUsageOutcome;
}

/** OpenAI 호환 응답의 usage 블록 (gemini·deepseek·openai 모두 같은 모양). */
export interface ProviderUsage {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
}

function intOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

/**
 * 계측 1행을 만든다. **추정하지 않는다** — 프로바이더가 usage를 주지 않으면
 * 토큰은 NULL로 남는다. 추정 토큰으로 그린 비용 그래프는 틀린 숫자를
 * 확신하게 만들고, 그게 계측이 없는 것보다 나쁘다.
 */
export function buildUsageRow(input: {
  purpose: AiPurpose;
  provider: AiProvider | string;
  model: string;
  usage?: ProviderUsage | null;
  latencyMs?: number | null;
  cacheHit?: boolean;
  outcome?: AiUsageOutcome;
  context?: AiUsageContext;
}): AiUsageRow {
  return {
    purpose: input.purpose,
    provider: String(input.provider),
    model: input.model,
    booking_id: input.context?.bookingId ?? null,
    tokens_in: intOrNull(input.usage?.prompt_tokens),
    tokens_out: intOrNull(input.usage?.completion_tokens),
    cache_hit: input.cacheHit === true,
    latency_ms: intOrNull(input.latencyMs),
    outcome: input.outcome ?? 'ok',
  };
}

/**
 * §F 판정 — 투어 1건당 LLM 호출 예산. 캐시 히트는 호출이 아니므로 세지 않는다
 * (그게 이 예산이 측정하려는 바로 그 차이다).
 */
export const LLM_CALLS_PER_TOUR_BUDGET = 30;

export function countBillableCalls(rows: Array<Pick<AiUsageRow, 'cache_hit' | 'outcome'>>): number {
  return rows.filter((row) => !row.cache_hit && row.outcome !== 'skipped').length;
}

export function isOverTourBudget(rows: Array<Pick<AiUsageRow, 'cache_hit' | 'outcome'>>): boolean {
  return countBillableCalls(rows) > LLM_CALLS_PER_TOUR_BUDGET;
}
