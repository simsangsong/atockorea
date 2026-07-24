/**
 * Place shape, quality filter and ranking (§5.7 R-4).
 *
 * Deterministic by construction: `rankPlaces` reads NO clock and NO env — the
 * caller passes `nowMs` — so a ranking bug is always reproducible from the
 * inputs alone. That matters because the failure this feature must never have
 * is "we showed a closed restaurant / a place that conflicts with an allergy"
 * and those are exactly the paths a unit test can pin.
 *
 * Pure and client-safe: the chat client re-runs `rankPlaces` locally when the
 * guest toggles a dietary chip, so the same payload re-filters with zero
 * network (R-1 third intake path).
 */

import { haversineM } from '@/lib/tour-room/geo';
import { satisfiesPositively, violatesDietary } from '@/lib/ops/dining/cuisine';
import { evaluateHours, type RegularOpeningHours } from '@/lib/ops/dining/hours';

/** One `[{ name, name_i18n }]` entry of `signature_menus`. */
export interface SignatureMenu {
  name: string;
  name_i18n?: Record<string, string> | null;
}

/** Mirrors an `ops_kakao_place_cache` row (plus read-time annotations). */
export interface CachedPlace {
  place_key: string;
  cell: string;
  search_cells?: string[];
  name: string;
  name_i18n?: Record<string, string> | null;
  category_group: string;
  category_name?: string | null;
  cuisine?: string | null;
  road_address?: string | null;
  address?: string | null;
  phone?: string | null;
  place_url: string;
  lat: number;
  lng: number;
  rating?: number | null;
  review_count?: number | null;
  price_band?: number | null;
  tags?: string[] | null;
  signature_menus?: SignatureMenu[] | null;
  open_hours?: RegularOpeningHours | null;
  google_place_id?: string | null;
  quality_score?: number | null;
  is_blocked?: boolean | null;
  is_closed?: boolean | null;
  reported_wrong_count?: number | null;
  expires_at?: string | null;
  /** Annotated at read time against the search centre — not stored. */
  distance_m?: number | null;
  /** Set by `qualityFilter` when the whole cell had no ratings (spec K1). */
  unrated?: boolean;
}

/** Aggregated `ops_restaurant_recommendations` counts for one place_key. */
export interface PlaceFeedback {
  tapped?: number;
  visited?: number;
  wrong?: number;
}

/** Quality bar (spec K1). A place must clear BOTH to be a normal candidate. */
export const MIN_RATING = 3.5;
export const MIN_REVIEWS = 10;
/** Guests are told at most this many options — more is a menu, not advice. */
export const MAX_RESULTS = 5;
/** Reported wrong this many times → hidden from serving (spec K6). */
export const WRONG_REPORT_HIDE_AT = 3;
/** Comfortable walking pace including crossings/waiting. */
export const WALK_METRES_PER_MINUTE = 80;

/** `rating × log10(reviews + 1)` — rewards both a high score and a big sample. */
export function placeQualityScore(place: Pick<CachedPlace, 'rating' | 'review_count'>): number {
  const rating = typeof place.rating === 'number' && Number.isFinite(place.rating) ? place.rating : 0;
  const reviews =
    typeof place.review_count === 'number' && Number.isFinite(place.review_count) ? Math.max(0, place.review_count) : 0;
  return rating * Math.log10(reviews + 1);
}

/** Walking minutes for a distance in metres (≥1 whenever there is a distance). */
export function walkMinutes(distanceM: number | null | undefined): number | null {
  if (typeof distanceM !== 'number' || !Number.isFinite(distanceM) || distanceM < 0) return null;
  return Math.max(1, Math.ceil(distanceM / WALK_METRES_PER_MINUTE));
}

function hasRating(place: CachedPlace): boolean {
  return (
    typeof place.rating === 'number' &&
    Number.isFinite(place.rating) &&
    typeof place.review_count === 'number' &&
    Number.isFinite(place.review_count)
  );
}

export interface QualityFilterOptions {
  minRating?: number;
  minReviews?: number;
}

export interface QualityFilterResult {
  places: CachedPlace[];
  /**
   * true when the whole candidate set was unrated and we fell back to distance
   * order (spec K1). The card MUST show the "we couldn't check reviews" badge
   * in this case — silently presenting unvetted places as picks is dishonest.
   */
  unrated: boolean;
}

/**
 * rating ≥ 3.5 AND reviews ≥ 10 — with the K1 escape hatch: if NOT ONE
 * candidate carries a rating (a rural cell where Google matched nothing), fall
 * back to distance order and flag the whole set `unrated` rather than returning
 * an empty card. A mixed set keeps only the rated survivors.
 */
export function qualityFilter(places: CachedPlace[], opts: QualityFilterOptions = {}): QualityFilterResult {
  const list = Array.isArray(places) ? places.filter(Boolean) : [];
  if (list.length === 0) return { places: [], unrated: false };

  const minRating = opts.minRating ?? MIN_RATING;
  const minReviews = opts.minReviews ?? MIN_REVIEWS;

  if (!list.some(hasRating)) {
    const byDistance = list
      .slice()
      .sort((a, b) => (a.distance_m ?? Number.POSITIVE_INFINITY) - (b.distance_m ?? Number.POSITIVE_INFINITY))
      .map((place) => ({ ...place, unrated: true as const }));
    return { places: byDistance, unrated: true };
  }

  const kept = list.filter(
    (place) => hasRating(place) && (place.rating as number) >= minRating && (place.review_count as number) >= minReviews,
  );
  return { places: kept, unrated: false };
}

/** Ranking weights (§5.7 R-4) — named so a tuning change is auditable. */
export const RANK_WEIGHTS = {
  dietaryFit: 0.6,
  proximity: 0.4,
  visited: 0.3,
  tapped: 0.1,
  wrong: -1.0,
  closedPenalty: -2.0,
} as const;

/** Full credit within 400 m, decaying to zero at 800 m. */
export function proximityBonus(distanceM: number | null | undefined): number {
  if (typeof distanceM !== 'number' || !Number.isFinite(distanceM)) return 0;
  if (distanceM <= 400) return 1;
  if (distanceM >= 800) return 0;
  return (800 - distanceM) / 400;
}

/**
 * Fraction of the requested restrictions this place *positively* satisfies.
 * Only vegetarian/vegan/halal/kids can ever contribute (see cuisine.ts) — for
 * everything else the bonus is structurally 0 and the hard exclusion does the
 * work.
 */
export function dietaryFitBonus(place: CachedPlace, dietary: readonly string[]): number {
  if (!Array.isArray(dietary) || dietary.length === 0) return 0;
  let hits = 0;
  for (const tag of dietary) if (satisfiesPositively(place, tag)) hits += 1;
  return hits / dietary.length;
}

export function feedbackBonus(feedback: PlaceFeedback | undefined): number {
  if (!feedback) return 0;
  return (
    RANK_WEIGHTS.visited * (feedback.visited ?? 0) +
    RANK_WEIGHTS.tapped * (feedback.tapped ?? 0) +
    RANK_WEIGHTS.wrong * (feedback.wrong ?? 0)
  );
}

/** Hard exclusions (R-4) — nothing here is a score, they are all vetoes. */
export function isHardExcluded(place: CachedPlace, dietary: readonly string[]): boolean {
  if (place.is_blocked === true) return true;
  if (place.is_closed === true) return true;
  if ((place.reported_wrong_count ?? 0) >= WRONG_REPORT_HIDE_AT) return true;
  if (violatesDietary(place, dietary)) return true;
  return false;
}

export interface RankOptions {
  /** Applied restrictions (DietaryFilterTag values). */
  dietary?: readonly string[];
  /** Search centre — used to backfill `distance_m` when absent. */
  centerLat?: number | null;
  centerLng?: number | null;
  /** Evaluation moment (KST-aware inside hours.ts). Required for open/closed. */
  nowMs: number;
  /** place_key → aggregated feedback counts. */
  feedback?: Record<string, PlaceFeedback>;
  limit?: number;
}

export interface RankedPlace extends CachedPlace {
  score: number;
  distance_m: number | null;
  walk_min: number | null;
  open_today: boolean | null;
  closes_at: string | null;
}

/**
 * §R-4 in one pass: hard exclusions first, then the weighted score, capped at
 * five. Ties break on distance then place_key so the order is stable across
 * calls (a card that reshuffles on every poll looks broken).
 */
export function rankPlaces(places: CachedPlace[], options: RankOptions): RankedPlace[] {
  const list = Array.isArray(places) ? places.filter(Boolean) : [];
  const dietary = options.dietary ?? [];
  const limit = options.limit ?? MAX_RESULTS;
  const feedback = options.feedback ?? {};

  const hasCenter =
    typeof options.centerLat === 'number' &&
    Number.isFinite(options.centerLat) &&
    typeof options.centerLng === 'number' &&
    Number.isFinite(options.centerLng);

  const scored: RankedPlace[] = [];
  for (const place of list) {
    if (isHardExcluded(place, dietary)) continue;

    let distance = typeof place.distance_m === 'number' && Number.isFinite(place.distance_m) ? place.distance_m : null;
    if (distance === null && hasCenter && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
      distance = Math.round(
        haversineM(
          { latitude: options.centerLat as number, longitude: options.centerLng as number },
          { latitude: place.lat, longitude: place.lng },
        ),
      );
    }

    const hours = evaluateHours(place.open_hours, options.nowMs);
    // Unknown hours are NOT penalised — most rows have none, and punishing
    // missing data would rank every un-matched Kakao place off the card.
    const closedPenalty = hours.openToday === false ? RANK_WEIGHTS.closedPenalty : 0;

    const score =
      (typeof place.quality_score === 'number' && Number.isFinite(place.quality_score) && place.quality_score !== 0
        ? place.quality_score
        : placeQualityScore(place)) +
      RANK_WEIGHTS.dietaryFit * dietaryFitBonus(place, dietary) +
      RANK_WEIGHTS.proximity * proximityBonus(distance) +
      feedbackBonus(feedback[place.place_key]) +
      closedPenalty;

    scored.push({
      ...place,
      distance_m: distance,
      walk_min: walkMinutes(distance),
      open_today: hours.openToday,
      closes_at: hours.closesAt,
      score,
    });
  }

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const da = a.distance_m ?? Number.POSITIVE_INFINITY;
      const db = b.distance_m ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return a.place_key.localeCompare(b.place_key);
    })
    .slice(0, Math.max(0, limit));
}
