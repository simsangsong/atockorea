/**
 * Heuristic confidence for trying `galleryDetailList1` with POI title directly (cheap path).
 */

import { normalizeTitleForPhotoSkip } from '@/lib/jeju-photo-gallery/skip-rules';

const GENERIC_ONLY = new Set(
  ['제주', '제주도', '제주특별자치도', '서귀포', '서귀포시', '제주시', '한라산', '성산일출봉'].map((s) =>
    normalizeTitleForPhotoSkip(s),
  ),
);

/**
 * Returns 0–1. High values: substantive unique titles; low: empty, very short, or generic region-only labels.
 */
export function computePoiTitleConfidenceForDirectDetail(title: string | null | undefined): number {
  const t = title?.trim();
  if (!t) return 0;
  const norm = normalizeTitleForPhotoSkip(t);
  if (!norm) return 0;
  if (GENERIC_ONLY.has(norm)) return 0.35;
  let score = 0.55;
  if (norm.length >= 4) score += 0.15;
  if (norm.length >= 8) score += 0.15;
  if (/[가-힣]{3,}/u.test(t) && norm.length >= 3) score += 0.1;
  return Math.min(1, score);
}

export const JEJU_DIRECT_DETAIL_MIN_CONFIDENCE = 0.72;
