import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { hashToken, signCustomerRoomToken } from '@/lib/tour-room/token';

export const dynamic = 'force-dynamic';

/**
 * 현장 재합류 (2026-08-04 시나리오 감사 #2) — a guest standing at the van with
 * a dead phone battery, a reinstalled browser, or a lost chat thread has no
 * way back in: the companion invite is minted by ANOTHER guest, and the ops
 * resend is a remote desk away. The person actually next to them is the
 * driver or guide.
 *
 * POST → staff-only (driver | guide | admin): mints a customer room token for
 * this booking (expires with the tour day — the same class and lifetime as
 * the invite the guest lost, no wider) and returns the join URL for an
 * on-screen QR. Every mint lands in tour_room_invites (sent_via 'onsite-qr')
 * so it is revocable and auditable like any other invite.
 *
 * The QR is a capability URL shown on a screen — the client warns the staff
 * to show it to the guest only, and the rate gate keeps a curious bystander
 * from farming links.
 */
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
    if (actor.role !== 'driver' && actor.role !== 'guide' && actor.role !== 'admin') {
      return NextResponse.json({ error: 'Staff only' }, { status: 403 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_reinvite',
      key: `booking:${booking.id}`,
      perMinute: 3,
      perHour: 12,
    });
    if (!gate.allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    await ensureRoom(supabase, booking);
    const minted = signCustomerRoomToken({
      bookingId: booking.id,
      displayName: 'Guest',
      tourDate: booking.tour_date ?? '',
    });
    const { error } = await supabase.from('tour_room_invites').insert({
      booking_id: booking.id,
      tour_id: booking.tour_id,
      tour_date: booking.tour_date,
      role: 'customer',
      display_name: 'Guest',
      token_hash: hashToken(minted.token),
      sent_via: 'onsite-qr',
      expires_at: new Date(minted.payload.exp * 1000).toISOString(),
      created_by: authUserId,
    });
    if (error) throw error;

    const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, '');
    return NextResponse.json(
      { url: `${origin}/tour-mode/room/${booking.id}?rt=${encodeURIComponent(minted.token)}`, expires_at: minted.payload.exp },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/reinvite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
