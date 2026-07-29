import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { resolveRoomActor } from '@/lib/tour-room/access';
import { cachedBookingForRoom, cachedEnsureRoom } from '@/lib/tour-room/reconnectCache';
import { broadcastToRoom } from '@/lib/tour-room/realtime';

export const dynamic = 'force-dynamic';

/**
 * K3 — the ambient traffic, on the cheap path.
 *
 * These two routes fire on a cadence, not on an action: typing every 2.5s while
 * a thumb is moving, read on every feed change. Each one was doing the FULL
 * cold-start work — resolve the actor (booking lookup), then `ensureRoom`
 * (room lookup, and a write when absent) — for a ping that changes one column.
 *
 * K1a already built the answer for exactly this shape and only the SSE route
 * used it: `reconnectCache` memoises the booking row and the room row for 15
 * seconds. It deliberately does NOT cache the authorisation decision — the
 * token is verified on every request as before. What is cached is the two rows
 * that never change inside a ping window.
 *
 * Measured from the client's own throttles: a guest typing continuously sends
 * ~24 typing pings and ~20 read pings per minute. At 3 queries each that is
 * ~132 queries per minute per guest for two features that display a dot and a
 * checkmark. With the cache it is closer to ~44.
 */


/**
 * Typing indicator (Kakao-grade chat, Phase 1).
 *
 * POST /api/tour-rooms/[bookingId]/typing
 * Fire-and-forget: broadcasts an ephemeral typing ping (no DB write). Clients
 * throttle sends (~every 2s) and show a short-lived "…typing" hint that self-
 * clears. A light gate stops a misbehaving client from flooding the channel.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    // `?? undefined` matters: `null` reads as "not supplied" and sends
    // resolveRoomActor to look the booking up a second time on the 404 path.
    const cachedBooking = (await cachedBookingForRoom(supabase, bookingId)) ?? undefined;
    const resolved = await resolveRoomActor(req, bookingId, { supabase, booking: cachedBooking });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor } = resolved;

    const key =
      actor.kind === 'session' ? `participant:${actor.sessionPayload.participantId}` : `booking:${booking.id}`;
    const gate = await requestGate({ namespace: 'tour_room_typing', key, perMinute: 40, perHour: 600 });
    if (!gate.allowed) {
      return NextResponse.json({ ok: true, throttled: true }, { status: 200 });
    }

    const room = await cachedEnsureRoom(supabase, booking);
    await broadcastToRoom(room, 'typing', {
      participant_id: actor.kind === 'session' ? actor.sessionPayload.participantId : null,
      role: actor.role,
      display_name: 'displayName' in actor ? actor.displayName : null,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/typing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
