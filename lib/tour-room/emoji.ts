/**
 * The room's emoji vocabulary — ONE source for both surfaces that show emoji.
 *
 * 사장님 지시 2026-08-07: 이모티콘은 컴포저(+ 버튼 옆 이모지 아이콘)로 모으고,
 * 말풍선 「…」 액션 시트는 전체를 늘어놓지 말고 **가장 자주 쓰는 5개만 자그마하게**.
 * 같은 날 후속: **「좀 더 고급스럽고 이쁘게」** — 아무거나 30개가 아니라 고른 32개로.
 *
 *   EMOJI_GROUPS    — the picker, in four named shelves of eight.
 *   COMPOSER_EMOJI  — the same, flattened (one list for tests and counts).
 *   QUICK_REACTIONS — the five that ride the action sheet as one-tap reactions.
 *
 * 🔴 QUICK_REACTIONS is the ORIGINAL five and its order is load-bearing:
 * `tour_room_reactions` rows are keyed by the emoji character itself, so
 * changing these five orphans every reaction already aggregated in the DB.
 * They therefore lead the first shelf and cannot be curated away.
 *
 * WHAT "고급스럽게" MEANT IN PRACTICE — the old set was a messenger grab bag
 * (💯 🔥 🤩 😍 😭 😴 💪 🫶). Those read loud, and loud is the opposite of what a
 * paid private tour sounds like. They are replaced by what a guest on THIS app
 * actually has to say: a sunrise, a coast, a bus, a coffee, rain. Four shelves —
 * 반응 / 기분 / 여행 / 하루 — so 32 glyphs scan as a menu, not a wall.
 *
 * 🔴 The glyphs themselves are the phone's, not ours: iOS draws Apple emoji,
 * Android draws Noto. Shipping a colour-emoji webfont to "make them prettier"
 * would cost ~10MB on a mobile guest's data — the lever we actually have is
 * WHICH emoji and HOW they are laid out, and that is what this file sets.
 *
 * Server-side (`/reactions`) accepts any string ≤8 UTF-16 units, so it does not
 * pin this list; these constants are the whole contract on the client. Every
 * glyph below is ≤3 units — no ZWJ-composed emoji (👨‍👩‍👧, 🫱🏻‍🫲🏽), which blow
 * that cap and render as separate pieces on older phones.
 */

/** Action-sheet quick reactions — 5, small, one row (사장님 2026-08-07). */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🙏'] as const;

export type EmojiGroupKey = 'reactions' | 'mood' | 'travel' | 'day';

export interface EmojiGroup {
  key: EmojiGroupKey;
  emoji: readonly string[];
}

/**
 * Four shelves of eight. Eight is not arbitrary: at 375px the tray is 359px of
 * usable width, and eight tiles land on exactly the 44px minimum tap target the
 * room enforces globally — seven wastes the row, nine breaks the floor.
 */
export const EMOJI_GROUPS: readonly EmojiGroup[] = [
  // 🔴 The locked five first (see above), then three that answer a guide
  // rather than emote at them.
  { key: 'reactions', emoji: [...QUICK_REACTIONS, '👏', '🙌', '👌'] },
  { key: 'mood', emoji: ['😊', '🥰', '🤗', '😅', '🤔', '😢', '✨', '🎉'] },
  { key: 'travel', emoji: ['📸', '🌅', '🌊', '⛰️', '🌸', '🍁', '🗺️', '🧭'] },
  { key: 'day', emoji: ['☕', '🍜', '🍻', '🍰', '⏰', '🚌', '☀️', '☔'] },
];

/** Flattened picker set — quick five first, so the two surfaces read as one. */
export const COMPOSER_EMOJI = EMOJI_GROUPS.flatMap((group) => group.emoji);
