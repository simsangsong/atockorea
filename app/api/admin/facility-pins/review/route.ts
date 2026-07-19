import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Admin facility-pins review queue (F-D, §H — verification gate).
 * Plan: docs/tour-room-facility-pins-master-plan-2026-07-19.md
 *
 *   GET /api/admin/facility-pins/review[?limit=]  → every active-but-unverified
 *       pin across all POIs, plus per-kind counts. The editor's review mode
 *       groups these by poi_key (joining the match_pois catalog it already
 *       loads) so the operator can eyeball a POI's pins on one Static thumbnail
 *       and approve/reject in bulk. Verify = PATCH {is_verified:true}; reject =
 *       DELETE (soft) — both reuse the existing per-id route.
 *
 * Serving (fetchArrivalFacilityPins) filters is_verified=true, so nothing here
 * is visible to a guest until it's approved.
 */

const SELECT_COLUMNS =
  'id, poi_key, kind, lat, lng, name, name_i18n, source, place_id, ' +
  'distance_m, rating, review_count, sort_order, created_at';

type Kind = 'restaurant' | 'restroom' | 'photo';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const limitRaw = Number(req.nextUrl.searchParams.get('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 5000) : 2000;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('poi_facility_pins')
      .select(SELECT_COLUMNS)
      .eq('is_active', true)
      .eq('is_verified', false)
      .order('poi_key', { ascending: true })
      .order('kind', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('distance_m', { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) {
      console.error('[GET /api/admin/facility-pins/review]', error);
      return NextResponse.json({ error: 'Failed to load review queue', details: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as Array<{ kind: string }>;
    const counts: Record<Kind | 'total', number> = { restaurant: 0, restroom: 0, photo: 0, total: 0 };
    for (const r of rows) {
      counts.total += 1;
      if (r.kind === 'restaurant' || r.kind === 'restroom' || r.kind === 'photo') counts[r.kind] += 1;
    }

    return NextResponse.json({ data: rows, counts, capped: rows.length >= limit });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/facility-pins/review]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
