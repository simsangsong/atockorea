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
import { sendDriverRoomPush, sendGuestRoomPush } from '@/lib/tour-room/guestPush';
import { normalizeRoomLocale, CORE_TRANSLATION_LOCALES } from '@/lib/tour-room/snapshot';
import { translateTextForLocales } from '@/lib/openai-server';
import { sendEmail } from '@/lib/email';
import { sendOpsPush } from '@/lib/tour-ops/push';
import { inPostTourWindow, roomLifecycle } from '@/lib/tour-room/time';
import { isPrivateTour } from '@/lib/tour-room/tourKind';
import {
  departedPhaseAllowed,
  isRallyCrossingType,
  loadRallyNotice,
  rallyNoticeSuperseded,
  resolveRejoinStop,
  type RallyCrossingType,
} from '@/lib/tour-room/rallyCrossing';
import { rallyRemindPush, waitEndedBundle, waitEndedPush } from '@/lib/tour-room/waitEnded';
import { RALLY_GRACE_MS } from '@/lib/tour-room/notices';

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
      note?: unknown;
      // M-D3 meeting_propose — HH:MM KST + the guest-typed meeting place.
      time?: unknown;
      point?: unknown;
    };

    // SG-2 — rally crossings ride their OWN branch, BEFORE the guest
    // whitelist: they are not guest signals (the wake-locked cockpit is the
    // FIRST firer, so the driver 403 below must not apply), and joining
    // GUEST_SIGNAL_TYPES would force dummy TEMPLATES entries (2차 감사 #21).
    if (isRallyCrossingType(body.type)) {
      return handleRallyCrossing(req, bookingId, body.type, body);
    }

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

    // W5.2 / I3 — lost-item reports are a post_tour-window action (P-D12):
    // valid on the tour day AND for 48h after; other signals are live-day.
    if (type === 'lost_item') {
      const lifecycle = roomLifecycle(booking.tour_date);
      if (lifecycle === 'ended' && !inPostTourWindow(booking.tour_date)) {
        return NextResponse.json({ error: 'post_tour_window_closed' }, { status: 403 });
      }
    }

    // M-D3/M-D5 — customers SET the meeting only on PRIVATE (charter) tours:
    // a join tour runs a fixed rally schedule, so the button never shows and
    // the server refuses regardless. D-1 (lobby) is intentionally allowed —
    // "만남시간과 만남장소, 하루 전에도" is the whole point.
    if (type === 'meeting_propose') {
      const { data: tourRow } = await supabase
        .from('tours')
        .select('price_type')
        .eq('id', booking.tour_id)
        .maybeSingle();
      if (!isPrivateTour((tourRow as { price_type?: string | null } | null)?.price_type ?? null)) {
        return NextResponse.json({ error: 'private_tour_only' }, { status: 403 });
      }
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

      // W4.1 / E2 ladder fallbacks — push to opted-in devices, and the email
      // rail for guests who never opted in. Both fire-and-forget, once per
      // notice (this branch only runs on the first UNIQUE insert).
      void sendGuestRoomPush(supabase, booking, {
        translations: bundle.translations,
        tag: `overdue-${room.id}`,
      }).catch(() => undefined);
      if (booking.contact_email) {
        const locale = normalizeRoomLocale(booking.preferred_language);
        const line = bundle.translations[locale] ?? bundle.translations.en;
        void sendEmail({
          to: booking.contact_email,
          subject: line.slice(0, 120),
          html: `<p style="font-family:sans-serif;font-size:15px;line-height:1.6;">${line}</p>
<p style="font-family:sans-serif;font-size:13px;color:#6b7280;">AtoC Korea · <a href="${(process.env.NEXT_PUBLIC_SITE_URL || 'https://atockorea.com').replace(/\/$/, '')}/tour-mode/room/${booking.id}">Tour room</a></p>`,
        }).catch(() => undefined);
      }
      return NextResponse.json({ message: message ?? null }, { status: 201 });
    }

    // lost / pickup_request / dropoff_change / share_location: optional
    // one-shot pin with a TTL (§C-7 — no tracking, ever). A3: the pickup pin
    // says "come get me HERE"; guest_spot is the M-D4 "meet me exactly here"
    // pin. meeting_propose intentionally writes NO pins row — its coordinates
    // live on the message metadata (the meeting_notice contract the banner
    // reads), and a 30-minute TTL would silently expire a D-1 meeting.
    const PIN_KIND: Partial<Record<GuestSignalType, string>> = {
      lost: 'lost_me',
      pickup_request: 'pickup',
      dropoff_change: 'dropoff',
      share_location: 'guest_spot',
    };
    const latRaw = typeof body.lat === 'string' ? Number(body.lat) : body.lat;
    const lngRaw = typeof body.lng === 'string' ? Number(body.lng) : body.lng;
    const lat = typeof latRaw === 'number' && Number.isFinite(latRaw) && Math.abs(latRaw) <= 90 ? latRaw : null;
    const lng = typeof lngRaw === 'number' && Number.isFinite(lngRaw) && Math.abs(lngRaw) <= 180 ? lngRaw : null;
    const hasCoords = lat !== null && lng !== null;
    const withPin = Boolean(PIN_KIND[type]) && hasCoords;
    // M-D3 — the meeting's coordinates ride the message metadata, not a pin row.
    const meetingCoords = type === 'meeting_propose' && hasCoords;

    // M-D3 — meeting_propose contract: the TIME drives the countdown banner
    // (required); the place is a typed name and/or the current-location pin —
    // at least one, or the driver has nowhere to navigate.
    const meetTime =
      type === 'meeting_propose' && typeof body.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.time.trim())
        ? body.time.trim()
        : undefined;
    const meetPoint =
      type === 'meeting_propose' && typeof body.point === 'string'
        ? body.point.trim().slice(0, 120) || undefined
        : undefined;
    if (type === 'meeting_propose') {
      if (!meetTime) {
        return NextResponse.json({ error: 'time (HH:MM) is required' }, { status: 400 });
      }
      if (!meetPoint && !hasCoords) {
        return NextResponse.json({ error: 'point or lat/lng is required' }, { status: 400 });
      }
    }

    let pinId: string | null = null;
    if (withPin) {
      const { data: pin } = await supabase
        .from('tour_room_pins')
        .insert({
          room_id: room.id,
          kind: PIN_KIND[type],
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

    // A3/B2 / T2-2 — guest-typed free text (dropoff place · lost-item "black
    // wallet, seat 12" · M-D3 meeting place): translate it so the Korean
    // operator reads it natively (verbatim fallback on failure).
    const note =
      (type === 'dropoff_change' || type === 'lost_item') && typeof body.note === 'string'
        ? body.note.trim().slice(0, 200) || undefined
        : meetPoint;
    let noteByLocale: Record<string, string> | null = null;
    if (note) {
      try {
        noteByLocale = (await translateTextForLocales(note, [...CORE_TRANSLATION_LOCALES])).translations;
      } catch {
        noteByLocale = null;
      }
    }

    const bundle = renderGuestSignal(
      type,
      {
        name: displayName,
        mapsUrl: withPin || meetingCoords ? googleMapsPinUrl(lat!, lng!) : undefined,
        note,
        time: meetTime,
      },
      noteByLocale,
    );
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
          // M-D3 — meeting_propose speaks the guide's meeting_notice contract,
          // so NoticeBanner's countdown / warnings / rally ladder run unchanged.
          kind: type === 'meeting_propose' ? 'meeting_notice' : `guest_${type}`,
          signal_type: type,
          sent_by_role: actor.role,
          ...(withPin ? { lat, lng, pin_id: pinId } : {}),
          ...(type === 'meeting_propose'
            ? {
                proposed_by: actor.role,
                meeting_time: meetTime,
                ...(note ? { meeting_point: note } : {}),
                ...(noteByLocale ? { meeting_point_i18n: noteByLocale } : {}),
                ...(meetingCoords ? { meeting_lat: lat, meeting_lng: lng } : {}),
              }
            : {}),
        },
      })
      .select()
      .single();
    if (messageError) throw messageError;

    await broadcastToRoom(room, 'message', { message });

    // A3/M-D3 — location-bearing requests must reach the operator who is
    // likely in a nav app: ring the driver/guide devices (fire-and-forget).
    if (
      type === 'pickup_request' ||
      type === 'dropoff_change' ||
      type === 'share_location' ||
      type === 'meeting_propose'
    ) {
      const line = bundle.translations.ko ?? bundle.source_text;
      void sendDriverRoomPush(supabase, booking.id, {
        body: line.slice(0, 160),
        tag: `${type}-${room.id}`,
      }).catch(() => undefined);
    }

    // I3 — lost items also ping the ops consoles (the driver/guide may have
    // already left the room surface for the day).
    if (type === 'lost_item') {
      void sendOpsPush({
        title: '🧳 분실물 신고',
        body: `booking ${booking.id.slice(0, 8)} — 손님이 분실물을 신고했어요 (차량 확인 요청).`,
        tag: `lost-item-${room.id}`,
      }).catch(() => undefined);
      void sendOpsPush(
        {
          title: '🧳 분실물 신고',
          body: `booking ${booking.id.slice(0, 8)} — 손님이 분실물을 신고했어요 (차량 확인 요청).`,
          tag: `lost-item-${room.id}`,
        },
        { role: 'guide' },
      ).catch(() => undefined);
    }

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

/**
 * SG-2 — the rally crossing handler (remind / departed / all_aboard /
 * extended). Own actor resolution (drivers ALLOWED — the cockpit is the
 * wake-locked first firer), own rate namespace (a 6-guest simultaneous
 * crossing must not starve the guest-signal bucket), and the server-side
 * validation ladder of SG-D6: the client's noticeId is a CLAIM, everything
 * else is re-derived here.
 */
async function handleRallyCrossing(
  req: NextRequest,
  bookingId: string,
  type: RallyCrossingType,
  body: { noticeId?: unknown; manual?: unknown; next_notice_id?: unknown },
) {
  const supabase = createServerClient();
  const noticeId =
    typeof body.noticeId === 'string' && body.noticeId.trim() ? body.noticeId.trim().slice(0, 64) : null;
  if (!noticeId) {
    return NextResponse.json({ error: 'noticeId is required' }, { status: 400 });
  }

  const resolved = await resolveRoomActor(req, bookingId, { supabase });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { booking, actor } = resolved;
  const staff = actor.role === 'guide' || actor.role === 'driver' || actor.role === 'admin';

  const gate = await requestGate({
    namespace: 'tour_room_rally_crossing',
    key: `booking:${booking.id}`,
    perMinute: 10,
    perHour: 60,
  });
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
    );
  }

  const room = await ensureRoom(supabase, booking);
  const loaded = await loadRallyNotice(supabase, room.id, booking.tour_date, noticeId);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }
  const actorParticipantId = actor.kind === 'session' ? actor.sessionPayload.participantId : null;

  // ── T-10 reminder — push only, once per notice ─────────────────────────
  if (type === 'rally_remind') {
    if (Date.now() >= loaded.targetMs) {
      return NextResponse.json({ error: 'reminder_window_passed' }, { status: 409 });
    }
    const recorded = await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: booking.id,
      type: 'rally_stage',
      actorRole: actor.role,
      actorParticipantId,
      subjectKey: `rally:${noticeId}:remind`,
      payload: { stage: 'remind', notice_id: noticeId },
    });
    if (!recorded.inserted) return NextResponse.json({ deduped: true }, { status: 200 });
    void sendGuestRoomPush(supabase, booking, {
      translations: rallyRemindPush(loaded.targetMs, loaded.meetingPoint),
      tag: `remind-${noticeId}`,
    }).catch(() => undefined);
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  // ── staff resolutions: all aboard / extended ───────────────────────────
  if (type === 'rally_all_aboard' || type === 'rally_extended') {
    if (!staff) {
      return NextResponse.json({ error: 'staff_only' }, { status: 403 });
    }
    const nextNoticeId =
      type === 'rally_extended' && typeof body.next_notice_id === 'string'
        ? body.next_notice_id.slice(0, 64)
        : null;
    if (type === 'rally_extended' && !nextNoticeId) {
      return NextResponse.json({ error: 'next_notice_id is required' }, { status: 400 });
    }
    const recorded = await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: booking.id,
      // 🔴 One subject AND one type for every outcome — the UNIQUE index is
      // (room, subject, type); different types would resurrect the TOCTOU.
      type: 'rally_resolution',
      actorRole: actor.role,
      actorParticipantId,
      subjectKey: `rally:${noticeId}:resolution`,
      payload:
        type === 'rally_all_aboard'
          ? { outcome: 'all_aboard', notice_id: noticeId }
          : { outcome: 'extended', notice_id: noticeId, next_notice_id: nextNoticeId },
    });
    return NextResponse.json(
      { ok: true, deduped: !recorded.inserted },
      { status: recorded.inserted ? 201 : 200 },
    );
  }

  // ── departed — the full ladder ─────────────────────────────────────────
  const manual = body.manual === true;
  if (manual && !staff) {
    return NextResponse.json({ error: 'staff_only' }, { status: 403 });
  }
  if (!departedPhaseAllowed(Date.now(), loaded.targetMs, manual)) {
    return NextResponse.json({ error: 'outside_departed_window' }, { status: 409 });
  }
  if (await rallyNoticeSuperseded(supabase, room.id, loaded.createdAtIso, noticeId)) {
    // An extension / cancel / next stop's bundle replaced this notice — the
    // stale crossing dissolves silently (the new notice runs its own ladder).
    return new NextResponse(null, { status: 204 });
  }
  if (!manual) {
    const resolution = await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: booking.id,
      type: 'rally_resolution',
      actorRole: actor.role,
      actorParticipantId,
      subjectKey: `rally:${noticeId}:resolution`,
      payload: { outcome: 'departed', notice_id: noticeId },
    });
    if (!resolution.inserted) {
      // all_aboard or extended won the resolution — no capsule, by design.
      return NextResponse.json({ deduped: true }, { status: 200 });
    }
  } else {
    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: booking.id,
      type: 'rally_stage',
      actorRole: actor.role,
      actorParticipantId,
      subjectKey: `rally:${noticeId}:manual_departed`,
      payload: { stage: 'manual_departed', notice_id: noticeId },
    });
  }

  // Capsule idempotency is its OWN subject: a manual declaration after a
  // mistaken [전원 탑승] must still be able to fire exactly one capsule.
  const capsule = await recordRoomEvent(supabase, {
    roomId: room.id,
    bookingId: booking.id,
    type: 'wait_ended',
    actorRole: actor.role,
    actorParticipantId,
    subjectKey: `rally:${noticeId}:capsule`,
    payload: { notice_id: noticeId, manual },
  });
  if (!capsule.inserted) {
    return NextResponse.json({ deduped: true }, { status: 200 });
  }

  const departedAtMs = loaded.targetMs + RALLY_GRACE_MS;
  const rejoin = await resolveRejoinStop(
    supabase,
    booking.id,
    booking.tour_date,
    loaded.targetMs,
    booking.tour_id ?? null,
  );
  const bundle = waitEndedBundle({
    departedAtMs,
    meetingPoint: loaded.meetingPoint,
    nextStopName: rejoin?.name ?? null,
  });
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
      metadata: {
        kind: 'wait_ended',
        notice_id: noticeId,
        departed_at_ms: departedAtMs,
        meeting_point: loaded.meetingPoint,
        next_stop_name: rejoin?.name ?? null,
        next_stop_time: rejoin?.time ?? null,
        next_poi_key: rejoin?.poiKey ?? null,
        manual,
      },
    })
    .select()
    .single();
  if (message) await broadcastToRoom(room, 'message', { message });

  // The MORE critical capsule gets the SAME fallback rails overdue has —
  // v1.1 shipped them inverted (2차 감사 #7).
  void sendGuestRoomPush(supabase, booking, {
    translations: waitEndedPush({ departedAtMs }),
    tag: `departed-${noticeId}`,
  }).catch(() => undefined);
  if (booking.contact_email) {
    const locale = normalizeRoomLocale(booking.preferred_language);
    const line = bundle.translations[locale] ?? bundle.translations.en;
    void sendEmail({
      to: booking.contact_email,
      subject: line.slice(0, 120),
      html: `<p style="font-family:sans-serif;font-size:15px;line-height:1.6;">${line}</p>
<p style="font-family:sans-serif;font-size:13px;color:#6b7280;">AtoC Korea · <a href="${(process.env.NEXT_PUBLIC_SITE_URL || 'https://atockorea.com').replace(/\/$/, '')}/tour-mode/room/${booking.id}">Tour room</a></p>`,
    }).catch(() => undefined);
  }
  return NextResponse.json({ message: message ?? null }, { status: 201 });
}
