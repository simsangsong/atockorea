import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { broadcastToRoom } from '@/lib/tour-room/realtime';

export const dynamic = 'force-dynamic';

/**
 * Emoji reactions (Kakao-grade chat, Phase 1).
 *
 * POST /api/tour-rooms/[bookingId]/reactions { messageId, emoji }
 * Toggles the caller's reaction on a message (add if absent, remove if present)
 * and broadcasts the change. Joined participants only. The reaction snapshot for
 * cold-start feeds is folded into the room snapshot separately (Phase 2).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as { messageId?: unknown; emoji?: unknown };
    const messageId = typeof body.messageId === 'string' ? body.messageId : '';
    const emoji = typeof body.emoji === 'string' ? body.emoji.trim() : '';
    if (!messageId || !emoji || emoji.length > 8) {
      return NextResponse.json({ error: 'messageId and a short emoji are required' }, { status: 400 });
    }

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor } = resolved;
    if (actor.kind !== 'session') {
      return NextResponse.json({ error: 'Join the room to react' }, { status: 403 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_reaction',
      key: `participant:${actor.sessionPayload.participantId}`,
      perMinute: 30,
      perHour: 300,
    });
    if (!gate.allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    const room = await ensureRoom(supabase, booking);

    // The reacted message must belong to this room.
    const { data: msg } = await supabase
      .from('tour_room_messages')
      .select('id')
      .eq('id', messageId)
      .eq('room_id', room.id)
      .maybeSingle();
    if (!msg) {
      return NextResponse.json({ error: 'message not found in this room' }, { status: 404 });
    }

    const participantId = actor.sessionPayload.participantId;
    const { data: existing } = await supabase
      .from('tour_room_message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('participant_id', participantId)
      .eq('emoji', emoji)
      .maybeSingle();

    let action: 'add' | 'remove';
    if (existing) {
      await supabase.from('tour_room_message_reactions').delete().eq('id', (existing as { id: string }).id);
      action = 'remove';
    } else {
      await supabase.from('tour_room_message_reactions').insert({
        message_id: messageId,
        room_id: room.id,
        participant_id: participantId,
        role: actor.role,
        emoji,
      });
      action = 'add';
    }

    await broadcastToRoom(room, 'reaction', {
      message_id: messageId,
      emoji,
      action,
      role: actor.role,
      participant_id: participantId,
    });

    return NextResponse.json({ ok: true, action }, { status: 200 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/reactions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
