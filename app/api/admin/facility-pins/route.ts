import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Admin facility-pins editor API (F-D10 — manual CRUD over restroom / photo
 * pins). Plan: docs/tour-room-facility-pins-master-plan-2026-07-19.md, W1.1.
 *
 *   GET  /api/admin/facility-pins?poi_key=…  → all pins for a POI (both kinds,
 *        incl. inactive so the admin can restore soft-deleted rows).
 *   POST /api/admin/facility-pins            → create a curated pin.
 *
 * All access is admin-gated; the table is service-role-only (no anon reads).
 */

const SELECT_COLUMNS =
  'id, poi_key, kind, lat, lng, name, name_i18n, photo_url, source, place_id, ' +
  'distance_m, is_verified, is_active, sort_order, created_at, updated_at';

const VALID_KINDS = new Set(['restroom', 'photo']);

function coordOk(v: unknown, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const poiKey = req.nextUrl.searchParams.get('poi_key')?.trim();
    if (!poiKey) {
      return NextResponse.json({ error: 'poi_key is required' }, { status: 400 });
    }
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('poi_facility_pins')
      .select(SELECT_COLUMNS)
      .eq('poi_key', poiKey)
      .order('kind', { ascending: true })
      .order('is_active', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('distance_m', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('[GET /api/admin/facility-pins]', error);
      return NextResponse.json({ error: 'Failed to load pins', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [], count: (data ?? []).length });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/facility-pins]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const poiKey = typeof body.poi_key === 'string' ? body.poi_key.trim() : '';
    const kind = typeof body.kind === 'string' ? body.kind : '';
    if (!poiKey) return NextResponse.json({ error: 'poi_key is required' }, { status: 400 });
    if (!VALID_KINDS.has(kind)) return NextResponse.json({ error: 'kind must be restroom or photo' }, { status: 400 });
    if (!coordOk(body.lat, 90) || !coordOk(body.lng, 180)) {
      return NextResponse.json({ error: 'lat/lng out of range' }, { status: 400 });
    }

    const row = {
      poi_key: poiKey,
      kind,
      lat: body.lat,
      lng: body.lng,
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null,
      name_i18n: body.name_i18n && typeof body.name_i18n === 'object' ? body.name_i18n : null,
      photo_url: typeof body.photo_url === 'string' && body.photo_url.trim() ? body.photo_url.trim() : null,
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
      source: 'curated' as const, // manual adds are always curated
      is_verified: true, // a human placed it
    };

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('poi_facility_pins')
      .insert(row)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      console.error('[POST /api/admin/facility-pins]', error);
      return NextResponse.json({ error: 'Failed to create pin', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/facility-pins]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
