/**
 * V0.1 — STT 용어 바이어싱 프롬프트 (서버 리졸버).
 *
 * 오늘 이 룸이 실제로 가는 곳들의 이름을 모아 `stt-router.ts` 의 `prompt` 로 넘긴다.
 * 범용 통역기가 절대 못 하는 것이 이것이다 — 우리는 손님이 **오늘 어디 가는지** 안다.
 *
 * 순수 파트(`sttPrompt.ts`)와 나눈 이유는 glossary.ts / glossary.server.ts 와 같다:
 * 클라이언트 번들이 DB 클라이언트를 끌고 들어가면 안 된다.
 *
 * 🔴 레이턴시 규율: 이 모듈은 **STT 앞에 붙는다**. DB 왕복이 그대로 통역 지연이 되므로
 * 룸별로 캐시한다. 일정은 발화 사이에 바뀌지 않는다. 캐시 미스여도 실패는 조용히
 * 빈 문자열이다 — 바이어싱이 빠진 전사는 열화지만, 던지는 전사는 장애다.
 */

import { resolveDaySchedule } from '@/lib/tour-room/dayPlan';
import { buildSttPrompt, scheduleTerms } from '@/lib/tour-room/sttPrompt';
import type { RoomDbClient } from '@/lib/tour-room/access';

const CACHE_TTL_MS = 5 * 60 * 1000;
/** 룸 수는 하루 수십 개다. 상한은 폭주 방지용이지 튜닝 대상이 아니다. */
const MAX_CACHE_ENTRIES = 500;

const cache = new Map<string, { prompt: string; loadedAt: number }>();

function cacheGet(key: string, now: number): string | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (now - hit.loadedAt >= CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.prompt;
}

function cacheSet(key: string, prompt: string, now: number): void {
  // 가장 오래된 것부터 버린다 — Map 은 삽입 순서를 지킨다.
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { prompt, loadedAt: now });
}

export interface RoomSttPromptArgs {
  bookingId: string;
  tourDate: string | null;
  /** 호출부가 이미 갖고 있으면 넘긴다 — 리졸버의 추가 쿼리를 아낀다. */
  itinerary?: unknown;
  tourSchedule?: unknown;
  tourId?: string | null;
}

/**
 * 오늘 일정 기반 STT 프롬프트. 일정이 없거나 조회가 실패하면 `''` 이고, 호출부는
 * 그때 `prompt` 필드를 **생략**해야 한다(빈 문자열 전송과 생략은 프로바이더에 따라
 * 다르게 동작한다).
 */
export async function roomSttPrompt(
  supabase: RoomDbClient,
  args: RoomSttPromptArgs,
  now: number = Date.now(),
): Promise<string> {
  const key = `${args.bookingId}:${args.tourDate ?? 'nodate'}`;
  const cached = cacheGet(key, now);
  if (cached !== null) return cached;

  let prompt = '';
  try {
    const resolved = await resolveDaySchedule(supabase, {
      bookingId: args.bookingId,
      tourDate: args.tourDate,
      itinerary: args.itinerary,
      tourSchedule: args.tourSchedule,
      tourId: args.tourId,
      // 한국어 표기를 원한다 — 바이어싱 대상이 가이드/기사의 한국어 발화다.
      locale: 'ko',
    });
    prompt = buildSttPrompt(scheduleTerms(resolved.schedule as Array<Record<string, unknown>>));
  } catch {
    prompt = '';
  }

  cacheSet(key, prompt, now);
  return prompt;
}

/** 테스트 훅. */
export function __resetSttPromptCacheForTests(): void {
  cache.clear();
}
