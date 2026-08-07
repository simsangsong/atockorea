/**
 * The room's emoji vocabulary — ONE source for both surfaces that show emoji.
 *
 * 사장님 지시 2026-08-07: 이모티콘은 컴포저(+ 버튼 옆 이모지 아이콘)로 모으고,
 * 말풍선 「…」 액션 시트는 전체를 늘어놓지 말고 **가장 자주 쓰는 5개만 자그마하게**.
 *
 * That splits the old single list in two, so it lives here rather than inside
 * ChatFeed: the picker and the quick row must never drift apart.
 *
 *   COMPOSER_EMOJI  — the full set, inserted into the draft (message CONTENT).
 *   QUICK_REACTIONS — the five that ride the action sheet as one-tap reactions.
 *
 * 🔴 QUICK_REACTIONS is the ORIGINAL five and its order is load-bearing:
 * `tour_room_reactions` rows are keyed by the emoji character itself, so
 * changing these five orphans every reaction already aggregated in the DB.
 * The remaining 25 stay reachable — the composer picker holds them — they are
 * simply no longer one tap from a bubble.
 *
 * Server-side (`/reactions`) accepts any string ≤8 units, so it does not pin
 * this list; these constants are the whole contract on the client.
 * ZWJ-composed emoji stay out — they can exceed that 8-unit cap.
 */

/** Action-sheet quick reactions — 5, small, one row (사장님 2026-08-07). */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🙏'] as const;

/**
 * Composer picker set — everything, quick five first so the two surfaces read
 * as one vocabulary. Was `REACTION_EMOJI` in ChatFeed (사장님 결정 2026-08-04
 * §5-1: 5종 → 30종); the set is unchanged, only its home moved.
 */
export const COMPOSER_EMOJI = [
  ...QUICK_REACTIONS,
  '😢', '🎉', '👏', '🔥', '💯',
  '😍', '🤩', '😊', '😅', '😭',
  '🥰', '🙌', '👌', '✨', '🤔',
  '😴', '🫶', '💪', '☕', '🍜',
  '🍺', '📸', '🌊', '🚌', '⏰',
] as const;
