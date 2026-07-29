import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';

export const dynamic = 'force-dynamic';

/**
 * SG-5c — the guest exit for the vehicle photo (2차 감사 G1: the photo
 * exists in `ops_room_vehicles.photo_path`, private bucket, and NO guest
 * path ever selected it). The bucket stays private — "조회는 단기 서명
 * URL로만" per the migration's own contract — so this returns a short
 * signed URL for the pickup hero band. Signed URLs are deliberately NOT
 * in the SW image cache (they churn; SG-D9).
 */
const BUCKET = 'ops-vehicle-refs';
const SIGNED_URL_TTL_SEC = 60 * 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const room = await ensureRoom(supabase, resolved.booking);
    const { data } = await supabase
      .from('ops_room_vehicles')
      .select('photo_path')
      .eq('room_id', room.id)
      .not('photo_path', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    const path = (data as { photo_path?: string | null } | null)?.photo_path ?? null;
    if (!path) return NextResponse.json({ url: null }, { status: 200 });
    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SEC);
    if (error || !signed?.signedUrl) {
      return NextResponse.json({ url: null }, { status: 200 });
    }
    return NextResponse.json({ url: signed.signedUrl }, { status: 200 });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/vehicle-photo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
