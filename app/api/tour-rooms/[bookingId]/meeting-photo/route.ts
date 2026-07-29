import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { resolveRoomActor } from '@/lib/tour-room/access';
import { requestGate } from '@/lib/durable-rate-limit';
import { MEETING_PHOTO_BUCKET as BUCKET } from '@/lib/tour-room/meetingPhoto';

export const dynamic = 'force-dynamic';

/**
 * SG-4d — the driver photographs the meeting point, once, forever.
 *
 * POST multipart { photo: File, poiKey } — staff only (the cockpit's camera
 * path, same capture input the vehicle photo uses). The file lands in the
 * PUBLIC `tour-meeting-points` bucket (meeting points are not PII; signed
 * URLs would churn out of the SW image cache) and the arrival profile row
 * goes to `pending`. NOTHING here is guest-visible: only the ops queue's
 * verify flips a photo into the free-time/rally hero band (facility_pins'
 * is_verified discipline, cloned).
 */
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export async function POST(
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
    const { booking, actor } = resolved;
    if (actor.role !== 'guide' && actor.role !== 'driver' && actor.role !== 'admin') {
      return NextResponse.json({ error: 'staff_only' }, { status: 403 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_meeting_photo',
      key: `booking:${booking.id}`,
      perMinute: 4,
      perHour: 30,
    });
    if (!gate.allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    const form = await req.formData();
    const photo = form.get('photo');
    const poiKeyRaw = form.get('poiKey');
    const poiKey =
      typeof poiKeyRaw === 'string' && /^[a-z0-9_\-]{1,80}$/i.test(poiKeyRaw.trim())
        ? poiKeyRaw.trim()
        : null;
    if (!(photo instanceof File) || !poiKey) {
      return NextResponse.json({ error: 'photo file and poiKey are required' }, { status: 400 });
    }
    if (!photo.type.startsWith('image/')) {
      return NextResponse.json({ error: 'image files only' }, { status: 415 });
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: 'photo too large (8MB max)' }, { status: 413 });
    }

    const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${poiKey}/${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: photo.type,
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: 'upload_failed' }, { status: 502 });
    }

    // A re-capture replaces a pending/rejected photo and RESETS a verified
    // one to pending — the meeting point may genuinely have changed, and an
    // unverified newer truth beats a verified stale one only after review.
    const { error: upsertError } = await supabase.from('tour_poi_arrival_profiles').upsert(
      {
        poi_key: poiKey,
        meeting_photo_path: path,
        meeting_photo_status: 'pending',
        meeting_photo_meta: {
          captured_by_role: actor.role,
          captured_at: new Date().toISOString(),
          booking_id: booking.id,
        },
        updated_by_role: actor.role,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'poi_key' },
    );
    if (upsertError) {
      return NextResponse.json({ error: 'profile_update_failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, path, status: 'pending' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/meeting-photo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
