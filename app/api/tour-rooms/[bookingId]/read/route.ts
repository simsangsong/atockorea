import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { broadcastToRoom } from '@/lib/tour-room/realtime';

export const dynamic = 'force-dynamic';

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

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor } = resolved;
    if (actor.kind !== 'session') {
      return NextResponse.json({ ok: true, skipped: 'no participant cursor' }, { status: 200 });
    }

    const room = await ensureRoom(supabase, booking);
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
