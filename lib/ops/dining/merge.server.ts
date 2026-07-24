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
 * Matching is strict on DISTANCE (≤ 40 m, or ≤ 120 m for a near-identical name):
 * Korean food streets stack five restaurants in one building, so distance alone
 * would happily glue a rating onto the wrong business. It is deliberately
 * forgiving on SPELLING, because the two sources disagree about spelling for
 * reasons that carry no information — a branch suffix ("프릳츠 제주성산점" vs
 * "프릳츠 제주 성산"), a location qualifier the whole cell shares ("성산일출봉
 * 청운식당" vs "청운식당"), or a latin brand tag ("꽃담수제버거 GreenroofJeju").
 * Rejecting those cost us 15 of 20 rated Google places at Seongsan.
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
/** Name-similarity floor inside `MERGE_MAX_DISTANCE_M`. */
export const MERGE_MIN_NAME_SIMILARITY = 0.6;

/**
 * Place qualifiers that are noise inside a Korean business name. One source
 * writes "성산일출봉 청운식당" and the other writes "청운식당"; neither syllable of
 * "성산" tells us anything about *which* business this is, because every row in
 * the cell shares it.
 *
 * 🔴 Stripping these is only safe while something meaningful survives — "제주"
 * on its own is a business name, and reducing it to '' would match it against
 * everything in the cell. `reduceQualifiers` may return '', and every caller
 * must decide what to do with that (see `MIN_QUALIFIER_RESIDUAL`).
 *
 * Longest first so "성산일출봉" is consumed before "성산" can bite a hole in it.
 * Adding an entry trades yield against collision risk: two different businesses
 * that differ ONLY by qualifier ("제주김밥" vs "성산김밥") collapse to the same
 * string. The 40 m gate is what keeps that bounded.
 */
const LOCATION_QUALIFIERS: readonly string[] = [
  '성산일출봉', '제주국제공항', '제주공항', '성산포', '서귀포', '성산',
  '제주도', '제주시', '제주', '중문', '애월', '함덕', '협재', '표선', '한림', '우도',
  '해운대', '광안리', '남포동', '부산',
  '인사동', '명동', '강남', '홍대', '서울',
  '경주', '전주', '강릉', '속초', '여수',
].sort((a, b) => b.length - a.length);

/** Branch markers, matched AFTER qualifier reduction ("제주성산점" → "점"). */
const BRANCH_MARKERS = new Set([
  '점', '본점', '직영점', '지점',
  '店', '本店', '分店',
  'branch', 'store', 'location',
]);

/** A qualifier residual shorter than this is not distinctive enough to trust. */
const MIN_QUALIFIER_RESIDUAL = 2;

const HANGUL = /[가-힣]/;
const LATIN_ONLY = /^[a-z0-9]+$/;

/** Remove every known place qualifier. May legitimately return ''. */
function reduceQualifiers(token: string): string {
  let out = token;
  for (const qualifier of LOCATION_QUALIFIERS) {
    if (out.includes(qualifier)) out = out.split(qualifier).join('');
  }
  return out;
}

/**
 * Split a raw name into comparable tokens: lowercase + NFKC, bracketed asides
 * dropped, punctuation treated as a separator, branch markers removed, and a
 * trailing latin brand tag ("꽃담수제버거 GreenroofJeju") popped — but only while
 * a Hangul token survives, so a genuinely latin name ("Olle Guksu") is kept whole.
 */
function cleanTokens(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  const tokens = raw
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[([{][^)\]}]*[)\]}]/gu, ' ')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .split(/\s+/u)
    .filter(Boolean);
  if (tokens.length === 0) return [];

  let kept = tokens.filter((token) => !BRANCH_MARKERS.has(reduceQualifiers(token)));
  // A name that is *only* a branch marker keeps its original spelling rather
  // than normalizing to '' (which would score 0 against everything).
  if (kept.length === 0) kept = tokens;

  while (
    kept.length > 1 &&
    LATIN_ONLY.test(kept[kept.length - 1]) &&
    kept.slice(0, -1).some((token) => HANGUL.test(token))
  ) {
    kept = kept.slice(0, -1);
  }
  return kept;
}

/**
 * Canonical compact spelling — whitespace and punctuation gone, branch marker
 * gone. Location qualifiers are deliberately KEPT here; `nameSimilarity` scores
 * the qualifier-free form separately and takes the better of the two, so
 * stripping can only ever raise a score, never lose a true match.
 */
export function normalizeName(raw: unknown): string {
  return cleanTokens(raw).join('');
}

/** Tokens with place qualifiers removed; '' residuals fall back to the original. */
export function qualifierFreeTokens(raw: unknown): string[] {
  const base = cleanTokens(raw);
  const distinctive = base.filter((token) => reduceQualifiers(token) !== '');
  // Every token was a qualifier → the place name really is a place name.
  const source = distinctive.length > 0 ? distinctive : base;
  return source.map((token) => {
    const reduced = reduceQualifiers(token);
    return reduced.length >= MIN_QUALIFIER_RESIDUAL ? reduced : token;
  });
}

function bigrams(value: string): string[] {
  if (value.length <= 1) return value ? [value] : [];
  const out: string[] = [];
  for (let i = 0; i < value.length - 1; i += 1) out.push(value.slice(i, i + 2));
  return out;
}

/** Dice coefficient over a multiset. */
function dice(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const pool = new Map<string, number>();
  for (const item of left) pool.set(item, (pool.get(item) ?? 0) + 1);

  let hits = 0;
  for (const item of right) {
    const count = pool.get(item) ?? 0;
    if (count > 0) {
      pool.set(item, count - 1);
      hits += 1;
    }
  }
  return (2 * hits) / (left.length + right.length);
}

/**
 * Score two compact spellings: whole-string containment OR character-bigram
 * Dice, whichever is kinder.
 *
 * 🔴 The `max` is the bug fix. The old version *returned* the containment ratio
 * as soon as one string contained the other, which for "해녀의집" inside
 * "성산어촌계해녀의집" is 4/9 = 0.44 — below the floor — even though the bigram
 * score for the same pair is 0.67. Containment short-circuiting a higher score
 * is what threw away true matches.
 */
function scorePair(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const containment =
    left.includes(right) || right.includes(left)
      ? Math.min(left.length, right.length) / Math.max(left.length, right.length)
      : 0;
  return Math.max(containment, dice(bigrams(left), bigrams(right)));
}

/**
 * How confident are we that these two spellings are one business? 1 for
 * identical, ~0 for unrelated.
 *
 * Three views, best of: the raw compact spelling, the qualifier-free compact
 * spelling, and token overlap. Token overlap is what rescues names where the
 * extra material is a whole word — "해일리 베이커리 카페" vs "해일리 카페" shares
 * two of three tokens (0.80) but is only 0.47 as one string.
 *
 * Transliteration is still (correctly) not matched: "Heukdwaeji Garden" vs
 * "흑돼지가든" shares no character, and inventing a romanization table here would
 * merge ratings onto the wrong business.
 */
export function nameSimilarity(a: string, b: string): number {
  const rawLeft = normalizeName(a);
  const rawRight = normalizeName(b);
  if (!rawLeft || !rawRight) return 0;

  const tokensLeft = qualifierFreeTokens(a);
  const tokensRight = qualifierFreeTokens(b);

  return Math.max(
    scorePair(rawLeft, rawRight),
    scorePair(tokensLeft.join(''), tokensRight.join('')),
    dice(tokensLeft, tokensRight),
  );
}

/**
 * True when the two rows are confidently the same business.
 *
 * 🔴 Distance stays a FLAT hard gate at 40 m, and that is a measured decision,
 * not an oversight. A tiered gate (40–120 m for a near-identical name) was
 * built and probed against Seongsan, Daepo Jusangjeolli and Jeju Cruise Port:
 * it matched ZERO additional places at all three. Distance was never what threw
 * the candidates away — 17 of 20 rated Google places at Seongsan already had a
 * Kakao doc inside 40 m, and it was the name score that rejected them. Widening
 * a safety gate that buys nothing is pure downside: Korean food streets stack
 * five restaurants in one building, and every extra metre is another chance to
 * glue a 4.8★ rating onto the wrong business.
 */
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
