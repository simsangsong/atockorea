import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { broadcastToRoom } from '@/lib/tour-room/realtime';

export const dynamic = 'force-dynamic';

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

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
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

    const room = await ensureRoom(supabase, booking);
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
