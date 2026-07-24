/**
 * Google Places (New) — the *quality* half of the hybrid collection (spec K1).
 *
 * Kakao knows which restaurants exist and how to deep-link them; Google knows
 * whether they are any good (rating, review count), what they cost, when they
 * are open, and the handful of verified positive attributes we are allowed to
 * act on (servesVegetarianFood, goodForChildren, menuForChildren).
 *
 * Reviews are requested for ONE reason: spec K3 — neither API exposes a menu,
 * and scraping Kakao's place page would be a ToS problem, so "대표 메뉴" can only
 * be dish names a reviewer literally wrote. The LLM step extracts them verbatim
 * and a critic pass deletes anything not present in the text.
 *
 * Every failure returns `[]`. Same silent-fallback contract as Kakao.
 */

import { noteQuotaCall, readQuotaState, type DailyQuotaState } from '@/lib/ops/dining/quota';

const GOOGLE_TIMEOUT_MS = 4_000;
const MAX_RESULT_COUNT = 20;

export const DEFAULT_GOOGLE_DAILY_CAP = 5_000;
export const GOOGLE_QUOTA_ALERT_RATIO = 0.7;

const GOOGLE_QUOTA_KEY = 'ops_dining:google_daily';
const DAY_SECONDS = 24 * 60 * 60;

export type GoogleQuotaState = DailyQuotaState;

export function googleDailyCap(): number {
  const raw = Number(process.env.OPS_DINING_GOOGLE_DAILY_CAP ?? DEFAULT_GOOGLE_DAILY_CAP);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_GOOGLE_DAILY_CAP;
}

function counterOptions() {
  return {
    key: GOOGLE_QUOTA_KEY,
    windowSec: DAY_SECONDS,
    cap: googleDailyCap(),
    alertRatio: GOOGLE_QUOTA_ALERT_RATIO,
  };
}

/** Count one outbound Places call. Never throws. */
export async function noteGoogleCall(): Promise<GoogleQuotaState> {
  return noteQuotaCall(counterOptions());
}

export async function googleQuotaState(): Promise<GoogleQuotaState> {
  return readQuotaState(counterOptions());
}

/**
 * Server key first: the public `NEXT_PUBLIC_*` key is HTTP-referrer restricted,
 * so it fails from a server context (the exact failure mode already documented
 * in reference_gmaps_blank_map_referrer). It stays last as a dev convenience.
 */
export function googleApiKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    null
  );
}

export function googleAvailable(): boolean {
  return Boolean(googleApiKey());
}

/** One review's text bundle (the only input the menu extractor is allowed). */
export interface GoogleReviewText {
  text: string;
  languageCode: string | null;
  rating: number | null;
}

/** The normalized Google place the merge step consumes. */
export interface GooglePlace {
  id: string;
  displayName: string | null;
  lat: number;
  lng: number;
  rating: number | null;
  userRatingCount: number | null;
  /** 1..4, mapped from PRICE_LEVEL_*. */
  priceBand: number | null;
  regularOpeningHours: Record<string, unknown> | null;
  primaryTypeDisplayName: string | null;
  servesVegetarianFood: boolean | null;
  goodForChildren: boolean | null;
  menuForChildren: boolean | null;
  takeout: boolean | null;
  dineIn: boolean | null;
  hasParking: boolean;
  reservable: boolean | null;
  googleMapsUri: string | null;
  reviews: GoogleReviewText[];
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.regularOpeningHours',
  'places.primaryTypeDisplayName',
  'places.servesVegetarianFood',
  'places.goodForChildren',
  'places.menuForChildren',
  'places.takeout',
  'places.dineIn',
  'places.parkingOptions',
  'places.reservable',
  'places.googleMapsUri',
  'places.reviews',
].join(',');

/** `PRICE_LEVEL_INEXPENSIVE` → 1 … `PRICE_LEVEL_VERY_EXPENSIVE` → 4. */
export function priceBandFromLevel(level: unknown): number | null {
  switch (level) {
    case 'PRICE_LEVEL_FREE':
    case 'PRICE_LEVEL_INEXPENSIVE':
      return 1;
    case 'PRICE_LEVEL_MODERATE':
      return 2;
    case 'PRICE_LEVEL_EXPENSIVE':
      return 3;
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return 4;
    default:
      return null;
  }
}

function localizedText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (value && typeof value === 'object') {
    const text = (value as { text?: unknown }).text;
    if (typeof text === 'string' && text.trim()) return text.trim();
  }
  return null;
}

function boolOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function normalizeGooglePlace(raw: Record<string, unknown>): GooglePlace | null {
  const id = typeof raw.id === 'string' ? raw.id : '';
  const location = raw.location as { latitude?: unknown; longitude?: unknown } | undefined;
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const rating = Number(raw.rating);
  const userRatingCount = Number(raw.userRatingCount);
  const parking = raw.parkingOptions;

  const reviewsRaw = Array.isArray(raw.reviews) ? raw.reviews : [];
  const reviews: GoogleReviewText[] = [];
  for (const entry of reviewsRaw) {
    const review = entry as { text?: unknown; originalText?: unknown; rating?: unknown };
    const text = localizedText(review.text) ?? localizedText(review.originalText);
    if (!text) continue;
    const languageCode =
      review.text && typeof review.text === 'object'
        ? ((review.text as { languageCode?: unknown }).languageCode as string | undefined) ?? null
        : null;
    const reviewRating = Number(review.rating);
    reviews.push({
      text,
      languageCode: typeof languageCode === 'string' ? languageCode : null,
      rating: Number.isFinite(reviewRating) ? reviewRating : null,
    });
  }

  return {
    id,
    displayName: localizedText(raw.displayName),
    lat,
    lng,
    rating: Number.isFinite(rating) ? rating : null,
    userRatingCount: Number.isFinite(userRatingCount) ? userRatingCount : null,
    priceBand: priceBandFromLevel(raw.priceLevel),
    regularOpeningHours:
      raw.regularOpeningHours && typeof raw.regularOpeningHours === 'object'
        ? (raw.regularOpeningHours as Record<string, unknown>)
        : null,
    primaryTypeDisplayName: localizedText(raw.primaryTypeDisplayName),
    servesVegetarianFood: boolOrNull(raw.servesVegetarianFood),
    goodForChildren: boolOrNull(raw.goodForChildren),
    menuForChildren: boolOrNull(raw.menuForChildren),
    takeout: boolOrNull(raw.takeout),
    dineIn: boolOrNull(raw.dineIn),
    hasParking: Boolean(parking && typeof parking === 'object' && Object.keys(parking).length > 0),
    reservable: boolOrNull(raw.reservable),
    googleMapsUri: typeof raw.googleMapsUri === 'string' ? raw.googleMapsUri : null,
    reviews,
  };
}

export interface GoogleNearbyArgs {
  lat: number;
  lng: number;
  radiusM: number;
}

/**
 * `POST places:searchNearby` over restaurants + cafes, popularity-ranked.
 *
 * 🔴 `languageCode: 'ko'` is load-bearing, not a preference. `displayName` has
 * exactly one consumer — `isSameBusiness()` in merge.server.ts — and there it is
 * the JOIN KEY against Kakao's Korean `place_name`. Asking Google for English
 * names meant comparing "Seongsan Sunrise Peak Cafe" to "성산일출봉 카페": the
 * bigram score is ~0, so the pair was rejected and the Google row was dropped for
 * want of a Kakao twin. Measured at Seongsan: 'en' matched 2 of 20 rated places,
 * 'ko' matched 6 before any scoring change.
 *
 * We never needed English here. The rendered name comes from Kakao's Korean
 * original plus our own one-time translation (translate.server.ts) — this field
 * is never shown to a guest.
 */
export async function googleNearbyRestaurants(args: GoogleNearbyArgs): Promise<GooglePlace[]> {
  const key = googleApiKey();
  if (!key) return [];
  if (!Number.isFinite(args.lat) || !Number.isFinite(args.lng)) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
  try {
    await noteGoogleCall();
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: ['restaurant', 'cafe'],
        maxResultCount: MAX_RESULT_COUNT,
        rankPreference: 'POPULARITY',
        languageCode: 'ko',
        locationRestriction: {
          circle: {
            center: { latitude: args.lat, longitude: args.lng },
            radius: Math.max(1, Math.min(50_000, Math.round(args.radiusM))),
          },
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { places?: Array<Record<string, unknown>> };
    const places = Array.isArray(data?.places) ? data.places : [];
    const out: GooglePlace[] = [];
    for (const raw of places) {
      const place = normalizeGooglePlace(raw);
      if (place) out.push(place);
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
