/**
 * Nav-app brand identity — one authority for colour + ink + mark.
 *
 * 사용자 지시 2026-07-28: "카카오, 티맵 버튼이 글자 대비 쓸데없이 여백이 커,
 * 글자에 딱 맞게, 해당 브랜드 로고랑 브랜드색으로 버튼을 만들어."
 *
 * Two things this file exists to prevent:
 *
 * 1. **Ink drift.** The cockpit's NavRow painted TMAP blue and Naver green and
 *    then wrote the label in `--tr-ink` — which is near-BLACK in light mode.
 *    Dark text on a dark-blue button is unreadable, and the cockpit can be
 *    flipped to light from its own header. A brand colour has exactly one
 *    correct ink and it belongs next to the colour, not at the call site.
 *
 * 2. **Two copies.** The chips exist in the chat map card and in the cockpit's
 *    destination row. They had already drifted (one branded, one grey pills).
 *
 * ⚠ These are brand COLOURS with simple marks drawn from each brand's basic
 * geometry — they are NOT the official logo assets, which Kakao/TMAP/Naver
 * publish under their own button guidelines. If those files are added to
 * /public later, swap `mark` for an <img> here and every call site follows.
 */

export type NavBrandKey = 'kakao' | 'tmap' | 'naver' | 'google' | 'neutral';

export interface NavBrand {
  /** Button fill. */
  bg: string;
  /** The ONE ink that is legible on `bg` — never a theme token. */
  ink: string;
  /** Short label used when the caller wants the brand name only. */
  short: string;
}

export const NAV_BRAND: Record<NavBrandKey, NavBrand> = {
  // Kakao's yellow with its specified near-black ink.
  kakao: { bg: '#FEE500', ink: '#191919', short: '카카오' },
  // Inherited from the cockpit's existing NavRow so the app stays
  // self-consistent; not verified against TMAP's brand book.
  tmap: { bg: '#0F5BD6', ink: '#FFFFFF', short: '티맵' },
  naver: { bg: '#03C75A', ink: '#FFFFFF', short: '네이버' },
  // Google publishes no single button colour for deep links — stay neutral
  // rather than invent one.
  google: { bg: 'var(--tr-surface-2)', ink: 'var(--tr-ink)', short: 'Google' },
  neutral: { bg: 'var(--tr-surface-2)', ink: 'var(--tr-ink)', short: '' },
};

/** Chip key (lib/tour-room/nav-links.ts) → brand. */
export function navBrandForKey(key: string): NavBrandKey {
  if (key.startsWith('kakao')) return 'kakao';
  if (key.startsWith('tmap')) return 'tmap';
  if (key.startsWith('naver')) return 'naver';
  if (key.startsWith('google')) return 'google';
  return 'neutral';
}
