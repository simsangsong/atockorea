/**
 * Deterministic scoring for gallery rows vs a target POI (loggable breakdown).
 */

import { normalizeTitleForPhotoSkip } from '@/lib/jeju-photo-gallery/skip-rules';
import type { JejuGalleryCandidate, JejuGalleryScoreBreakdown } from '@/lib/jeju-photo-gallery/gallery-candidate-types';

export type PoiMatchContext = {
  poiTitle: string;
  /** Normalized via `normalizeTitleForPhotoSkip`. */
  poiTitleNorm: string;
};

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const cur = dp[i];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  return dp[m];
}

function similarityRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function bestTitleSimilarityAgainstPoi(
  ctx: PoiMatchContext,
  ...candidates: (string | null | undefined)[]
): number {
  const x = ctx.poiTitleNorm;
  if (!x) return 0;
  let best = 0;
  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    const y = normalizeTitleForPhotoSkip(raw);
    if (!y) continue;
    if (x === y) {
      best = Math.max(best, 1);
      continue;
    }
    if (x.includes(y) || y.includes(x)) {
      best = Math.max(best, 0.93);
      continue;
    }
    best = Math.max(best, similarityRatio(x, y));
  }
  return best;
}

const JEJU_LOC_RE =
  /제주|서귀포|한라|성산|애월|조천|구좌|대정|안덕|한경|한림|표선|남원|jeju/i;

export function isJejuLikelyLocation(loc: string | null | undefined): boolean {
  if (!loc?.trim()) return false;
  return JEJU_LOC_RE.test(loc);
}

function isLikelyBroadGalleryTitle(title: string | null | undefined): boolean {
  if (!title?.trim()) return false;
  const n = normalizeTitleForPhotoSkip(title);
  if (!n || n.length <= 2) return true;
  const broad = ['제주', '제주도', '제주특별자치도', '서귀포시', '제주시', '관광지', '명소', '풍경'];
  return broad.some((b) => n === normalizeTitleForPhotoSkip(b));
}

function keywordHitsPoi(ctx: PoiMatchContext, keyword: string | null | undefined): boolean {
  if (!keyword?.trim()) return false;
  const kn = normalizeTitleForPhotoSkip(keyword);
  if (!kn || !ctx.poiTitleNorm) return false;
  return kn.includes(ctx.poiTitleNorm) || ctx.poiTitleNorm.includes(kn);
}

export function scoreGalleryCandidate(ctx: PoiMatchContext, c: JejuGalleryCandidate): JejuGalleryScoreBreakdown {
  const titleSimilarity = bestTitleSimilarityAgainstPoi(
    ctx,
    c.galleryTitle,
    c.galTitle,
    c.galleryGroupTitle,
  );
  const aliasSimilarity = bestTitleSimilarityAgainstPoi(ctx, c.galSearchKeyword);

  let jejuLocationBonus = 0;
  if (isJejuLikelyLocation(c.photographyLocation)) jejuLocationBonus = 0.06;

  let keywordBonus = 0;
  if (keywordHitsPoi(ctx, c.galSearchKeyword)) keywordBonus = 0.06;

  let broadTitlePenalty = 0;
  if (isLikelyBroadGalleryTitle(c.galleryTitle ?? c.galTitle)) broadTitlePenalty = 0.1;

  const total = Math.max(
    0,
    Math.min(
      1,
      titleSimilarity * 0.62 +
        aliasSimilarity * 0.22 +
        jejuLocationBonus +
        keywordBonus -
        broadTitlePenalty,
    ),
  );

  return {
    titleSimilarity,
    aliasSimilarity,
    jejuLocationBonus,
    keywordBonus,
    broadTitlePenalty,
    total,
  };
}

/** Score a search-list gallery title (no image row yet). */
export function scoreSearchListGalleryTitle(ctx: PoiMatchContext, galleryTitle: string | null): number {
  const titleSimilarity = bestTitleSimilarityAgainstPoi(ctx, galleryTitle);
  let broadTitlePenalty = 0;
  if (isLikelyBroadGalleryTitle(galleryTitle)) broadTitlePenalty = 0.12;
  return Math.max(0, Math.min(1, titleSimilarity * 0.88 - broadTitlePenalty));
}

/**
 * Reject when location explicitly contradicts Jeju (non-Korean overseas-looking with no Jeju signal)
 * and title match is weak.
 */
export function shouldRejectWeakNonJeju(
  ctx: PoiMatchContext,
  c: JejuGalleryCandidate,
  breakdown: JejuGalleryScoreBreakdown,
): boolean {
  const loc = c.photographyLocation?.trim();
  if (!loc) return false;
  if (isJejuLikelyLocation(loc)) return false;
  if (/[가-힣]/.test(loc)) return false;
  if (breakdown.titleSimilarity >= 0.9) return false;
  return breakdown.total < 0.45;
}
