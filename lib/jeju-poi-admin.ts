/** Bounds for `manual_boost_score` (additive generation ranking; PATCH + forms). */
export const MANUAL_BOOST_SCORE_MIN = 0;
export const MANUAL_BOOST_SCORE_MAX = 1000;

export function clampManualBoostScore(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw));
  if (!Number.isFinite(n)) return 0;
  return Math.min(MANUAL_BOOST_SCORE_MAX, Math.max(MANUAL_BOOST_SCORE_MIN, n));
}
