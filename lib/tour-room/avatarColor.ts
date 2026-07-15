/**
 * U0.5 — deterministic pastel identity colors for traveller avatars.
 *
 * The palette pairs a soft background with an ink that keeps ≥4.5:1 on it
 * (U-D10), in both themes — these are literal values, not theme vars, so a
 * traveller keeps the same color in light and dark.
 */

export interface AvatarColor {
  bg: string;
  ink: string;
}

export const AVATAR_PALETTE: AvatarColor[] = [
  { bg: '#FCE7F3', ink: '#9D174D' }, // pink
  { bg: '#E0E7FF', ink: '#3730A3' }, // indigo
  { bg: '#D1FAE5', ink: '#065F46' }, // green
  { bg: '#FEF3C7', ink: '#92400E' }, // amber
  { bg: '#E0F2FE', ink: '#075985' }, // sky
  { bg: '#EDE9FE', ink: '#5B21B6' }, // violet
  { bg: '#FFE4E6', ink: '#9F1239' }, // rose
  { bg: '#CCFBF1', ink: '#115E59' }, // teal
];

/** Stable non-negative hash (djb2) so the same name always gets the same color. */
export function avatarColorIndex(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % AVATAR_PALETTE.length;
}

export function avatarColorFor(seed: string): AvatarColor {
  return AVATAR_PALETTE[avatarColorIndex(seed)];
}

/** First visible character, uppercased — good enough for Latin and CJK alike. */
export function avatarInitial(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  return trimmed[0].toUpperCase();
}
