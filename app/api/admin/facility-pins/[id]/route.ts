import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Admin facility-pin edit/delete (F-D10). Plan W1.1.
 *
 *   PATCH  /api/admin/facility-pins/[id]        → edit coords / label / kind /
 *          photo / order / active / verified. Correcting an auto-collected pin
 *          (source='places_auto') auto-promotes is_verified=true.
 *   DELETE /api/admin/facility-pins/[id]        → soft delete (is_active=false).
 *   DELETE /api/admin/facility-pins/[id]?hard=1 → permanent delete.
 */

const SELECT_COLUMNS =
  'id, poi_key, kind, lat, lng, name, name_i18n, photo_url, source, place_id, ' +
  'distance_m, is_verified, is_active, sort_order, created_at, updated_at';

const VALID_KINDS = new Set(['restroom', 'photo']);

function coordOk(v: unknown, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const patch: Record<string, unknown> = {};

    if ('lat' in body) {
      if (!coordOk(body.lat, 90)) return NextResponse.json({ error: 'lat out of range' }, { status: 400 });
      patch.lat = body.lat;
    }
    if ('lng' in body) {
      if (!coordOk(body.lng, 180)) return NextResponse.json({ error: 'lng out of range' }, { status: 400 });
      patch.lng = body.lng;
    }
    if ('kind' in body) {
      if (!VALID_KINDS.has(String(body.kind))) {
        return NextResponse.json({ error: 'kind must be restroom or photo' }, { status: 400 });
      }
      patch.kind = body.kind;
    }
    if ('name' in body) patch.name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
    if ('name_i18n' in body) patch.name_i18n = body.name_i18n && typeof body.name_i18n === 'object' ? body.name_i18n : null;
    if ('photo_url' in body) patch.photo_url = typeof body.photo_url === 'string' && body.photo_url.trim() ? body.photo_url.trim() : null;
    if ('sort_order' in body && typeof body.sort_order === 'number') patch.sort_order = body.sort_order;
    if ('is_active' in body) patch.is_active = Boolean(body.is_active);
    if ('is_verified' in body) patch.is_verified = Boolean(body.is_verified);

    // Correcting a pin's placement/label counts as human verification (F-D10).
    const correctsPlacement = 'lat' in body || 'lng' in body || 'name' in body || 'name_i18n' in body;
    if (correctsPlacement && !('is_verified' in body)) patch.is_verified = true;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No editable fields in body' }, { status: 400 });
    }
    patch.updated_at = new Date().toISOString();

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('poi_facility_pins')
      .update(patch)
      .eq('id', id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      console.error('[PATCH /api/admin/facility-pins]', error);
      return NextResponse.json({ error: 'Failed to update pin', details: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[PATCH /api/admin/facility-pins]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const hard = req.nextUrl.searchParams.get('hard') === '1';
    const supabase = createServerClient();

    if (hard) {
      const { error } = await supabase.from('poi_facility_pins').delete().eq('id', id);
      if (error) {
        console.error('[DELETE hard /api/admin/facility-pins]', error);
        return NextResponse.json({ error: 'Failed to delete pin', details: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, deleted: 'hard' });
    }

    const { data, error } = await supabase
      .from('poi_facility_pins')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      console.error('[DELETE soft /api/admin/facility-pins]', error);
      return NextResponse.json({ error: 'Failed to delete pin', details: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
    return NextResponse.json({ ok: true, deleted: 'soft', data });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[DELETE /api/admin/facility-pins]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
