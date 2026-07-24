/**
 * Kakao Local — category search + the daily quota counter (§5.7 R-3).
 *
 * Kakao is the *identity* half of the hybrid collection: it knows every Korean
 * restaurant, gives us the Korean business name, the category path, and — the
 * part nothing else can replace — the Kakao Map deep link (spec K7).
 * It does NOT give ratings or review counts (already recorded in
 * `scripts/collect-facility-pins.mjs`: "Kakao Local has no rating"), which is
 * why google.server.ts exists.
 *
 * Every failure returns `[]` — a missing dining card is an acceptable outcome,
 * a thrown error inside an arrival hook is not (same contract as eta.server.ts
 * and the vehicle-eta route's `kakaoEta`).
 */

import { durableIncrWindow, durableReadCount } from '@/lib/durable-rate-limit';

/** A guest-facing path must never hang on a third party (same as vehicle-eta). */
const KAKAO_TIMEOUT_MS = 2_500;
/** Kakao's own max page size for category.json. */
const PAGE_SIZE = 15;
/** 15 × 3 = 45 candidates is plenty to rank five from. */
const MAX_PAGES = 3;

export type KakaoCategoryGroup = 'FD6' | 'CE7';

/** The normalized doc shape the merge step consumes. */
export interface KakaoPlaceDoc {
  id: string;
  place_name: string;
  category_name: string | null;
  category_group_code: KakaoCategoryGroup | string;
  phone: string | null;
  address_name: string | null;
  road_address_name: string | null;
  place_url: string;
  /** Longitude (Kakao's `x`). */
  x: number;
  /** Latitude (Kakao's `y`). */
  y: number;
  /** Metres from the search centre, as reported by Kakao. */
  distance: number | null;
}

export interface KakaoCategorySearchArgs {
  lat: number;
  lng: number;
  radiusM: number;
  group: KakaoCategoryGroup;
  /** Page size (Kakao caps at 15). */
  size?: number;
  maxPages?: number;
}

// ---------------------------------------------------------------------------
// Quota
// ---------------------------------------------------------------------------

/** Kakao's documented free daily quota; env-tunable for a raised plan. */
export const DEFAULT_KAKAO_DAILY_CAP = 30_000;
/** Warn ops once we have burned this share of the day's quota. */
export const QUOTA_ALERT_RATIO = 0.7;

const KAKAO_QUOTA_KEY = 'ops_dining:kakao_daily';
const DAY_SECONDS = 24 * 60 * 60;

export interface QuotaState {
  used: number;
  cap: number;
  /** used / cap, clamped to [0, ∞). 0 when the cap is not a positive number. */
  ratio: number;
  /** true at ≥ 70 % — the caller pings ops once a day (lib/ops/inbox/alert). */
  shouldAlert: boolean;
  /** true at ≥ 100 % — collection stops and serving degrades to cache-only. */
  exhausted: boolean;
}

export function kakaoDailyCap(): number {
  const raw = Number(process.env.OPS_DINING_KAKAO_DAILY_CAP ?? DEFAULT_KAKAO_DAILY_CAP);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_KAKAO_DAILY_CAP;
}

function stateFor(used: number, cap: number): QuotaState {
  const ratio = cap > 0 ? used / cap : 0;
  return { used, cap, ratio, shouldAlert: ratio >= QUOTA_ALERT_RATIO, exhausted: ratio >= 1 };
}

/** Count one outbound Kakao call. Never throws (an unreachable counter must
 *  not break collection — worst case we under-count for a day). */
export async function noteKakaoCall(): Promise<QuotaState> {
  const cap = kakaoDailyCap();
  try {
    const used = await durableIncrWindow(KAKAO_QUOTA_KEY, DAY_SECONDS);
    return stateFor(used, cap);
  } catch {
    return stateFor(0, cap);
  }
}

/** Read-only quota view for the collect guard and the admin surface. */
export async function quotaState(): Promise<QuotaState> {
  const cap = kakaoDailyCap();
  try {
    const used = await durableReadCount(KAKAO_QUOTA_KEY);
    return stateFor(used, cap);
  } catch {
    return stateFor(0, cap);
  }
}

/** False when no REST key is configured — callers degrade to cache-only. */
export function kakaoAvailable(): boolean {
  return Boolean(process.env.KAKAO_REST_API_KEY);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function normalizeDoc(raw: Record<string, unknown>): KakaoPlaceDoc | null {
  const id = typeof raw.id === 'string' ? raw.id : raw.id != null ? String(raw.id) : '';
  const placeName = typeof raw.place_name === 'string' ? raw.place_name.trim() : '';
  const placeUrl = typeof raw.place_url === 'string' ? raw.place_url.trim() : '';
  const x = Number(raw.x);
  const y = Number(raw.y);
  // No id, no name, no deep link, or no coordinates → unrenderable (K7).
  if (!id || !placeName || !placeUrl || !Number.isFinite(x) || !Number.isFinite(y)) return null;

  const distance = Number(raw.distance);
  return {
    id,
    place_name: placeName,
    category_name: typeof raw.category_name === 'string' && raw.category_name.trim() ? raw.category_name.trim() : null,
    category_group_code: typeof raw.category_group_code === 'string' ? raw.category_group_code : '',
    phone: typeof raw.phone === 'string' && raw.phone.trim() ? raw.phone.trim() : null,
    address_name: typeof raw.address_name === 'string' && raw.address_name.trim() ? raw.address_name.trim() : null,
    road_address_name:
      typeof raw.road_address_name === 'string' && raw.road_address_name.trim() ? raw.road_address_name.trim() : null,
    place_url: placeUrl,
    x,
    y,
    distance: Number.isFinite(distance) ? distance : null,
  };
}

/**
 * `GET /v2/local/search/category.json`, sorted by distance, paginated up to
 * `maxPages`. Returns normalized docs; `[]` on a missing key, a timeout, a
 * non-200, an unparseable body, or anything thrown.
 */
export async function kakaoCategorySearch(args: KakaoCategorySearchArgs): Promise<KakaoPlaceDoc[]> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return [];
  if (!Number.isFinite(args.lat) || !Number.isFinite(args.lng)) return [];

  // Kakao rejects radius > 20000.
  const radius = Math.max(1, Math.min(20_000, Math.round(args.radiusM)));
  const size = Math.max(1, Math.min(PAGE_SIZE, Math.round(args.size ?? PAGE_SIZE)));
  const maxPages = Math.max(1, Math.min(MAX_PAGES, Math.round(args.maxPages ?? MAX_PAGES)));

  const docs: KakaoPlaceDoc[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), KAKAO_TIMEOUT_MS);
    try {
      const url =
        'https://dapi.kakao.com/v2/local/search/category.json' +
        `?category_group_code=${encodeURIComponent(args.group)}` +
        `&x=${args.lng}&y=${args.lat}&radius=${radius}` +
        `&sort=distance&page=${page}&size=${size}`;

      await noteKakaoCall();
      const res = await fetch(url, {
        headers: { Authorization: `KakaoAK ${key}` },
        signal: controller.signal,
      });
      if (!res.ok) break;

      const data = (await res.json()) as {
        documents?: Array<Record<string, unknown>>;
        meta?: { is_end?: boolean; total_count?: number };
      };
      const documents = Array.isArray(data?.documents) ? data.documents : [];
      for (const raw of documents) {
        const doc = normalizeDoc(raw);
        if (!doc || seen.has(doc.id)) continue;
        seen.add(doc.id);
        docs.push(doc);
      }
      if (documents.length < size || data?.meta?.is_end) break;
    } catch {
      break; // silent fallback — a partial page set is still usable
    } finally {
      clearTimeout(timer);
    }
  }

  return docs;
}
