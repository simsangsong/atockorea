/**
 * The cell cache — HIT judgement, collection, invalidation (§5.7 R-3 / R-7).
 *
 * 🔴 The zero-call contract: a cell that has been collected and whose TTL is
 * alive NEVER makes an external call again, no matter how few restaurants it
 * holds. That is why HIT is decided by `ops_kakao_cell_index` (did we collect
 * here?) and not by a row count (spec K4) — a rural cell with three restaurants
 * would otherwise miss forever and hit Kakao on every single request.
 *
 * Everything here is best-effort. `readCellCache` and `collectCell` return an
 * empty result rather than throwing, because they run inside arrival hooks: a
 * missing dining card is an acceptable outcome, a 500 on arrival is not.
 *
 * Server-only (supabase + the io modules). The client re-filters the payload
 * with the pure helpers in places.ts.
 */

import type { RoomDbClient } from '@/lib/tour-room/access';
import { cellsWithinRadius, encodeGeohash, DINING_CELL_PRECISION } from '@/lib/ops/dining/geohash';
import { haversineM } from '@/lib/tour-room/geo';
import { placeQualityScore, qualityFilter, type CachedPlace, type PlaceFeedback } from '@/lib/ops/dining/places';
import { googleNearbyRestaurants } from '@/lib/ops/dining/google.server';
import { kakaoAvailable, kakaoCategorySearch, quotaState, type KakaoPlaceDoc } from '@/lib/ops/dining/kakao.server';
import { mergeKakaoGoogle, type MergedPlace } from '@/lib/ops/dining/merge.server';
import { translateAndEnrichPlaces } from '@/lib/ops/dining/translate.server';

/** Default search radius (spec K5 — 500 m returned 0 docs at Seongsan). */
export const DEFAULT_RADIUS_M = 800;
/** One widening retry when the first sweep is too thin. */
export const WIDE_RADIUS_M = 1500;
/** Below this many candidates we widen once (K5). */
export const MIN_CANDIDATES = 10;
/** Cache lifetime (R-7). Expired cells are re-collected on the next request. */
export const CACHE_TTL_DAYS = 90;
/** Reported wrong this many times → excluded from serving (K6). */
export const WRONG_REPORT_HIDE_AT = 3;
/** Rows loaded per read — ranking only ever needs the best handful. */
const MAX_ROWS = 120;

const CELL_TABLE = 'ops_kakao_cell_index';
const PLACE_TABLE = 'ops_kakao_place_cache';
const REC_TABLE = 'ops_restaurant_recommendations';

export interface CellIndexRow {
  cell: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  place_count: number;
  fetched_at: string;
  expires_at: string;
  [key: string]: unknown;
}

export interface CellCacheResult {
  hit: boolean;
  places: CachedPlace[];
  index?: CellIndexRow | null;
  /** True when the whole set was unrated and we fell back to distance order. */
  unrated?: boolean;
}

/** geohash7 of a point — the cache's cell identity. */
export function cellFor(lat: number, lng: number): string {
  return encodeGeohash(lat, lng, DINING_CELL_PRECISION);
}

function expiryIso(fromMs = Date.now()): string {
  return new Date(fromMs + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

/** DB row (numeric columns arrive as strings from postgrest) → CachedPlace. */
export function rowToCachedPlace(row: Record<string, unknown>): CachedPlace | null {
  const lat = toNumber(row.lat);
  const lng = toNumber(row.lng);
  const placeKey = typeof row.place_key === 'string' ? row.place_key : '';
  const placeUrl = typeof row.place_url === 'string' ? row.place_url : '';
  if (!placeKey || !placeUrl || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const rating = row.rating == null ? null : toNumber(row.rating);
  const reviewCount = row.review_count == null ? null : toNumber(row.review_count);
  const priceBand = row.price_band == null ? null : toNumber(row.price_band);
  const qualityScore = row.quality_score == null ? 0 : toNumber(row.quality_score);

  return {
    place_key: placeKey,
    cell: typeof row.cell === 'string' ? row.cell : '',
    search_cells: Array.isArray(row.search_cells) ? (row.search_cells as string[]) : [],
    name: typeof row.name === 'string' ? row.name : '',
    name_i18n: row.name_i18n && typeof row.name_i18n === 'object' ? (row.name_i18n as Record<string, string>) : null,
    category_group: typeof row.category_group === 'string' ? row.category_group : 'FD6',
    category_name: typeof row.category_name === 'string' ? row.category_name : null,
    cuisine: typeof row.cuisine === 'string' ? row.cuisine : null,
    road_address: typeof row.road_address === 'string' ? row.road_address : null,
    address: typeof row.address === 'string' ? row.address : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    place_url: placeUrl,
    lat,
    lng,
    rating: rating !== null && Number.isFinite(rating) ? rating : null,
    review_count: reviewCount !== null && Number.isFinite(reviewCount) ? reviewCount : null,
    price_band: priceBand !== null && Number.isFinite(priceBand) ? priceBand : null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    signature_menus: Array.isArray(row.signature_menus) ? (row.signature_menus as CachedPlace['signature_menus']) : [],
    open_hours: row.open_hours && typeof row.open_hours === 'object' ? (row.open_hours as CachedPlace['open_hours']) : null,
    google_place_id: typeof row.google_place_id === 'string' ? row.google_place_id : null,
    quality_score: Number.isFinite(qualityScore) ? qualityScore : 0,
    is_blocked: row.is_blocked === true,
    is_closed: row.is_closed === true,
    reported_wrong_count: Number.isFinite(toNumber(row.reported_wrong_count)) ? toNumber(row.reported_wrong_count) : 0,
    expires_at: typeof row.expires_at === 'string' ? row.expires_at : null,
  };
}

export interface CellQuery {
  lat: number;
  lng: number;
  radiusM?: number;
}

/**
 * HIT path — zero external calls.
 *
 * HIT is decided by the CENTER cell's index row alone (K4). The place rows come
 * from every cell the radius touches, are filtered to live/servable rows, and
 * then re-checked with an exact haversine distance (the cell set is only an
 * index-friendly approximation — see geohash.cellsWithinRadius).
 */
export async function readCellCache(supabase: RoomDbClient, query: CellQuery): Promise<CellCacheResult> {
  const radiusM = query.radiusM ?? DEFAULT_RADIUS_M;
  const centre = cellFor(query.lat, query.lng);
  if (!centre) return { hit: false, places: [], index: null };

  try {
    const nowIso = new Date().toISOString();

    const { data: indexRow } = await supabase
      .from(CELL_TABLE)
      .select('*')
      .eq('cell', centre)
      .maybeSingle();

    const index = (indexRow as CellIndexRow | null) ?? null;
    const fresh = Boolean(index?.expires_at && index.expires_at > nowIso);
    if (!fresh) return { hit: false, places: [], index };

    const cells = cellsWithinRadius(query.lat, query.lng, radiusM);
    const { data } = await supabase
      .from(PLACE_TABLE)
      .select('*')
      .in('cell', cells)
      .eq('is_blocked', false)
      .eq('is_closed', false)
      .lt('reported_wrong_count', WRONG_REPORT_HIDE_AT)
      .gt('expires_at', nowIso)
      .limit(MAX_ROWS);

    const from = { latitude: query.lat, longitude: query.lng };
    const places: CachedPlace[] = [];
    for (const raw of (data ?? []) as Array<Record<string, unknown>>) {
      const place = rowToCachedPlace(raw);
      if (!place) continue;
      const distance = Math.round(haversineM(from, { latitude: place.lat, longitude: place.lng }));
      if (distance > radiusM) continue; // exact filter over the approximate cell set
      places.push({ ...place, distance_m: distance });
    }

    return { hit: true, places, index };
  } catch {
    return { hit: false, places: [], index: null };
  }
}

/** Kakao FD6 + CE7 at one radius. */
async function sweepKakao(lat: number, lng: number, radiusM: number): Promise<KakaoPlaceDoc[]> {
  const [food, cafe] = await Promise.all([
    kakaoCategorySearch({ lat, lng, radiusM, group: 'FD6' }),
    kakaoCategorySearch({ lat, lng, radiusM, group: 'CE7' }),
  ]);
  const seen = new Set<string>();
  const docs: KakaoPlaceDoc[] = [];
  for (const doc of [...food, ...cafe]) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    docs.push(doc);
  }
  return docs;
}

/**
 * MISS path (§R-3). Collect once, store forever (until TTL).
 *
 * Order matters: Kakao first (it decides which businesses exist at all), widen
 * once if the sweep is thin, then ONE Google call at the final radius, merge,
 * quality-filter, enrich, upsert both tables. Returns the same shape as
 * `readCellCache` so callers do not branch on which path ran.
 *
 * Guards: no Kakao key → nothing to collect (there would be no deep link);
 * daily quota exhausted → HIT-only mode, no calls.
 */
export async function collectCell(supabase: RoomDbClient, query: CellQuery): Promise<CellCacheResult> {
  const centre = cellFor(query.lat, query.lng);
  if (!centre) return { hit: false, places: [] };
  if (!kakaoAvailable()) return { hit: false, places: [] };

  try {
    const quota = await quotaState();
    if (quota.exhausted) return { hit: false, places: [] };

    let radiusM = query.radiusM ?? DEFAULT_RADIUS_M;
    let kakaoDocs = await sweepKakao(query.lat, query.lng, radiusM);
    let kakaoCalls = 2;

    // K5 — attraction interiors have no restaurants; widen once rather than
    // returning an empty card at a real meal stop.
    if (kakaoDocs.length < MIN_CANDIDATES && radiusM < WIDE_RADIUS_M) {
      radiusM = WIDE_RADIUS_M;
      kakaoDocs = await sweepKakao(query.lat, query.lng, radiusM);
      kakaoCalls += 2;
    }
    if (kakaoDocs.length === 0) {
      // Record the empty sweep anyway: "we looked here and found nothing" is a
      // real answer, and without the index row we would re-sweep every request.
      await upsertCellIndex(supabase, {
        cell: centre,
        centerLat: query.lat,
        centerLng: query.lng,
        radiusM,
        placeCount: 0,
        kakaoCalls,
        googleCalls: 0,
      });
      return { hit: true, places: [] };
    }

    const googlePlaces = await googleNearbyRestaurants({ lat: query.lat, lng: query.lng, radiusM });
    const merged = mergeKakaoGoogle(kakaoDocs, googlePlaces, {
      centerLat: query.lat,
      centerLng: query.lng,
    });

    const filtered = qualityFilter(merged as MergedPlace[]);
    const keep = (filtered.places as MergedPlace[]).slice(0, MAX_ROWS);

    const enriched = await translateAndEnrichPlaces(keep);
    const expiresAt = expiryIso();

    await upsertPlaces(supabase, enriched, centre, expiresAt);
    await upsertCellIndex(supabase, {
      cell: centre,
      centerLat: query.lat,
      centerLng: query.lng,
      radiusM,
      placeCount: enriched.length,
      kakaoCalls,
      googleCalls: 1,
    });

    const places: CachedPlace[] = enriched.map((row) => {
      const { review_text: _reviewText, ...rest } = row;
      void _reviewText;
      return { ...rest, unrated: filtered.unrated || undefined } as CachedPlace;
    });
    return { hit: true, places, unrated: filtered.unrated };
  } catch (error) {
    console.warn('[ops-dining] collectCell failed:', error);
    return { hit: false, places: [] };
  }
}

async function upsertPlaces(
  supabase: RoomDbClient,
  rows: MergedPlace[],
  searchCell: string,
  expiresAt: string,
): Promise<void> {
  if (rows.length === 0) return;

  // Merge search_cells instead of overwriting: a place found from two different
  // search centres must remember both, or the second collection erases the
  // provenance of the first.
  let existing = new Map<string, string[]>();
  try {
    const { data } = await supabase
      .from(PLACE_TABLE)
      .select('place_key, search_cells')
      .in('place_key', rows.map((row) => row.place_key));
    existing = new Map(
      ((data ?? []) as Array<{ place_key: string; search_cells?: string[] | null }>).map((row) => [
        row.place_key,
        Array.isArray(row.search_cells) ? row.search_cells : [],
      ]),
    );
  } catch {
    existing = new Map();
  }

  const payload = rows.map((row) => {
    const { review_text: _reviewText, distance_m: _distance, unrated: _unrated, ...rest } = row;
    void _reviewText;
    void _distance;
    void _unrated;
    const searchCells = new Set([...(existing.get(row.place_key) ?? []), searchCell]);
    return {
      ...rest,
      search_cells: [...searchCells],
      quality_score: placeQualityScore(row),
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    };
  });

  try {
    await supabase.from(PLACE_TABLE).upsert(payload, { onConflict: 'place_key' });
  } catch (error) {
    console.warn('[ops-dining] place upsert failed:', error);
  }
}

async function upsertCellIndex(
  supabase: RoomDbClient,
  args: {
    cell: string;
    centerLat: number;
    centerLng: number;
    radiusM: number;
    placeCount: number;
    kakaoCalls: number;
    googleCalls: number;
  },
): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    await supabase.from(CELL_TABLE).upsert(
      {
        cell: args.cell,
        center_lat: args.centerLat,
        center_lng: args.centerLng,
        radius_m: args.radiusM,
        place_count: args.placeCount,
        kakao_calls: args.kakaoCalls,
        google_calls: args.googleCalls,
        source: 'kakao+google',
        fetched_at: nowIso,
        expires_at: expiryIso(),
        updated_at: nowIso,
      },
      { onConflict: 'cell' },
    );
  } catch (error) {
    console.warn('[ops-dining] cell index upsert failed:', error);
  }
}

/**
 * Admin "[셀 무효화]" — expire the index row so the next request re-collects.
 * The place rows are left alone on purpose: they still serve until their own
 * TTL, so invalidating a cell refreshes it without blanking the card meanwhile.
 */
export async function invalidateCell(supabase: RoomDbClient, cell: string): Promise<boolean> {
  if (!cell) return false;
  try {
    await supabase
      .from(CELL_TABLE)
      .update({ expires_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('cell', cell);
    return true;
  } catch {
    return false;
  }
}

/** Admin blacklist toggle — an is_blocked row never reaches a guest again. */
export async function blockPlace(supabase: RoomDbClient, placeKey: string, blocked = true): Promise<boolean> {
  if (!placeKey) return false;
  try {
    await supabase
      .from(PLACE_TABLE)
      .update({ is_blocked: blocked, updated_at: new Date().toISOString() })
      .eq('place_key', placeKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Guest "정보가 틀려요" (R-6). Increments the counter; `action: 'closed'` also
 * flips `is_closed` immediately — a guest standing in front of a shuttered
 * restaurant is a better source than three votes' worth of patience.
 *
 * Read-modify-write rather than an atomic RPC: this fires at most a handful of
 * times per place per day, and a lost concurrent increment costs one extra
 * report before the auto-hide threshold.
 */
export async function reportPlaceWrong(
  supabase: RoomDbClient,
  placeKey: string,
  action: 'wrong' | 'closed' = 'wrong',
): Promise<{ count: number; hidden: boolean } | null> {
  if (!placeKey) return null;
  try {
    const { data } = await supabase
      .from(PLACE_TABLE)
      .select('reported_wrong_count')
      .eq('place_key', placeKey)
      .maybeSingle();
    const current = Number((data as { reported_wrong_count?: unknown } | null)?.reported_wrong_count ?? 0);
    const count = (Number.isFinite(current) ? current : 0) + 1;
    const hidden = action === 'closed' || count >= WRONG_REPORT_HIDE_AT;

    await supabase
      .from(PLACE_TABLE)
      .update({
        reported_wrong_count: count,
        ...(action === 'closed' ? { is_closed: true } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('place_key', placeKey);

    return { count, hidden };
  } catch {
    return null;
  }
}

/**
 * Fold `ops_restaurant_recommendations` rows into the per-place aggregates the
 * ranking consumes. Pure — the caller supplies the rows.
 */
export function applyFeedbackScores(
  rows: Array<{ place_key?: unknown; feedback?: unknown; tapped_at?: unknown; visited_at?: unknown }> | null | undefined,
): Record<string, PlaceFeedback> {
  const out: Record<string, PlaceFeedback> = {};
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    const key = typeof row?.place_key === 'string' ? row.place_key : '';
    if (!key) continue;
    const entry = (out[key] ??= { tapped: 0, visited: 0, wrong: 0 });
    if (row.tapped_at) entry.tapped = (entry.tapped ?? 0) + 1;
    if (row.visited_at) entry.visited = (entry.visited ?? 0) + 1;
    if (row.feedback === 'wrong' || row.feedback === 'closed') entry.wrong = (entry.wrong ?? 0) + 1;
  }
  return out;
}

/** Global feedback aggregates for a set of places (best-effort, never throws). */
export async function loadFeedback(
  supabase: RoomDbClient,
  placeKeys: string[],
): Promise<Record<string, PlaceFeedback>> {
  if (placeKeys.length === 0) return {};
  try {
    const { data } = await supabase
      .from(REC_TABLE)
      .select('place_key, feedback, tapped_at, visited_at')
      .in('place_key', placeKeys);
    return applyFeedbackScores((data ?? []) as Array<Record<string, unknown>>);
  } catch {
    return {};
  }
}
