import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { broadcastToRoom } from '@/lib/tour-room/realtime';

export const dynamic = 'force-dynamic';

/**
 * Unsend (2026-08-04 시나리오 감사 #3) — the driver's voice ride has a 3-second
 * cancel window and nothing after it: a mis-transcription that slipped through
 * was permanent, already translated into every guest's language. KakaoTalk
 * grammar has delete-for-everyone; this room did not.
 *
 * DELETE → tombstone, not erasure: content and translations are blanked, the
 * row stays (id, order, audit trail), and the update rebroadcasts under the
 * same id so every open feed swaps the bubble for a localized 「삭제된 메시지」.
 *
 * Who may delete what, inside a 15-minute window:
 *   - staff (driver | guide | admin): messages of their OWN role — the van has
 *     one driver and one guide, and this is exactly the mis-send case
 *   - customer: only messages stamped with THEIR participant id (stamped on
 *     insert since today; legacy rows are honestly undeletable)
 */
const UNSEND_WINDOW_MS = 15 * 60 * 1000;

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string; messageId: string }> },
) {
  try {
    const { bookingId, messageId } = await params;
    const supabase = createServerClient();

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor } = resolved;
    if (actor.kind !== 'session') {
      return NextResponse.json({ error: 'A joined room session is required' }, { status: 403 });
    }
    const room = await ensureRoom(supabase, booking);

    const { data: message } = await supabase
      .from('tour_room_messages')
      .select('id, room_id, sender_role, created_at, metadata')
      .eq('id', messageId)
      .maybeSingle();
    if (!message || (message as { room_id?: string }).room_id !== room.id) {
      return NextResponse.json({ error: 'Message not found in this room' }, { status: 404 });
    }
    const meta = ((message as { metadata?: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>;
    if (meta.deleted === true) {
      return NextResponse.json({ ok: true, already: true }, { status: 200 });
    }

    const isStaff = actor.role === 'driver' || actor.role === 'guide' || actor.role === 'admin';
    const owns = isStaff
      ? (message as { sender_role?: string }).sender_role === actor.role
      : meta.sender_participant_id === actor.sessionPayload.participantId;
    if (!owns) {
      return NextResponse.json({ error: 'Only your own message can be unsent' }, { status: 403 });
    }

    const age = Date.now() - new Date((message as { created_at: string }).created_at).getTime();
    if (!Number.isFinite(age) || age > UNSEND_WINDOW_MS) {
      return NextResponse.json({ error: 'window_closed' }, { status: 403 });
    }

    // Tombstone: blank the content everywhere it lives. Attachment pointers go
    // with the metadata — the storage object survives for the audit trail, but
    // no client holds a path to it anymore.
    const { data: updated, error } = await supabase
      .from('tour_room_messages')
      .update({
        source_text: '',
        translations: {},
        metadata: {
          deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by_role: actor.role,
        },
      })
      .eq('id', messageId)
      .select()
      .single();
    if (error) throw error;

    await broadcastToRoom(room, 'message', { message: updated });
    return NextResponse.json({ ok: true, message: updated }, { status: 200 });
  } catch (error) {
    console.error('DELETE /api/tour-rooms/[bookingId]/messages/[messageId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
