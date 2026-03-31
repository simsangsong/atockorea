/**
 * KorService2 search/detail scoring helpers (curated + top + all imports).
 * Recommendation batch scores for DB live in ./recommendation-scoring.ts.
 */

import type { TourApiSearchItem } from './types';
import { normalizeKoreanPlaceName } from './normalize';

/**
 * Merge detailCommon2 first item into list item (prefer non-empty detail fields).
 */
export function mergeDetailCommonIntoItem(
  base: TourApiSearchItem,
  detail: Record<string, unknown>,
): TourApiSearchItem {
  const out: TourApiSearchItem = { ...base };
  const prefer = (key: string) => {
    const v = detail[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      (out as Record<string, unknown>)[key] = v;
    }
  };
  prefer('title');
  prefer('addr1');
  prefer('addr2');
  prefer('firstimage');
  prefer('firstimage2');
  prefer('mapx');
  prefer('mapy');
  prefer('tel');
  prefer('overview');
  prefer('homepage');
  prefer('zipcode');
  prefer('readcount');
  return out;
}

export type ScoreSearchCandidateArgs = {
  item: TourApiSearchItem;
  sourceName: string;
  normalizedSource: string;
};

/**
 * Match strength between searchKeyword2 item and curated source label (0–100).
 */
export function scoreSearchCandidate(args: ScoreSearchCandidateArgs): {
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  const titleRaw = String(args.item.title ?? '').trim();
  if (!titleRaw) {
    return { score: 0, reasons: ['empty_title'] };
  }
  const title = normalizeKoreanPlaceName(titleRaw);
  const src = args.normalizedSource;
  const srcTokens = new Set(
    src
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0),
  );

  if (title === src) {
    return { score: 100, reasons: ['exact_norm_match'] };
  }
  if (title.includes(src) || src.includes(title)) {
    return { score: 88, reasons: ['substring_norm_match'] };
  }

  let overlap = 0;
  for (const tok of title.split(/\s+/)) {
    const t = tok.trim();
    if (t.length >= 2 && srcTokens.has(t)) overlap += 1;
  }
  if (overlap > 0) {
    const score = Math.min(78, 42 + overlap * 14);
    reasons.push(`token_overlap:${overlap}`);
    return { score, reasons };
  }

  let subHits = 0;
  for (const st of srcTokens) {
    if (st.length >= 2 && title.includes(st)) subHits += 1;
  }
  if (subHits > 0) {
    const score = Math.min(65, 28 + subHits * 12);
    reasons.push(`partial_token_hits:${subHits}`);
    return { score, reasons };
  }

  reasons.push('weak_match');
  return { score: 18, reasons };
}

export type TieStats = {
  topScore: number;
  secondScore: number;
};

/**
 * Sorted-desc scores → top and second (for tie-break hints).
 */
export function computeTieStats(scores: number[]): TieStats {
  if (scores.length === 0) return { topScore: 0, secondScore: 0 };
  const s = [...scores].sort((a, b) => b - a);
  return { topScore: s[0] ?? 0, secondScore: s[1] ?? 0 };
}

export type IntroPreviewBonusArgs = {
  hasUseTime: boolean;
  hasFee: boolean;
};

/**
 * Small bonus when intro-derived time/fee fields exist.
 */
export function bonusFromIntroPreview(args: IntroPreviewBonusArgs): {
  add: number;
  reasons: string[];
} {
  let add = 0;
  const reasons: string[] = [];
  if (args.hasUseTime) {
    add += 5;
    reasons.push('bonus:useTime');
  }
  if (args.hasFee) {
    add += 5;
    reasons.push('bonus:fee');
  }
  return { add, reasons };
}

/** DB 배치 추천 점수(제주 POI) — 구현은 recommendation-scoring.ts, 여기서 재export */
export * from './recommendation-scoring';
