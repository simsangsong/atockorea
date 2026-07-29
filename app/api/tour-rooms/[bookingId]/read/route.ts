import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
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
 * Read receipts (Kakao-grade chat, Phase 1).
 *
 * POST /api/tour-rooms/[bookingId]/read
 * Advances the caller's read cursor (tour_room_participants.last_read_at) and
 * broadcasts it so other devices can mark their own sent bubbles as read. Only
 * a joined participant (session) has a cursor; other actor kinds no-op.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    const cachedBooking = (await cachedBookingForRoom(supabase, bookingId)) ?? undefined;
    const resolved = await resolveRoomActor(req, bookingId, { supabase, booking: cachedBooking });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor } = resolved;
    if (actor.kind !== 'session') {
      return NextResponse.json({ ok: true, skipped: 'no participant cursor' }, { status: 200 });
    }

    /**
     * A ceiling, shaped like /typing's — which had one and this did not, though
     * both fire on a cadence and this one WRITES. The client throttles reads to
     * one per 3s, so 60/min is a wide margin over a healthy client and still
     * bounded for one that is not.
     *
     * Answers 200 rather than 429 on purpose: a read cursor is bookkeeping, and
     * a guest whose checkmark is a few seconds stale has lost nothing. A 429
     * would surface as an error the guest cannot act on.
     */
    const gate = await requestGate({
      namespace: 'tour_room_read',
      key: `${bookingId}:${clientIpKey(req.headers)}`,
      perMinute: 60,
      perHour: 900,
    });
    if (!gate.allowed) {
      return NextResponse.json({ ok: true, skipped: 'throttled' }, { status: 200 });
    }

    const room = await cachedEnsureRoom(supabase, booking);
    const at = new Date().toISOString();
    await supabase
      .from('tour_room_participants')
      .update({ last_read_at: at, updated_at: at })
      .eq('id', actor.sessionPayload.participantId);

    await broadcastToRoom(room, 'read', {
      participant_id: actor.sessionPayload.participantId,
      role: actor.role,
      at,
    });

    return NextResponse.json({ ok: true, at }, { status: 200 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
