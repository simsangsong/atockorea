/**
 * §L L0/L1 — 계측 순수부와 출력 상한 기본값.
 *
 * 이 스위트가 지키는 계약은 셋이다:
 *   1. 기존 7개 호출부의 명시값이 절대 덮이지 않는다(L1 회귀).
 *   2. 토큰 수를 추정하지 않는다 — 없으면 NULL이다(L-D6).
 *   3. 캐시 히트와 예산 차단이 "호출"로 세어지지 않는다(§F 판정의 분모/분자).
 */

import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  LLM_CALLS_PER_TOUR_BUDGET,
  buildUsageRow,
  countBillableCalls,
  isOverTourBudget,
  resolveMaxOutputTokens,
  type AiUsageRow,
} from '../usage';

describe('resolveMaxOutputTokens (L1)', () => {
  it('호출부의 명시값이 언제나 우선한다 — 기존 7개 호출부 무변경 보장', () => {
    // 실제 호출부에 걸려 있는 값들 그대로.
    expect(resolveMaxOutputTokens('caption', 1000)).toBe(1000);
    expect(resolveMaxOutputTokens('concierge', 400)).toBe(400);
    expect(resolveMaxOutputTokens('vision', 800)).toBe(800);
    expect(resolveMaxOutputTokens('translate', 2200)).toBe(2200);
    expect(resolveMaxOutputTokens('translate', 900)).toBe(900);
    expect(resolveMaxOutputTokens('batch', 1400)).toBe(1400);
    expect(resolveMaxOutputTokens('batch', 900)).toBe(900);
  });

  it('생략하면 목적별 기본값이 걸린다 — "상한 없음"은 더 이상 가능한 상태가 아니다', () => {
    for (const purpose of Object.keys(DEFAULT_MAX_OUTPUT_TOKENS) as Array<
      keyof typeof DEFAULT_MAX_OUTPUT_TOKENS
    >) {
      expect(resolveMaxOutputTokens(purpose)).toBe(DEFAULT_MAX_OUTPUT_TOKENS[purpose]);
      expect(resolveMaxOutputTokens(purpose)).toBeGreaterThan(0);
    }
  });

  it('0·음수·NaN은 "무제한"이 아니라 실수로 보고 기본값으로 되돌린다', () => {
    expect(resolveMaxOutputTokens('concierge', 0)).toBe(DEFAULT_MAX_OUTPUT_TOKENS.concierge);
    expect(resolveMaxOutputTokens('concierge', -5)).toBe(DEFAULT_MAX_OUTPUT_TOKENS.concierge);
    expect(resolveMaxOutputTokens('concierge', Number.NaN)).toBe(DEFAULT_MAX_OUTPUT_TOKENS.concierge);
    expect(resolveMaxOutputTokens('concierge', Infinity)).toBe(DEFAULT_MAX_OUTPUT_TOKENS.concierge);
  });

  it('소수는 내림한다 (max_tokens는 정수여야 한다)', () => {
    expect(resolveMaxOutputTokens('concierge', 401.9)).toBe(401);
  });
});

describe('buildUsageRow (L0)', () => {
  it('프로바이더 usage를 그대로 옮긴다', () => {
    const row = buildUsageRow({
      purpose: 'concierge',
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      usage: { prompt_tokens: 1200, completion_tokens: 180, total_tokens: 1380 },
      latencyMs: 940,
      context: { bookingId: 'b-1' },
    });
    expect(row).toEqual<AiUsageRow>({
      purpose: 'concierge',
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      booking_id: 'b-1',
      tokens_in: 1200,
      tokens_out: 180,
      cache_hit: false,
      latency_ms: 940,
      outcome: 'ok',
    });
  });

  it('usage를 안 주는 프로바이더면 토큰은 NULL이다 — 추정하지 않는다', () => {
    const row = buildUsageRow({
      purpose: 'vision',
      provider: 'openai',
      model: 'gpt-5-mini',
      usage: null,
      latencyMs: null,
    });
    expect(row.tokens_in).toBeNull();
    expect(row.tokens_out).toBeNull();
    expect(row.latency_ms).toBeNull();
  });

  it('오프라인 배치는 booking_id가 NULL이다 — 투어당 예산에서 자연히 빠진다', () => {
    const row = buildUsageRow({ purpose: 'batch', provider: 'deepseek', model: 'deepseek-v4-flash' });
    expect(row.booking_id).toBeNull();
  });

  it('음수·비정상 토큰 값은 NULL로 떨어진다', () => {
    const row = buildUsageRow({
      purpose: 'translate',
      provider: 'gemini',
      model: 'm',
      usage: { prompt_tokens: -1, completion_tokens: Number.NaN },
    });
    expect(row.tokens_in).toBeNull();
    expect(row.tokens_out).toBeNull();
  });

  it('사다리 전부 실패는 failed로 남는다 — 행이 없으면 장애가 "아무도 안 물어봄"과 같아 보인다', () => {
    const row = buildUsageRow({ purpose: 'concierge', provider: 'openai', model: 'm', outcome: 'failed' });
    expect(row.outcome).toBe('failed');
    expect(row.cache_hit).toBe(false);
  });
});

describe('§F 투어당 예산 판정', () => {
  const call = (over: Partial<AiUsageRow> = {}): AiUsageRow =>
    buildUsageRow({ purpose: 'concierge', provider: 'gemini', model: 'm' }) && {
      ...buildUsageRow({ purpose: 'concierge', provider: 'gemini', model: 'm' }),
      ...over,
    };

  it('캐시 히트는 호출로 세지 않는다 — 이게 이 예산이 재려는 바로 그 차이다', () => {
    const rows = [call(), call({ cache_hit: true }), call({ cache_hit: true })];
    expect(countBillableCalls(rows)).toBe(1);
  });

  it('예산 차단(skipped)도 호출이 아니다', () => {
    expect(countBillableCalls([call({ outcome: 'skipped' }), call()])).toBe(1);
  });

  it('장애(failed)는 호출로 센다 — 돈은 안 나가도 사다리는 실제로 다 돌았다', () => {
    expect(countBillableCalls([call({ outcome: 'failed' })])).toBe(1);
  });

  it(`${LLM_CALLS_PER_TOUR_BUDGET}회까지는 예산 내, 초과하면 요주의`, () => {
    const under = Array.from({ length: LLM_CALLS_PER_TOUR_BUDGET }, () => call());
    expect(isOverTourBudget(under)).toBe(false);
    expect(isOverTourBudget([...under, call()])).toBe(true);
  });

  it('빈 투어는 예산 초과가 아니다', () => {
    expect(isOverTourBudget([])).toBe(false);
    expect(countBillableCalls([])).toBe(0);
  });
});
