import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { meetingPhotoPublicUrl } from '@/lib/tour-room/meetingPhoto';

export const dynamic = 'force-dynamic';

/**
 * SG-4d — the meeting-photo review queue (facility_pins' is_verified
 * discipline, cloned). GET lists by status; PATCH verifies or rejects.
 * Only `verified` rows ever reach a guest surface — the snapshot's
 * meeting_photos map filters on it.
 */

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const status = req.nextUrl.searchParams.get('status')?.trim() || 'pending';
    if (!['pending', 'verified', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('tour_poi_arrival_profiles')
      .select('poi_key, meeting_point, meeting_photo_path, meeting_photo_status, meeting_photo_meta, updated_at')
      .eq('meeting_photo_status', status)
      .not('meeting_photo_path', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) {
      return NextResponse.json({ error: 'load_failed', details: error.message }, { status: 500 });
    }
    const rows = (data ?? []).map((row) => ({
      ...row,
      photo_url: row.meeting_photo_path ? meetingPhotoPublicUrl(row.meeting_photo_path) : null,
    }));
    return NextResponse.json({ data: rows, count: rows.length });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error('[GET /api/admin/meeting-photos]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as { poi_key?: unknown; status?: unknown } | null;
    const poiKey = typeof body?.poi_key === 'string' ? body.poi_key.trim() : '';
    const status = typeof body?.status === 'string' ? body.status : '';
    if (!poiKey || !['verified', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'poi_key and status(verified|rejected) required' }, { status: 400 });
    }
    const supabase = createServerClient();
    const { error } = await supabase
      .from('tour_poi_arrival_profiles')
      .update({ meeting_photo_status: status, updated_at: new Date().toISOString() })
      .eq('poi_key', poiKey);
    if (error) {
      return NextResponse.json({ error: 'update_failed', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error('[PATCH /api/admin/meeting-photos]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
