/**
 * Kakao × Google merge (§5.7 R-3, spec K1/K7).
 *
 * 🔴 KAKAO IS THE IDENTITY OF RECORD. `place_key = 'kakao:<id>'`, and an
 * unmatched Google place is DROPPED — not stored, not rendered. The reason is
 * concrete, not aesthetic: without a Kakao id there is no Kakao Map deep link,
 * and the deep link is this card's ONLY navigation affordance (K7 forbids
 * plotting Kakao POIs on a non-Kakao map, and a Google-sourced pin would need a
 * Google map). A row we cannot navigate to is a row we cannot show.
 *
 * Unmatched Kakao places DO survive, with `rating: null`. "Google didn't have
 * it" is not the same as "it's bad" — in a rural cell that may be every
 * restaurant there is, and `qualityFilter`'s K1 fallback exists for exactly
 * that case.
 *
 * Matching is intentionally strict (≤ 40 m AND a name-similarity floor):
 * Korean food streets stack five restaurants in one building, so distance
 * alone would happily glue a rating onto the wrong business.
 *
 * The pure helpers are exported for tests; only the type imports touch the io
 * modules, so importing this file pulls in no fetch surface.
 */

import { haversineM } from '@/lib/tour-room/geo';
import { cuisineLeaf } from '@/lib/ops/dining/cuisine';
import { encodeGeohash } from '@/lib/ops/dining/geohash';
import type { CachedPlace } from '@/lib/ops/dining/places';
import type { GooglePlace, GoogleReviewText } from '@/lib/ops/dining/google.server';
import type { KakaoPlaceDoc } from '@/lib/ops/dining/kakao.server';

/** Same-building tolerance for calling two rows the same business. */
export const MERGE_MAX_DISTANCE_M = 40;
/** Token-overlap floor (Dice coefficient over character bigrams). */
export const MERGE_MIN_NAME_SIMILARITY = 0.6;

/**
 * Strip everything that differs between the two sources' spelling of the same
 * business: whitespace, punctuation, and the branch suffix (제주점 / 本店 / …).
 */
export function normalizeName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .toLowerCase()
    .normalize('NFKC')
    // Branch suffixes: "…점" / "…店" / "… branch" / "… store".
    .replace(/\s*(본점|직영점|[가-힣a-z0-9]*점)\s*$/u, '')
    .replace(/\s*(本店|分店|[\p{Script=Han}]*店)\s*$/u, '')
    .replace(/\s*\b(branch|store|location)\b\s*$/u, '')
    // Bracketed qualifiers Google likes to append.
    .replace(/[([{][^)\]}]*[)\]}]/gu, '')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim();
}

function bigrams(value: string): string[] {
  if (value.length <= 1) return value ? [value] : [];
  const out: string[] = [];
  for (let i = 0; i < value.length - 1; i += 1) out.push(value.slice(i, i + 2));
  return out;
}

/**
 * Dice coefficient over character bigrams — 1 for identical strings, ~0 for
 * unrelated ones, and tolerant of the transliteration noise we actually see
 * ("Heukdwaeji Garden" vs "흑돼지가든" score 0 and correctly fail to match; the
 * real matches are Korean-vs-Korean with a suffix difference).
 */
export function nameSimilarity(a: string, b: string): number {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }

  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);
  if (leftGrams.length === 0 || rightGrams.length === 0) return 0;

  const pool = new Map<string, number>();
  for (const gram of leftGrams) pool.set(gram, (pool.get(gram) ?? 0) + 1);

  let hits = 0;
  for (const gram of rightGrams) {
    const count = pool.get(gram) ?? 0;
    if (count > 0) {
      pool.set(gram, count - 1);
      hits += 1;
    }
  }
  return (2 * hits) / (leftGrams.length + rightGrams.length);
}

/** True when the two rows are confidently the same business. */
export function isSameBusiness(kakao: KakaoPlaceDoc, google: GooglePlace): boolean {
  const distance = haversineM(
    { latitude: kakao.y, longitude: kakao.x },
    { latitude: google.lat, longitude: google.lng },
  );
  if (distance > MERGE_MAX_DISTANCE_M) return false;
  return nameSimilarity(kakao.place_name, google.displayName ?? '') >= MERGE_MIN_NAME_SIMILARITY;
}

/**
 * The verified-positive tag vocabulary (spec §1.2).
 *
 * 🔴 `halal` and `vegan` come ONLY from the business's own name/category. There
 * is no API field for either, and inferring them would be a fabricated safety
 * claim (see cuisine.ts header). `vegetarian_friendly` may additionally come
 * from Google's explicit `servesVegetarianFood: true`.
 */
export function deriveTags(kakao: KakaoPlaceDoc, google: GooglePlace | null): string[] {
  const tags = new Set<string>();
  const text = `${kakao.place_name} ${kakao.category_name ?? ''}`.toLowerCase();

  const saysVegan = /비건|vegan|純素|纯素/.test(text);
  const saysVegetarian = saysVegan || /채식|베지|vegetarian|素食/.test(text);
  const saysHalal = /할랄|halal|무슬림|muslim|清真/.test(text);

  if (saysVegan) tags.add('vegan');
  if (saysVegetarian || google?.servesVegetarianFood === true) tags.add('vegetarian_friendly');
  if (saysHalal) tags.add('halal');

  if (google?.goodForChildren === true || google?.menuForChildren === true) tags.add('kids_ok');
  if (google?.takeout === true) tags.add('takeout');
  if (google?.dineIn === true) tags.add('dine_in');
  if (google?.hasParking) tags.add('parking');
  if (google?.reservable === true) tags.add('reservable');
  if (kakao.category_group_code === 'CE7') tags.add('cafe');

  return [...tags].sort();
}

/**
 * The review text bundle handed to the menu extractor (spec K3).
 *
 * PURE on purpose — the LLM call lives in translate.server.ts. What this does
 * is bound the input: at most `maxReviews` reviews, each truncated, joined with
 * a separator the prompt can point at. The critic pass later re-checks every
 * proposed dish against this exact string, so it doubles as the ground truth
 * for "was this dish actually mentioned?".
 */
export function extractSignatureMenus(
  reviews: GoogleReviewText[] | null | undefined,
  opts: { maxReviews?: number; maxCharsPerReview?: number } = {},
): string {
  const maxReviews = opts.maxReviews ?? 5;
  const maxChars = opts.maxCharsPerReview ?? 400;
  if (!Array.isArray(reviews) || reviews.length === 0) return '';
  return reviews
    .slice(0, maxReviews)
    .map((review) => String(review?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, maxChars))
    .filter(Boolean)
    .join('\n---\n');
}

export interface MergedPlace extends CachedPlace {
  /** Review bundle for the (later) menu-extraction step — not persisted as-is. */
  review_text: string;
}

export interface MergeOptions {
  /** Search centre; when given, `distance_m` is filled for every row. */
  centerLat?: number;
  centerLng?: number;
  cellPrecision?: number;
}

/**
 * Merge one collection round into cache-row shape.
 *
 * Google places are consumed greedily (each can enrich at most one Kakao row),
 * best-similarity first, so a food-street cluster cannot double-attach.
 */
export function mergeKakaoGoogle(
  kakaoDocs: KakaoPlaceDoc[],
  googlePlaces: GooglePlace[],
  options: MergeOptions = {},
): MergedPlace[] {
  const kakao = Array.isArray(kakaoDocs) ? kakaoDocs.filter(Boolean) : [];
  const google = Array.isArray(googlePlaces) ? googlePlaces.filter(Boolean) : [];
  const claimed = new Set<string>();
  const out: MergedPlace[] = [];
  const seenKeys = new Set<string>();

  for (const doc of kakao) {
    const placeKey = `kakao:${doc.id}`;
    if (seenKeys.has(placeKey)) continue;
    seenKeys.add(placeKey);

    let best: GooglePlace | null = null;
    let bestScore = 0;
    for (const candidate of google) {
      if (claimed.has(candidate.id)) continue;
      if (!isSameBusiness(doc, candidate)) continue;
      const score = nameSimilarity(doc.place_name, candidate.displayName ?? '');
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    if (best) claimed.add(best.id);

    let distance = typeof doc.distance === 'number' && Number.isFinite(doc.distance) ? Math.round(doc.distance) : null;
    if (
      distance === null &&
      typeof options.centerLat === 'number' &&
      typeof options.centerLng === 'number' &&
      Number.isFinite(options.centerLat) &&
      Number.isFinite(options.centerLng)
    ) {
      distance = Math.round(
        haversineM(
          { latitude: options.centerLat, longitude: options.centerLng },
          { latitude: doc.y, longitude: doc.x },
        ),
      );
    }

    out.push({
      place_key: placeKey,
      cell: encodeGeohash(doc.y, doc.x, options.cellPrecision),
      search_cells: [],
      name: doc.place_name,
      name_i18n: null,
      category_group: doc.category_group_code || 'FD6',
      category_name: doc.category_name,
      cuisine: cuisineLeaf(doc.category_name),
      road_address: doc.road_address_name,
      address: doc.address_name,
      phone: doc.phone,
      place_url: doc.place_url,
      lat: doc.y,
      lng: doc.x,
      rating: best?.rating ?? null,
      review_count: best?.userRatingCount ?? null,
      price_band: best?.priceBand ?? null,
      tags: deriveTags(doc, best),
      signature_menus: [],
      open_hours: (best?.regularOpeningHours as CachedPlace['open_hours']) ?? null,
      google_place_id: best?.id ?? null,
      quality_score: 0,
      is_blocked: false,
      is_closed: false,
      reported_wrong_count: 0,
      distance_m: distance,
      review_text: extractSignatureMenus(best?.reviews),
    });
  }

  return out;
}
