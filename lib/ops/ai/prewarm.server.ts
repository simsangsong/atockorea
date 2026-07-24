/**
 * §L L3 — 프리워밍 실행부 (서버 전용).
 *
 * 🔴 호출부는 **절대 await하지 않는다**. 시작 게이트는 좌석을 잠그는 실시간
 * 동작이고, 프리워밍이 그걸 지연시키면 §L-D1("절감이 손님을 기다리게 하면
 * 채택하지 않는다")을 정면으로 어긴다.
 */

import type { RoomDbClient } from '@/lib/tour-room/access';
import { hasWork, planPrewarm, type PrewarmPlan } from './prewarm';

/**
 * 그룹의 각 예약에 대해 오늘 일정의 앞쪽 스팟 콘텐츠를 미리 만든다.
 *
 * 순차 실행이다 — 병렬로 6개를 동시에 던지면 프로바이더 레이트 리밋에 걸려
 * **손님 경로의 호출까지 같이 실패**한다. 미리 데우는 일이 실시간 답변을
 * 밀어내면 안 된다.
 */
export async function prewarmSpotContent(
  supabase: RoomDbClient,
  plan: PrewarmPlan,
): Promise<{ warmed: number; skipped: number }> {
  if (!hasWork(plan)) return { warmed: 0, skipped: 0 };

  let warmed = 0;
  let skipped = 0;
  try {
    const { generateSpotContent } = await import('@/lib/tour-room/generatedContent');
    for (const spot of plan.spots) {
      try {
        const row = await generateSpotContent(supabase, {
          bookingId: plan.bookingId,
          title: spot.title,
          poiKey: spot.poiKey,
          placeId: spot.placeId,
          locales: plan.locales,
        });
        if (row) warmed += 1;
        else {
          // null = 예산 소진 또는 생성 실패. 예산이 끝났으면 나머지도 끝났다 —
          // 계속 두드려봐야 같은 답이 온다.
          skipped += 1;
          break;
        }
      } catch {
        skipped += 1;
      }
    }
  } catch {
    return { warmed, skipped };
  }
  return { warmed, skipped };
}

/**
 * 시작 게이트에서 부르는 진입점. **fire-and-forget.**
 *
 * 실패는 전부 삼킨다: 데워지지 않은 스팟은 손님이 도착할 때 예전처럼
 * 생성된다 — 회귀가 아니라 원래 동작이다.
 */
export function prewarmForTourStart(
  supabase: RoomDbClient,
  bookings: Array<{ bookingId: string; schedule: unknown[]; locales: string[] }>,
): void {
  void (async () => {
    for (const b of bookings) {
      const plan = planPrewarm({
        bookingId: b.bookingId,
        schedule: (b.schedule ?? []) as Array<Record<string, unknown>>,
        locales: b.locales,
      });
      if (!plan) continue;
      const { warmed, skipped } = await prewarmSpotContent(supabase, plan);
      if (warmed > 0 || skipped > 0) {
        console.log(`[prewarm] booking=${b.bookingId} warmed=${warmed} skipped=${skipped}`);
      }
      // 예산이 끊긴 뒤에는 다음 예약도 볼 것 없다.
      if (skipped > 0 && warmed === 0) break;
    }
  })().catch(() => undefined);
}
