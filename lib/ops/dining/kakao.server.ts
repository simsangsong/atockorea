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

import { noteQuotaCall, readQuotaState, type DailyQuotaState } from '@/lib/ops/dining/quota';

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

export type QuotaState = DailyQuotaState;

export function kakaoDailyCap(): number {
  const raw = Number(process.env.OPS_DINING_KAKAO_DAILY_CAP ?? DEFAULT_KAKAO_DAILY_CAP);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_KAKAO_DAILY_CAP;
}

function counterOptions() {
  return {
    key: KAKAO_QUOTA_KEY,
    windowSec: DAY_SECONDS,
    cap: kakaoDailyCap(),
    alertRatio: QUOTA_ALERT_RATIO,
  };
}

/** Count one outbound Kakao call. Never throws (an unreachable counter must
 *  not break collection — worst case we under-count for a day). */
export async function noteKakaoCall(): Promise<QuotaState> {
  return noteQuotaCall(counterOptions());
}

/** Read-only quota view for the collect guard and the admin surface. */
export async function quotaState(): Promise<QuotaState> {
  return readQuotaState(counterOptions());
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
export interface KakaoSweepResult {
  docs: KakaoPlaceDoc[];
  /** The sweep did not complete — do NOT persist this as a finished answer. */
  failed: boolean;
  /** Kakao reported the daily quota is blown (HTTP 400, code -10). */
  quotaExceeded: boolean;
}

export async function kakaoCategorySearch(args: KakaoCategorySearchArgs): Promise<KakaoSweepResult> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return { docs: [], failed: true, quotaExceeded: false };
  if (!Number.isFinite(args.lat) || !Number.isFinite(args.lng)) {
    return { docs: [], failed: true, quotaExceeded: false };
  }

  // Kakao rejects radius > 20000.
  const radius = Math.max(1, Math.min(20_000, Math.round(args.radiusM)));
  const size = Math.max(1, Math.min(PAGE_SIZE, Math.round(args.size ?? PAGE_SIZE)));
  const maxPages = Math.max(1, Math.min(MAX_PAGES, Math.round(args.maxPages ?? MAX_PAGES)));

  const docs: KakaoPlaceDoc[] = [];
  const seen = new Set<string>();
  let failed = false;
  let quotaExceeded = false;

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
      // Kakao answers a blown daily quota with HTTP 400 + code -10, which is
      // indistinguishable from "no restaurants here" if we only look at the
      // document count. Read the body and say which one it was.
      if (!res.ok) {
        failed = true;
        const body = await res.text().catch(() => '');
        if (body.includes('API limit has been exceeded') || body.includes('"code":-10')) {
          quotaExceeded = true;
          console.warn('[ops-dining] kakao daily quota exceeded');
        } else {
          console.warn(`[ops-dining] kakao HTTP ${res.status}: ${body.slice(0, 160)}`);
        }
        break;
      }

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
      // Network error / timeout. A partial page set is still usable, but the
      // caller must know the sweep was truncated so it does not persist the
      // result as a complete answer.
      failed = docs.length === 0;
      break;
    } finally {
      clearTimeout(timer);
    }
  }

  return { docs, failed, quotaExceeded };
}

/**
 * Back-compat convenience for probes and tests that only want the documents.
 * Production callers use `kakaoCategorySearch` so they can see `failed`.
 */
export async function kakaoCategoryDocs(args: KakaoCategorySearchArgs): Promise<KakaoPlaceDoc[]> {
  return (await kakaoCategorySearch(args)).docs;
}
