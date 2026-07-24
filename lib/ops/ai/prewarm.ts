/**
 * §L L3 — 프리워밍. 손님 경로 밖에서 미리 데운다.
 *
 * 🔴 **L-D4가 이 트랙의 최대 레버라고 지목한 것이 이거다.** 호출 수가 같아도
 * **손님이 기다리지 않는 시각**에 하면 체감 성능이 오히려 올라간다. 절감이
 * 아니라 이동이지만, §L의 제약("성능 저하 0")을 만족하면서 손님 경로의
 * LLM 대기를 없애는 유일한 방법이다.
 *
 * 발동 시점: **투어 시작 게이트**(가이드가 [투어 시작]을 누르는 순간).
 * 그때 손님은 아직 버스에 앉아 있고, 첫 스팟 도착까지 보통 수십 분이 남는다.
 * 그 사이에 오늘 쓸 것을 만들어 두면 도착 카드가 캐시 히트로 뜬다.
 *
 * 🔴 **절대 await하지 않는다.** 시작 게이트는 12명의 좌석을 잠그는 실시간
 * 동작이고, 프리워밍 실패나 지연이 그걸 막으면 안 된다 — 데워지지 않은 것은
 * 손님 경로에서 예전처럼 생성될 뿐이고, 그건 회귀가 아니라 원래 동작이다.
 *
 * 🔴 **예산을 새로 만들지 않는다.** 생성기들은 이미 컨시어지 일일 예산에
 * 편승해 있고(`generatedContent.ts`), 프리워밍이 그 예산을 별도로 우회하면
 * "예산 안에서 아꼈다"는 말이 거짓이 된다. 예산이 소진되면 프리워밍도 멈춘다.
 */

/** 한 번에 데울 스팟 수 상한. */
export const PREWARM_SPOT_LIMIT = 6;

export interface PrewarmSpot {
  title: string;
  poiKey?: string | null;
  placeId?: string | null;
}

export interface PrewarmPlan {
  bookingId: string;
  spots: PrewarmSpot[];
  locales: string[];
}

interface ScheduleItem {
  title?: string | null;
  name?: string | null;
  poi_key?: string | null;
  place_id?: string | null;
}

function spotTitle(item: ScheduleItem): string {
  return String(item.title ?? item.name ?? '').trim();
}

/**
 * 일정에서 데울 스팟을 고른다.
 *
 * 🔴 상한을 두는 이유는 비용이 아니라 **정직**이다: 일정이 20스팟이면
 * 20번을 미리 부르는 것은 "예산 안에서 아낀다"가 아니라 예산을 앞당겨
 * 태우는 것이다. 앞쪽 스팟만 데운다 — 뒤쪽은 도착할 때쯤이면 어차피
 * 도착 트리거가 만든다.
 */
export function planPrewarm(
  input: { bookingId: string; schedule: ScheduleItem[]; locales: string[] },
  limit = PREWARM_SPOT_LIMIT,
): PrewarmPlan | null {
  if (!input.bookingId) return null;

  const seen = new Set<string>();
  const spots: PrewarmSpot[] = [];
  for (const item of input.schedule ?? []) {
    const title = spotTitle(item);
    if (!title) continue;
    const key = (item.poi_key ?? item.place_id ?? title).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    spots.push({ title, poiKey: item.poi_key ?? null, placeId: item.place_id ?? null });
    if (spots.length >= limit) break;
  }
  if (spots.length === 0) return null;

  // 생성기가 3개로 자르므로 여기서도 3개까지만 넘긴다 — 넘겨봐야 버려진다.
  const locales = [...new Set(['en', ...(input.locales ?? []).filter(Boolean)])].slice(0, 3);
  return { bookingId: input.bookingId, spots, locales };
}

/** 데울 것이 있는가. 없으면 호출부가 아무 일도 하지 않는다. */
export function hasWork(plan: PrewarmPlan | null): boolean {
  return Boolean(plan && plan.spots.length > 0);
}
