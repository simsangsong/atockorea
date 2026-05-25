/**
 * Pure similarity scoring for tour recommendations.
 *
 * Used by:
 *   - app/tour-product/[slug]/page.tsx     → detail-page "You might also like"
 *   - app/api/mypage/extras/route.ts       → /mypage bottom recommendations
 *
 * Goal: replace the previous "same region first, slice(0,6)" heuristic
 * (which produced the same 6 cards every time) with a scored ranking
 * that mixes region affinity, theme/badge overlap, duration similarity,
 * price-band proximity, and popularity tiebreak — plus a diversity
 * guard that caps how many slots a single region can occupy.
 */

const STOPWORD_TOKENS = new Set([
  "and",
  "the",
  "from",
  "with",
  "for",
  "tour",
  "tours",
  "day",
  "trip",
  "guide",
  "excursion",
  "pickup",
  "return",
]);

const STRUCTURAL_SEPARATORS = /[\s()→&+\-,/·•|;:　（）]+/u;

function tokenize(value: string | null | undefined, minLen = 3): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .split(STRUCTURAL_SEPARATORS)
    .map((t) => t.trim())
    .filter((t) => t.length >= minLen && !STOPWORD_TOKENS.has(t));
}

function tokenSet(values: ReadonlyArray<string> | string | null | undefined, minLen = 3): Set<string> {
  const arr = Array.isArray(values) ? values : values ? [values] : [];
  const out = new Set<string>();
  for (const v of arr) {
    for (const tok of tokenize(v, minLen)) out.add(tok);
  }
  return out;
}

function jaccardOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter;
}

function parseDurationHours(duration: string | null | undefined): number {
  if (!duration) return 0;
  const m = duration.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour|hours|시간|小时|小時|時間|hora|horas)/i);
  if (m) return Number(m[1]);
  const days = duration.match(/(\d+)\s*(?:day|days|일|天|日|día|días)/i);
  if (days) return Number(days[1]) * 8;
  return 0;
}

function dominantRegionToken(region: string | null | undefined): string {
  const tokens = tokenize(region, 3);
  return tokens[0] ?? (region ?? "").toLowerCase().trim();
}

export type TourSimilarityAnchor = {
  slug: string;
  region: string;
  badges?: readonly string[];
  duration?: string;
  listPriceUsd?: number;
};

export type TourSimilarityCandidate = TourSimilarityAnchor & {
  rating?: number;
  reviewCount?: number;
};

export type ScoreBreakdown = {
  region: number;
  badge: number;
  duration: number;
  price: number;
  total: number;
};

export function scoreTourSimilarity(
  anchor: TourSimilarityAnchor,
  candidate: TourSimilarityAnchor,
): ScoreBreakdown {
  if (candidate.slug === anchor.slug) {
    return { region: 0, badge: 0, duration: 0, price: 0, total: -1 };
  }

  const regionOverlap = jaccardOverlap(
    tokenSet(anchor.region, 3),
    tokenSet(candidate.region, 3),
  );
  const region = regionOverlap * 4;

  const badgeOverlap = jaccardOverlap(
    tokenSet(anchor.badges ?? [], 4),
    tokenSet(candidate.badges ?? [], 4),
  );
  const badge = Math.min(badgeOverlap * 3, 12);

  const aH = parseDurationHours(anchor.duration);
  const cH = parseDurationHours(candidate.duration);
  let duration = 0;
  if (aH > 0 && cH > 0) {
    const diff = Math.abs(aH - cH);
    if (diff <= 1) duration = 5;
    else if (diff <= 3) duration = 3;
    else if (diff <= 5) duration = 1;
  }

  let price = 0;
  const aP = anchor.listPriceUsd ?? 0;
  const cP = candidate.listPriceUsd ?? 0;
  if (aP > 0 && cP > 0) {
    const ratio = cP / aP;
    if (ratio >= 0.8 && ratio <= 1.25) price = 4;
    else if (ratio >= 0.6 && ratio <= 1.6) price = 2;
  }

  return { region, badge, duration, price, total: region + badge + duration + price };
}

function popularityWeight(c: TourSimilarityCandidate): number {
  const r = typeof c.rating === "number" ? c.rating : 0;
  const n = typeof c.reviewCount === "number" ? c.reviewCount : 0;
  return r * Math.log(1 + Math.max(n, 0));
}

export type PickTourRecommendationsOptions = {
  k?: number;
  /** Max picks allowed from the same dominant region token. Default 3. */
  perRegionCap?: number;
};

export function pickTourRecommendations<T extends TourSimilarityCandidate>(
  anchor: TourSimilarityAnchor,
  candidates: readonly T[],
  options: PickTourRecommendationsOptions = {},
): T[] {
  const { k = 6, perRegionCap = 3 } = options;
  if (k <= 0 || candidates.length === 0) return [];

  const ranked = candidates
    .filter((c) => c.slug !== anchor.slug && (c.listPriceUsd ?? 0) > 0)
    .map((tour) => ({
      tour,
      score: scoreTourSimilarity(anchor, tour).total,
      popularity: popularityWeight(tour),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.popularity - a.popularity;
    });

  const picks: T[] = [];
  const seenSlugs = new Set<string>();
  const regionTokenCounts: Record<string, number> = {};

  // Pass 1: scored picks with diversity guard.
  for (const { tour } of ranked) {
    if (picks.length >= k) break;
    if (seenSlugs.has(tour.slug)) continue;
    const tok = dominantRegionToken(tour.region);
    if ((regionTokenCounts[tok] ?? 0) >= perRegionCap) continue;
    picks.push(tour);
    seenSlugs.add(tour.slug);
    regionTokenCounts[tok] = (regionTokenCounts[tok] ?? 0) + 1;
  }

  // Pass 2: relax diversity if we still don't have enough.
  if (picks.length < k) {
    for (const { tour } of ranked) {
      if (picks.length >= k) break;
      if (seenSlugs.has(tour.slug)) continue;
      picks.push(tour);
      seenSlugs.add(tour.slug);
    }
  }

  return picks;
}

/**
 * Build an anchor representing the user's affinity from their booked /
 * wishlisted tours — used by mypage recommendations when there is no
 * single "current tour" to score against.
 *
 * The anchor is a synthetic tour with the most frequent tokens from
 * each field across the signal. If signal is empty the function
 * returns null, and callers should fall back to popularity ranking.
 */
export type UserSignalEntry = {
  region?: string | null;
  city?: string | null;
  duration?: string | null;
  badges?: readonly string[] | null;
  listPriceUsd?: number | null;
};

export function buildUserAffinityAnchor(
  entries: readonly UserSignalEntry[],
): TourSimilarityAnchor | null {
  if (entries.length === 0) return null;

  const regionCounts = new Map<string, number>();
  const badgeCounts = new Map<string, number>();
  const durations: number[] = [];
  const prices: number[] = [];

  for (const e of entries) {
    for (const t of tokenize(e.region ?? "", 3)) {
      regionCounts.set(t, (regionCounts.get(t) ?? 0) + 1);
    }
    for (const t of tokenize(e.city ?? "", 3)) {
      regionCounts.set(t, (regionCounts.get(t) ?? 0) + 1);
    }
    if (e.badges) {
      for (const b of e.badges) {
        for (const t of tokenize(b, 4)) {
          badgeCounts.set(t, (badgeCounts.get(t) ?? 0) + 1);
        }
      }
    }
    const h = parseDurationHours(e.duration ?? "");
    if (h > 0) durations.push(h);
    const p = typeof e.listPriceUsd === "number" ? e.listPriceUsd : 0;
    if (p > 0) prices.push(p);
  }

  if (regionCounts.size === 0 && badgeCounts.size === 0 && durations.length === 0 && prices.length === 0) {
    return null;
  }

  const topRegionToken = [...regionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const topBadges = [...badgeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t]) => t);

  const avgDuration = durations.length > 0
    ? durations.reduce((s, n) => s + n, 0) / durations.length
    : 0;
  const avgPrice = prices.length > 0
    ? prices.reduce((s, n) => s + n, 0) / prices.length
    : 0;

  return {
    slug: "__user_affinity__",
    region: topRegionToken,
    badges: topBadges,
    duration: avgDuration > 0 ? `${avgDuration.toFixed(1)} hours` : "",
    listPriceUsd: avgPrice,
  };
}
