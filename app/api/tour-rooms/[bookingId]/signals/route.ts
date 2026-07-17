import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { googleMapsPinUrl } from '@/lib/tour-room/driverSignals';
import {
  GUEST_SIGNAL_TYPES,
  LOST_PIN_TTL_MS,
  renderGuestSignal,
  type GuestSignalType,
} from '@/lib/tour-room/guestSignals';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { broadcastToRoom } from '@/lib/tour-room/realtime';

export const dynamic = 'force-dynamic';

/**
 * W2.4 — guest one-tap signals (§M `signals`, SIGNAL primitive).
 *
 * POST /api/tour-rooms/[bookingId]/signals
 *   { type: 'running_late'|'rest_stop'|'lost'|'rally_overdue',
 *     lat?, lng?,            // lost: writes a one-shot lost_me pin (TTL 30min)
 *     noticeId? }            // rally_overdue: the notice message id → dedupe key
 *
 * Role whitelist: customers (and guide/admin on their behalf). Drivers have
 * their own signal set (driver-signal). Fixed 5-locale templates, zero LLM.
 *
 * rally_overdue is the E2 ladder's T+5 side-effect (P-D6): every guest
 * client crossing the threshold calls this, the events UNIQUE
 * (room, subject_key, type) makes exactly one insert win, and only the
 * winner fans out the "party hasn't returned" capsule.
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as {
      type?: unknown;
      lat?: unknown;
      lng?: unknown;
      noticeId?: unknown;
    };

    const type = (GUEST_SIGNAL_TYPES as readonly string[]).includes(body.type as string)
      ? (body.type as GuestSignalType)
      : null;
    if (!type) {
      return NextResponse.json(
        { error: `type must be one of: ${GUEST_SIGNAL_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor, authUserId } = resolved;
    if (actor.role === 'driver') {
      return NextResponse.json({ error: 'Drivers use driver-signal' }, { status: 403 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_guest_signal',
      key: `booking:${booking.id}`,
      perMinute: 6,
      perHour: 40,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    const room = await ensureRoom(supabase, booking);
    const displayName =
      actor.kind === 'token' || actor.kind === 'session'
        ? actor.displayName
        : booking.contact_name ?? undefined;

    // E2 T+5 crossing — idempotent per notice: first client in wins, the rest
    // are 200 {deduped:true} no-ops.
    if (type === 'rally_overdue') {
      const noticeId = typeof body.noticeId === 'string' && body.noticeId.trim() ? body.noticeId.trim().slice(0, 64) : null;
      if (!noticeId) {
        return NextResponse.json({ error: 'noticeId is required for rally_overdue' }, { status: 400 });
      }
      const recorded = await recordRoomEvent(supabase, {
        roomId: room.id,
        bookingId: booking.id,
        type: 'rally_stage',
        actorRole: actor.role,
        actorParticipantId: actor.kind === 'session' ? actor.sessionPayload.participantId : null,
        subjectKey: `rally:${noticeId}:overdue`,
        payload: { stage: 'overdue', notice_id: noticeId },
      });
      if (!recorded.inserted) {
        return NextResponse.json({ deduped: true }, { status: 200 });
      }
      const bundle = renderGuestSignal('rally_overdue');
      const { data: message } = await supabase
        .from('tour_room_messages')
        .insert({
          room_id: room.id,
          booking_id: booking.id,
          sender_role: 'system',
          input_kind: 'text',
          source_text: bundle.source_text,
          source_locale: bundle.source_locale,
          translations: bundle.translations,
          target_locales: Object.keys(bundle.translations),
          metadata: { kind: 'rally_overdue', notice_id: noticeId },
        })
        .select()
        .single();
      if (message) await broadcastToRoom(room, 'message', { message });
      return NextResponse.json({ message: message ?? null }, { status: 201 });
    }

    // lost: optional one-shot pin with a TTL (§C-7 — no tracking, ever).
    const latRaw = typeof body.lat === 'string' ? Number(body.lat) : body.lat;
    const lngRaw = typeof body.lng === 'string' ? Number(body.lng) : body.lng;
    const lat = typeof latRaw === 'number' && Number.isFinite(latRaw) && Math.abs(latRaw) <= 90 ? latRaw : null;
    const lng = typeof lngRaw === 'number' && Number.isFinite(lngRaw) && Math.abs(lngRaw) <= 180 ? lngRaw : null;
    const withPin = type === 'lost' && lat !== null && lng !== null;

    let pinId: string | null = null;
    if (withPin) {
      const { data: pin } = await supabase
        .from('tour_room_pins')
        .insert({
          room_id: room.id,
          kind: 'lost_me',
          lat,
          lng,
          label: displayName ?? null,
          expires_at: new Date(Date.now() + LOST_PIN_TTL_MS).toISOString(),
          created_by_role: actor.role,
          created_by_participant_id: actor.kind === 'session' ? actor.sessionPayload.participantId : null,
        })
        .select('id')
        .single();
      pinId = (pin as { id?: string } | null)?.id ?? null;
    }

    const bundle = renderGuestSignal(type, {
      name: displayName,
      mapsUrl: withPin ? googleMapsPinUrl(lat!, lng!) : undefined,
    });
    const { data: message, error: messageError } = await supabase
      .from('tour_room_messages')
      .insert({
        room_id: room.id,
        booking_id: booking.id,
        sender_user_id: authUserId,
        sender_role: 'system',
        input_kind: 'text',
        source_text: bundle.source_text,
        source_locale: bundle.source_locale,
        translations: bundle.translations,
        target_locales: Object.keys(bundle.translations),
        metadata: {
          kind: `guest_${type}`,
          signal_type: type,
          sent_by_role: actor.role,
          ...(withPin ? { lat, lng, pin_id: pinId } : {}),
        },
      })
      .select()
      .single();
    if (messageError) throw messageError;

    await broadcastToRoom(room, 'message', { message });

    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: booking.id,
      type: 'signal',
      actorRole: actor.role,
      actorParticipantId: actor.kind === 'session' ? actor.sessionPayload.participantId : null,
      payload: { signal: type, lat: withPin ? lat : null, lng: withPin ? lng : null },
    }).catch(() => undefined);

    return NextResponse.json({ message, pin_id: pinId }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/signals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
