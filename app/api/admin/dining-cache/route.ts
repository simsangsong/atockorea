import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { haversineM } from '@/lib/tour-room/geo';
import { quotaState } from '@/lib/ops/dining/kakao.server';
import { googleQuotaState } from '@/lib/ops/dining/google.server';

export const dynamic = 'force-dynamic';

/**
 * Admin dining-cache overview (§5.7 R-9).
 *
 * This surface is the whole reason there is no blanket human review gate on the
 * dining cache (spec K6): restaurants are first-party business data behind a
 * quantitative quality filter, so instead of verifying hundreds of rows one by
 * one, ops watch the exceptions — what guests reported wrong, what has gone
 * stale, and how much quota the day has burned.
 *
 *   GET /api/admin/dining-cache[?cells=&reports=]
 *     → { stats, reports, cells }
 *
 * The report queue comes first in the payload because it is the default view:
 * it is the only part that needs a human.
 */

const CELL_TABLE = 'ops_kakao_cell_index';
const PLACE_TABLE = 'ops_kakao_place_cache';
const REC_TABLE = 'ops_restaurant_recommendations';

/** A cell within this window is worth re-collecting before a guest hits a MISS. */
const EXPIRING_SOON_DAYS = 14;
/** Beyond this a nearby POI is not a useful label for the cell. */
const NEAREST_POI_MAX_M = 3_000;

/**
 * `rank = 0` is the sentinel the feedback route writes when a guest acts on a
 * card whose exposure row never landed — it is a real action but NOT a real
 * impression, so counting it would inflate the denominator of every tap rate.
 */
const UNKNOWN_RANK = 0;

const CELL_COLUMNS =
  'cell, center_lat, center_lng, radius_m, place_count, kakao_calls, google_calls, ' +
  'source, fetched_at, expires_at';

const REPORT_COLUMNS =
  'place_key, cell, name, category_name, cuisine, rating, review_count, price_band, ' +
  'road_address, address, place_url, reported_wrong_count, is_blocked, is_closed, ' +
  'expires_at, updated_at';

function toNum(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampLimit(raw: string | null, fallback: number, max: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback;
}

/** One booking that reported a queued place. */
interface ReportSource {
  booking_id: string;
  feedback: string | null;
  shown_at: string | null;
}

interface ReportRow extends Record<string, unknown> {
  place_key: string;
  rating: number | null;
  reported_by: ReportSource[];
}

interface PoiPoint {
  poi_key: string;
  label: string;
  lat: number;
  lng: number;
}

/**
 * Nearest catalogue POI to a cell centre, for a human-readable cell label.
 *
 * Done in memory over the whole (small, ~120-row) POI list rather than with a
 * spatial query: there is no PostGIS index on match_pois, so a per-cell SQL
 * distance sort would be a full scan each time anyway.
 */
function nearestPoi(lat: number, lng: number, pois: PoiPoint[]): { poi_key: string; name: string; distance_m: number } | null {
  let best: { poi: PoiPoint; distance: number } | null = null;
  for (const poi of pois) {
    const distance = haversineM({ latitude: lat, longitude: lng }, { latitude: poi.lat, longitude: poi.lng });
    if (!best || distance < best.distance) best = { poi, distance };
  }
  if (!best || best.distance > NEAREST_POI_MAX_M) return null;
  return { poi_key: best.poi.poi_key, name: best.poi.label, distance_m: Math.round(best.distance) };
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const cellLimit = clampLimit(req.nextUrl.searchParams.get('cells'), 200, 1000);
    const reportLimit = clampLimit(req.nextUrl.searchParams.get('reports'), 100, 500);

    const supabase = createServerClient();
    const nowIso = new Date().toISOString();
    const soonIso = new Date(Date.now() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const [
      cellsRes,
      totalCellsRes,
      totalPlacesRes,
      ratedPlacesRes,
      expiringRes,
      blockedRes,
      reportsRes,
      impressionsRes,
      tapsRes,
      visitsRes,
      poisRes,
      kakao,
      google,
    ] = await Promise.all([
      supabase.from(CELL_TABLE).select(CELL_COLUMNS).order('fetched_at', { ascending: false }).limit(cellLimit),
      supabase.from(CELL_TABLE).select('cell', { count: 'exact', head: true }),
      supabase.from(PLACE_TABLE).select('place_key', { count: 'exact', head: true }),
      supabase.from(PLACE_TABLE).select('place_key', { count: 'exact', head: true }).not('rating', 'is', null),
      supabase
        .from(CELL_TABLE)
        .select('cell', { count: 'exact', head: true })
        .gt('expires_at', nowIso)
        .lt('expires_at', soonIso),
      supabase.from(PLACE_TABLE).select('place_key', { count: 'exact', head: true }).eq('is_blocked', true),
      supabase
        .from(PLACE_TABLE)
        .select(REPORT_COLUMNS)
        .or('reported_wrong_count.gt.0,is_closed.eq.true')
        .order('reported_wrong_count', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(reportLimit),
      supabase.from(REC_TABLE).select('id', { count: 'exact', head: true }).gt('rank', UNKNOWN_RANK),
      supabase.from(REC_TABLE).select('id', { count: 'exact', head: true }).not('tapped_at', 'is', null),
      supabase.from(REC_TABLE).select('id', { count: 'exact', head: true }).not('visited_at', 'is', null),
      supabase.from('match_pois').select('poi_key, name_ko, name_en, lat, lng').not('lat', 'is', null).not('lng', 'is', null),
      quotaState(),
      googleQuotaState(),
    ]);

    if (cellsRes.error) {
      console.error('[GET /api/admin/dining-cache]', cellsRes.error);
      return NextResponse.json(
        { error: 'Failed to load the dining cache', details: cellsRes.error.message },
        { status: 500 },
      );
    }

    const pois: PoiPoint[] = [];
    for (const raw of (poisRes.data ?? []) as Array<Record<string, unknown>>) {
      const lat = toNum(raw.lat);
      const lng = toNum(raw.lng);
      if (lat === null || lng === null || typeof raw.poi_key !== 'string') continue;
      const nameKo = typeof raw.name_ko === 'string' ? raw.name_ko.trim() : '';
      const nameEn = typeof raw.name_en === 'string' ? raw.name_en.trim() : '';
      pois.push({ poi_key: raw.poi_key, label: nameKo || nameEn || raw.poi_key, lat, lng });
    }

    const cells = ((cellsRes.data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => {
      const lat = toNum(row.center_lat);
      const lng = toNum(row.center_lng);
      return {
        ...row,
        center_lat: lat,
        center_lng: lng,
        nearest_poi: lat !== null && lng !== null ? nearestPoi(lat, lng, pois) : null,
      };
    });

    // Which bookings reported each queued place — the operator needs to know
    // whether three reports came from three parties or one unhappy room.
    const reports: ReportRow[] = ((reportsRes.data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      place_key: typeof row.place_key === 'string' ? row.place_key : '',
      rating: toNum(row.rating),
      reported_by: [],
    }));
    const reportedKeys = reports.map((row) => row.place_key).filter(Boolean);
    if (reportedKeys.length > 0) {
      const { data: ledger } = await supabase
        .from(REC_TABLE)
        .select('place_key, booking_id, feedback, shown_at')
        .in('place_key', reportedKeys)
        .in('feedback', ['wrong', 'closed']);
      const byPlace = new Map<string, ReportSource[]>();
      for (const raw of (ledger ?? []) as unknown as Array<Record<string, unknown>>) {
        const key = typeof raw.place_key === 'string' ? raw.place_key : '';
        const bookingId = typeof raw.booking_id === 'string' ? raw.booking_id : '';
        if (!key || !bookingId) continue;
        const list = byPlace.get(key) ?? [];
        list.push({
          booking_id: bookingId,
          feedback: typeof raw.feedback === 'string' ? raw.feedback : null,
          shown_at: typeof raw.shown_at === 'string' ? raw.shown_at : null,
        });
        byPlace.set(key, list);
      }
      for (const report of reports) {
        report.reported_by = byPlace.get(report.place_key) ?? [];
      }
    }

    const totalPlaces = totalPlacesRes.count ?? 0;
    const ratedPlaces = ratedPlacesRes.count ?? 0;
    const impressions = impressionsRes.count ?? 0;
    const taps = tapsRes.count ?? 0;

    return NextResponse.json({
      stats: {
        total_cells: totalCellsRes.count ?? 0,
        total_places: totalPlaces,
        rated_places: ratedPlaces,
        // Share of the cache Google could enrich. A low number means the cards
        // are leaning on the distance-order fallback (spec K1), not that the
        // restaurants are bad.
        rated_pct: totalPlaces > 0 ? Math.round((ratedPlaces / totalPlaces) * 100) : 0,
        blocked_places: blockedRes.count ?? 0,
        expiring_soon: expiringRes.count ?? 0,
        expiring_soon_days: EXPIRING_SOON_DAYS,
        reported_places: reports.length,
        impressions,
        taps,
        visits: visitsRes.count ?? 0,
        tap_rate_pct: impressions > 0 ? Math.round((taps / impressions) * 100) : 0,
        kakao_calls_today: kakao.used,
        kakao_cap: kakao.cap,
        kakao_ratio: kakao.ratio,
        google_calls_today: google.used,
        google_cap: google.cap,
        google_ratio: google.ratio,
        quota_alert: kakao.shouldAlert || google.shouldAlert,
        // false → no durable counter answered, so the two counts above are this
        // instance only. The UI must not present them as the day's total.
        quota_durable: kakao.durable !== false && google.durable !== false,
      },
      reports,
      cells,
      capped: cells.length >= cellLimit,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/dining-cache]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
