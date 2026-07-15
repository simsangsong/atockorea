import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { buildTravelTimeline } from '@/lib/tour-room/timeline';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

export const dynamic = 'force-dynamic';

/**
 * V4.2 — issue the travel-timeline reward coupon (concierge-uiux-v2 plan §E).
 *
 * The reward is gated on the guest having a trip to remember (a stop + a
 * photo, re-checked server-side from the existing feed — never trusting the
 * client) and, per the incentivised-review policy (§B), on completing the
 * TIMELINE, not on writing a review. Issuance reuses the welcome-coupon
 * `coupon_grants` model: one idempotent grant per (promo_code, user). The
 * promo code ships launch-gated (is_active=false, like WELCOME10), so until
 * ops flips it live this endpoint honestly reports `not_available` and grants
 * nothing.
 */

const TIMELINE_COUPON_CODE = process.env.TOUR_ROOM_TIMELINE_COUPON_CODE || 'TIMELINE10';

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
    const { booking, actor, authUserId } = resolved;

    const gateKey =
      actor.kind === 'session' ? `participant:${actor.sessionPayload.participantId}` : clientIpKey(req.headers);
    const [participantGate, roomGate] = await Promise.all([
      requestGate({ namespace: 'tour_room_timeline_coupon', key: gateKey, perMinute: 3, perHour: 20 }),
      requestGate({ namespace: 'tour_room_timeline_coupon_room', key: `booking:${booking.id}`, perMinute: 6, perHour: 40 }),
    ]);
    if (!participantGate.allowed || !roomGate.allowed) {
      const retryAfterMs = Math.max(participantGate.retryAfterMs ?? 0, roomGate.retryAfterMs ?? 0);
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
      );
    }

    const room = await ensureRoom(supabase, booking);

    // Re-aggregate the feed server-side; the client vote never decides eligibility.
    const { data: rows } = await supabase
      .from('tour_room_messages')
      .select('id, source_text, metadata, created_at')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
      .limit(300);
    const timeline = buildTravelTimeline((rows ?? []) as unknown as RoomMessage[]);

    if (!timeline.complete) {
      return NextResponse.json(
        { eligible: false, stopCount: timeline.stopCount, photoCount: timeline.photoCount },
        { status: 200 },
      );
    }

    // The grant is bound to an auth user (FK to auth.users). Invite-only guests
    // with no account can't hold one — tell them honestly to log in.
    if (!authUserId) {
      return NextResponse.json({ eligible: true, granted: false, reason: 'login_required' }, { status: 200 });
    }

    const { data: promo } = await supabase
      .from('promo_codes')
      .select('id, code, is_active, grant_validity_days')
      .eq('code', TIMELINE_COUPON_CODE)
      .maybeSingle();
    if (!promo || !promo.is_active) {
      return NextResponse.json({ eligible: true, granted: false, reason: 'not_available' }, { status: 200 });
    }

    const days = Number(promo.grant_validity_days);
    const expiresAt =
      Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;

    const { error: grantError } = await supabase.from('coupon_grants').insert({
      promo_code_id: promo.id,
      user_id: authUserId,
      status: 'active',
      expires_at: expiresAt,
    });

    // Unique (promo_code_id, user_id) makes re-claiming a no-op, not an error.
    if (grantError && grantError.code === '23505') {
      return NextResponse.json(
        { eligible: true, granted: true, alreadyHad: true, code: promo.code },
        { status: 200 },
      );
    }
    if (grantError) {
      console.error('timeline-coupon grant insert error:', grantError);
      return NextResponse.json({ eligible: true, granted: false, reason: 'error' }, { status: 200 });
    }

    return NextResponse.json({ eligible: true, granted: true, code: promo.code }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/timeline-coupon error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
