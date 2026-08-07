/**
 * I7 — which three tiles the home screen shows before the guest asks for more.
 *
 * The decision (2026-07-29): the action grid is neither fully collapsed nor
 * fully open. Three tiles sit expanded, the next row peeks its icon heads, and
 * a "more" button opens everything. Fully collapsed reads as "there is nothing
 * here"; fully open is what I2 spent a wave undoing.
 *
 * That makes the choice of three load-bearing, so it is derived rather than
 * fixed: the same seven states the now card resolves from decide what a guest
 * is most likely to want in the minute they are living in. Someone standing at
 * a stop wants to ask about the place; someone whose group has moved on wants
 * to say where they are; someone in the pickup window wants the pickup card.
 *
 * Two rules this must not break:
 *
 *   U-D24 — a tile that duplicates a bottom tab is not promoted. Chat, today
 *     and map are one thumb away at all times, so spending a peek slot on them
 *     buys a second door to a room the guest is already standing in.
 *   U-D25 — everything is still there. This orders the grid; it never filters
 *     it. Expanding reveals the rest in place, so nothing a guest learned has
 *     moved, and the tabs' twins come back with it.
 *
 * Ordering rather than slicing is deliberate: the component clips the grid to
 * one row plus a peek, so the tiles that follow are the same elements in the
 * same order whether the grid is open or shut. Nothing jumps on expand.
 */
import type { NowCardState } from '@/lib/tour-room/nowCard';

/** Tile keys as HomeTab builds them. */
export type HomeTileKey =
  | 'smart-guide'
  | 'chat'
  | 'schedule'
  | 'map'
  | 'pickup'
  /** 내 좌석. 좌석이 있는 상품에서만 존재한다(전세엔 없다). */
  | 'seat'
  | 'plan'
  | 'signal'
  | 'timeline'
  | 'review'
  | 'sos';

/**
 * Tiles that already own a bottom tab. Never promoted (U-D24), always present
 * once the grid is open (U-D25).
 */
export const TAB_TWIN_TILES: readonly HomeTileKey[] = ['chat', 'schedule', 'map'];

/**
 * What each state puts first. Read these as sentences about the guest, not as
 * feature rankings:
 *
 *   rally_overdue — the group is waiting. Say something, then get help.
 *   free_time     — loose in a town. Ask about it, or call the van.
 *   arrived       — standing in front of the thing. Ask about the thing.
 *   pickup_window — waiting to be collected. Where, and am I late.
 *   moving        — in the vehicle. Next stop, and what it is.
 *   ended         — it is over. Look back, then say how it went.
 *   lobby         — it has not started. Shape the day, then find the pickup.
 */
const BY_STATE: Record<NowCardState, readonly HomeTileKey[]> = {
  rally_overdue: ['signal', 'sos', 'smart-guide'],
  free_time: ['signal', 'smart-guide', 'pickup'],
  arrived: ['smart-guide', 'signal', 'timeline'],
  // 픽업 창 = 곧 탄다. 어디로 갈지 다음에 **몇 번 자리인지**가 그 순간의 질문이다.
  pickup_window: ['pickup', 'seat', 'signal'],
  moving: ['smart-guide', 'signal', 'pickup'],
  ended: ['timeline', 'review', 'smart-guide'],
  // 로비 = 아직 안 시작. 좌석을 고를 수 있는 유일한 구간이 대체로 여기다.
  lobby: ['plan', 'seat', 'smart-guide'],
};

/**
 * The fallback when the resolver has no answer for this minute. Not a copy of
 * any state's list — it is the order that is least wrong when we do not know
 * where the guest is: the assistant, then the plan, then the pickup.
 */
const NO_STATE: readonly HomeTileKey[] = ['smart-guide', 'plan', 'pickup', 'signal', 'timeline'];

export const PEEK_COUNT = 3;

/**
 * Order `keys` so the state's preferred tiles come first, then everything else
 * in the order the caller built them.
 *
 * Preferences that are not present are skipped rather than reserved — a lobby
 * guest on a join tour has no `plan` tile, and the slot goes to the next real
 * one instead of leaving a hole. Tab twins can never take a promoted slot, but
 * they keep their natural position in the tail.
 */
export function orderHomeTiles(
  keys: readonly HomeTileKey[],
  state: NowCardState | null,
): HomeTileKey[] {
  const present = new Set(keys);
  const preferred = state ? BY_STATE[state] : NO_STATE;

  const promoted: HomeTileKey[] = [];
  const take = (key: HomeTileKey) => {
    if (promoted.length >= PEEK_COUNT) return;
    if (!present.has(key)) return;
    if (TAB_TWIN_TILES.includes(key)) return;
    if (promoted.includes(key)) return;
    promoted.push(key);
  };

  for (const key of preferred) take(key);

  // Fill any slot the preference list left empty with a tile that is not a tab
  // twin, in the order the caller built them. Without this the first row falls
  // back to whatever comes next — and what comes next is chat/today/map, which
  // would put a twin on the first screen *and* push a real destination below
  // the fold. The rule is not "never show a twin"; it is "never let one
  // displace something that has nowhere else to be".
  for (const key of keys) take(key);

  const taken = new Set(promoted);
  return [...promoted, ...keys.filter((k) => !taken.has(k))];
}

/**
 * The tiles that will be fully visible while the grid is shut. Exported for
 * tests and for anything that needs to reason about the first screen without
 * re-deriving the slice.
 */
export function peekedHomeTiles(
  keys: readonly HomeTileKey[],
  state: NowCardState | null,
): HomeTileKey[] {
  return orderHomeTiles(keys, state).slice(0, PEEK_COUNT);
}
