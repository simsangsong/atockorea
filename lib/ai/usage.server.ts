/**
 * §L L0 — 계측 기록기 (서버 전용).
 *
 * 🔴 **fire-and-forget이 이 파일의 계약이다.** 호출자는 절대 await하지 않는다.
 * §L-D1은 "절감이 손님을 기다리게 하면 채택하지 않는다"인데, 계측 자신이
 * 그 규칙을 어기면 안 된다 — 텔레메트리 insert 한 번이 컨시어지 응답에
 * 왕복을 더하는 순간 이 트랙은 자기 목적을 배반한다.
 *
 * 그래서 실패는 전부 삼킨다. 계측이 못 남는 것보다 기능이 멈추는 것이 나쁘다.
 */

import type { AiUsageRow } from './usage';

type UsageDb = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
};

let cachedDb: UsageDb | null | undefined;

async function usageDb(): Promise<UsageDb | null> {
  if (cachedDb !== undefined) return cachedDb;
  try {
    const { createServerClient } = await import('@/lib/supabase');
    cachedDb = createServerClient() as unknown as UsageDb;
  } catch {
    cachedDb = null; // 계측은 best-effort — 없어도 기능은 그대로 돈다
  }
  return cachedDb;
}

/**
 * 1행 기록. **await하지 말 것** — 반환 Promise는 테스트 편의용이고,
 * 프로덕션 호출부는 `void recordAiUsage(row)` 형태로 던진다.
 */
export async function recordAiUsage(row: AiUsageRow, db?: UsageDb | null): Promise<void> {
  try {
    const client = db === undefined ? await usageDb() : db;
    if (!client) return;
    await client.from('ops_ai_usage').insert(row);
  } catch {
    /* 계측 실패는 조용히 삼킨다 (위 주석 참조) */
  }
}

/** 캐시/사전으로 답해서 LLM을 치지 않은 건 — 절감 효과의 분자. */
export function recordCacheHit(input: {
  purpose: string;
  bookingId?: string | null;
  latencyMs?: number | null;
}): void {
  void recordAiUsage({
    purpose: input.purpose,
    provider: 'cache',
    model: 'cache',
    booking_id: input.bookingId ?? null,
    tokens_in: null,
    tokens_out: null,
    cache_hit: true,
    latency_ms:
      typeof input.latencyMs === 'number' && Number.isFinite(input.latencyMs)
        ? Math.round(input.latencyMs)
        : null,
    outcome: 'ok',
  });
}
