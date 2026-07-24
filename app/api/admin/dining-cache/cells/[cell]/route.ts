import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { collectCell, invalidateCell, DEFAULT_RADIUS_M } from '@/lib/ops/dining/cache.server';
import { haversineM } from '@/lib/tour-room/geo';

export const dynamic = 'force-dynamic';

/**
 * Admin cell detail + the two cell-level actions (§5.7 R-9).
 *
 *   GET  /api/admin/dining-cache/cells/[cell]  → index row + every place that
 *        collection found (matched on `search_cells`, which is what the GIN
 *        index is for — a place sits in its OWN cell, so filtering on `cell`
 *        would silently drop everything just outside the centre square).
 *   POST /api/admin/dining-cache/cells/[cell]  → { action, confirm? }
 *        `invalidate` — expire the index row; the next guest re-collects.
 *        `recollect`  — collect NOW. 🔴 Spends Kakao + Google quota, so it
 *                       requires `confirm: true`; a mis-click must not be able
 *                       to burn the day's budget.
 *
 * Both actions reuse slice A's helpers verbatim (`invalidateCell` /
 * `collectCell`) — the admin path and the guest path must never diverge on what
 * "collected" means.
 */

const CELL_TABLE = 'ops_kakao_cell_index';
const PLACE_TABLE = 'ops_kakao_place_cache';

const PLACE_COLUMNS =
  'place_key, cell, search_cells, name, name_i18n, category_group, category_name, cuisine, ' +
  'road_address, address, phone, place_url, lat, lng, rating, review_count, price_band, tags, ' +
  'signature_menus, open_hours, google_place_id, quality_score, is_blocked, is_closed, ' +
  'reported_wrong_count, expires_at, updated_at';

const ACTIONS = new Set(['invalidate', 'recollect']);

function toNum(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ cell: string }> }) {
  try {
    await requireAdmin(req);
    const { cell } = await params;
    const key = decodeURIComponent(cell ?? '').trim();
    if (!key) return NextResponse.json({ error: 'cell is required' }, { status: 400 });

    const supabase = createServerClient();
    const [indexRes, placesRes] = await Promise.all([
      supabase.from(CELL_TABLE).select('*').eq('cell', key).maybeSingle(),
      supabase
        .from(PLACE_TABLE)
        .select(PLACE_COLUMNS)
        .contains('search_cells', [key])
        .order('quality_score', { ascending: false })
        .limit(200),
    ]);

    if (placesRes.error) {
      console.error('[GET /api/admin/dining-cache/cells]', placesRes.error);
      return NextResponse.json({ error: 'Failed to load the cell', details: placesRes.error.message }, { status: 500 });
    }

    // Distance is annotated from the stored search centre, not persisted — the
    // same read-time convention `readCellCache` uses, so the numbers an
    // operator sees match what a guest standing there would have been shown.
    const centre = indexRes.data as Record<string, unknown> | null;
    const centreLat = toNum(centre?.center_lat);
    const centreLng = toNum(centre?.center_lng);

    const places = ((placesRes.data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => {
      const lat = toNum(row.lat);
      const lng = toNum(row.lng);
      const distance =
        centreLat !== null && centreLng !== null && lat !== null && lng !== null
          ? Math.round(haversineM({ latitude: centreLat, longitude: centreLng }, { latitude: lat, longitude: lng }))
          : null;
      return {
        ...row,
        lat,
        lng,
        rating: toNum(row.rating),
        quality_score: toNum(row.quality_score),
        distance_m: distance,
      };
    });

    return NextResponse.json({ cell: key, index: indexRes.data ?? null, places, count: places.length });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/dining-cache/cells]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ cell: string }> }) {
  try {
    await requireAdmin(req);
    const { cell } = await params;
    const key = decodeURIComponent(cell ?? '').trim();
    if (!key) return NextResponse.json({ error: 'cell is required' }, { status: 400 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!ACTIONS.has(action)) {
      return NextResponse.json({ error: 'action must be invalidate or recollect' }, { status: 400 });
    }

    const supabase = createServerClient();

    if (action === 'invalidate') {
      const ok = await invalidateCell(supabase, key);
      if (!ok) return NextResponse.json({ error: 'Failed to invalidate the cell' }, { status: 500 });
      return NextResponse.json({ ok: true, action, cell: key });
    }

    // recollect — the only admin action that costs money.
    if (body?.confirm !== true) {
      return NextResponse.json(
        { error: 'recollect spends Kakao and Google quota — resend with { confirm: true }' },
        { status: 400 },
      );
    }

    const { data: indexRow } = await supabase
      .from(CELL_TABLE)
      .select('center_lat, center_lng, radius_m')
      .eq('cell', key)
      .maybeSingle();
    const lat = toNum((indexRow as Record<string, unknown> | null)?.center_lat);
    const lng = toNum((indexRow as Record<string, unknown> | null)?.center_lng);
    if (lat === null || lng === null) {
      // Without a stored centre there is nothing to search around — the cell's
      // own bounding box would re-collect a slightly different neighbourhood.
      return NextResponse.json({ error: 'This cell has no stored centre; nothing to re-collect' }, { status: 404 });
    }

    const radiusM = toNum((indexRow as Record<string, unknown> | null)?.radius_m) ?? DEFAULT_RADIUS_M;
    const result = await collectCell(supabase, { lat, lng, radiusM });
    if (!result.hit) {
      return NextResponse.json(
        { error: 'Collection returned nothing (no Kakao key, quota exhausted, or the sweep failed)' },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, action, cell: key, collected: result.places.length });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/dining-cache/cells]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
