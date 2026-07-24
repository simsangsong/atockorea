import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import {
  ensureRoom,
  resolveRoomActor,
  signRoomSession,
  type RoomActor,
} from '@/lib/tour-room/access';
import { checkDriverPin } from '@/lib/tour-room/driver';
import { isCompanionRoomToken } from '@/lib/tour-room/token';
import { roomChannelTopic, broadcastToRoom } from '@/lib/tour-room/realtime';
import { roomShouldBeClosed } from '@/lib/tour-room/time';
import { buildRoomSnapshot, normalizeRoomLocale } from '@/lib/tour-room/snapshot';
import { normalizeChatLocale } from '@/lib/tour-room/chatLocale';

export const dynamic = 'force-dynamic';

/**
 * T1.1 — the single entry gate for a tour room (§D).
 *
 * Every entry path (invite token / logged-in member / guest email match)
 * lands here once, registers the device as a participant (upsert on
 * room_id+device_key, §O-4), and receives:
 *   - a short-lived room session for the x-tour-room-auth header,
 *   - the secret Broadcast channel topic (R-23 — only ever issued here),
 *   - the full cold-start snapshot (1 round-trip, T1.2).
 *
 * Deliberately POST-only: invite links are GET-rendered pages, and mail
 * scanners must not create participants (§O-1 ⑦).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function displayNameFor(actor: RoomActor, requested: string, contactName: string | null): string {
  const trimmed = requested.trim().slice(0, 80);
  if (trimmed) return trimmed;
  if (actor.kind === 'token' || actor.kind === 'session') return actor.displayName;
  if (actor.role === 'admin') return 'AtoC Korea';
  if (actor.role === 'guide') return 'Guide';
  return contactName || 'Guest';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const body = await req.json().catch(() => ({}));

    const deviceKey = String(body.deviceKey || body.device_key || '');
    if (!UUID_RE.test(deviceKey)) {
      return NextResponse.json({ error: 'deviceKey (uuid) is required' }, { status: 400 });
    }

    const resolved = await resolveRoomActor(req, bookingId, {
      supabase,
      token: typeof body.token === 'string' ? body.token : null,
      guestEmail: String(body.contactEmail || ''),
      guestName: String(body.contactName || ''),
      guestGate: () =>
        requestGate({
          namespace: 'tour_room_guest',
          key: clientIpKey(req.headers),
          perMinute: 15,
          perHour: 60,
        }),
    });
    if (!resolved.ok) {
      if (resolved.status === 429) {
        return NextResponse.json(
          { error: 'rate_limited' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((resolved.retryAfterMs ?? 0) / 1000)) } },
        );
      }
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor, authUserId } = resolved;

    // P-D3 (W3) — drivers pass a vehicle-plate PIN on top of the signed link.
    // Token-authenticated joins only: an existing driver room session already
    // proved the PIN once.
    if (actor.role === 'driver' && actor.kind === 'token') {
      const pinCheck = await checkDriverPin(supabase, booking.tour_id, booking.tour_date, body.pin);
      if (pinCheck.required && !pinCheck.ok) {
        return NextResponse.json(
          { error: typeof body.pin === 'string' && body.pin ? 'pin_mismatch' : 'pin_required' },
          { status: 403 },
        );
      }
    }

    let room = await ensureRoom(supabase, booking);

    // R-19: a room whose tour day + grace window has passed flips to closed
    // on the next join; the channel topic derivation rotates with it (R-23).
    if (room.status === 'active' && roomShouldBeClosed(booking.tour_date)) {
      // Announce the rotation on the OLD (active) topic first so any ops
      // console still subscribed there refetches the directory and re-subs to
      // the new topic (otherwise it stays on a now-silent channel).
      await broadcastToRoom({ id: room.id, status: 'active' }, 'room', { reason: 'status_rotated' });
      const { data: closedRoom } = await supabase
        .from('tour_rooms')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', room.id)
        .select()
        .single();
      if (closedRoom) room = closedRoom;
    }

    const displayName = displayNameFor(actor, String(body.displayName || ''), booking.contact_name);
    const locale = normalizeRoomLocale(body.locale, normalizeRoomLocale(booking.preferred_language));
    const ttsCapable = typeof body.ttsCapable === 'boolean' ? body.ttsCapable : null;
    // Explicit chat-translation language (any LLM-supported language). Unlike
    // `locale` (one of the 5 UI locales), this drives what OPERATOR bubbles are
    // translated into for this guest, so a French speaker can read the driver's
    // Korean in French even though the UI chrome stays in one of the 5.
    const chatLocale = normalizeChatLocale(body.chatLocale);

    const { data: participant, error: participantError } = await supabase
      .from('tour_room_participants')
      .upsert(
        {
          room_id: room.id,
          booking_id: booking.id,
          role: actor.role,
          user_id: authUserId,
          display_name: displayName,
          locale,
          device_key: deviceKey,
          ...(chatLocale ? { chat_locale: chatLocale } : {}),
          ...(ttsCapable === null ? {} : { tts_capable: ttsCapable }),
          ...(actor.kind === 'token' && body.inviteId ? { invite_id: String(body.inviteId) } : {}),
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'room_id,device_key' },
      )
      .select()
      .single();
    if (participantError) throw participantError;

    // §5.2 C-6 — a device that entered through the lead's companion link is
    // never a lead candidate, not even in an empty room. Without this, a
    // companion opening the room before the lead ever joined would be promoted
    // by the "no lead yet" branch below and inherit /plan write rights.
    const isCompanionDevice =
      actor.kind === 'token' && isCompanionRoomToken(actor.tokenPayload);

    // P-D13 — lead guest: the first customer participant becomes the sole
    // /plan draft editor; the logged-in booking owner takes lead over on join.
    // Best-effort — a failure here never blocks entry.
    if (actor.role === 'customer' && !participant.is_lead && !isCompanionDevice) {
      try {
        const isOwner = actor.kind === 'owner' || (authUserId !== null && authUserId === booking.user_id);
        const { data: leadRows } = await supabase
          .from('tour_room_participants')
          .select('id')
          .eq('room_id', room.id)
          .eq('role', 'customer')
          .eq('is_lead', true)
          .limit(1);
        const hasLead = Array.isArray(leadRows) && leadRows.length > 0;
        if (!hasLead || isOwner) {
          if (hasLead && isOwner) {
            await supabase
              .from('tour_room_participants')
              .update({ is_lead: false, updated_at: new Date().toISOString() })
              .eq('room_id', room.id)
              .eq('is_lead', true);
          }
          const { data: promoted } = await supabase
            .from('tour_room_participants')
            .update({ is_lead: true, updated_at: new Date().toISOString() })
            .eq('id', participant.id)
            .select()
            .single();
          if (promoted) participant.is_lead = promoted.is_lead;
        }
      } catch {
        // lead flag is a nicety at join time — /plan re-checks it server-side
      }
    }

    const { session } = signRoomSession({
      roomId: room.id,
      bookingId: booking.id,
      participantId: participant.id,
      role: actor.role,
      displayName,
    });

    const snapshot = await buildRoomSnapshot(supabase, booking, room);

    return NextResponse.json(
      {
        room,
        lifecycle: snapshot.lifecycle,
        participant,
        session,
        channel: { topic: roomChannelTopic(room.id, room.status) },
        snapshot,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/join error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
