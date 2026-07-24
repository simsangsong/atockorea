/**
 * §L L2 — Tier 1 응답 캐시의 I/O부.
 *
 * 🔴 **L-D1이 이 파일의 상한이다: 캐시가 LLM보다 느리면 안 넣는다.**
 * 인덱스 하나짜리 단일 select이므로 p95는 수십 ms이고, Tier 1 예산(< 4s)에
 * 비하면 무시할 수 있다. 실패는 전부 삼킨다 — 캐시 조회가 답변을 막는 것은
 * 절감이 아니라 장애다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'ops_concierge_cache';

export interface CachedAnswer {
  answer: string;
}

/** 히트면 답, 아니면 null. 어떤 실패도 null로 떨어진다(= 정상 경로로 진행). */
export async function readConciergeCache(
  supabase: SupabaseClient,
  key: string,
): Promise<CachedAnswer | null> {
  try {
    const { data, error } = await supabase.from(TABLE).select('answer').eq('cache_key', key).maybeSingle();
    if (error || !data) return null;
    const answer = (data as { answer?: unknown }).answer;
    return typeof answer === 'string' && answer.trim() ? { answer } : null;
  } catch {
    return null;
  }
}

/**
 * 저장. **await하지 말 것** — 손님은 이미 답을 받았고, 쓰기를 기다릴 이유가 없다.
 * 같은 키가 동시에 두 번 들어오면 UNIQUE가 하나를 튕기고, 그건 정상이다.
 */
export function writeConciergeCache(
  supabase: SupabaseClient,
  input: { key: string; locale: string; contextVersion: string; answer: string },
): void {
  void (async () => {
    try {
      await supabase.from(TABLE).upsert(
        {
          cache_key: input.key,
          locale: input.locale,
          context_version: input.contextVersion,
          answer: input.answer,
        },
        { onConflict: 'cache_key' },
      );
    } catch {
      /* 캐시 미저장은 다음 요청이 LLM을 한 번 더 치는 것뿐이다 */
    }
  })();
}
