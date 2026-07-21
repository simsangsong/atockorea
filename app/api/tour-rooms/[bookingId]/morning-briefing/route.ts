import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { sendGuestRoomPush } from '@/lib/tour-room/guestPush';
import { composeMorningBriefing, type BriefingKind } from '@/lib/tour-room/morningBriefing';
import { baseHoursForCity, OVERTIME_RATE_KRW_PER_HOUR } from '@/lib/tour-room/overtime';
import { cityCoords, fetchDayWeather, renderWeatherLines } from '@/lib/tour-room/weather';

export const dynamic = 'force-dynamic';

/**
 * A1 — morning briefing (docs/smart-guide-ops-detail-audit-2026-07-21.md).
 *
 * POST /api/tour-rooms/[bookingId]/morning-briefing  {}
 *
 * The tour's opening speech, one operator tap at pickup. The shape follows
 * the tour's price model: shared (person/group) → the JOIN briefing fanned
 * out to every booking of the day; private charter (vehicle) → the PRIVATE
 * briefing with the city's included hours (Jeju 9h / Busan 8h) and the
 * ₩30,000/h cash overtime rule — interpolated from the same constants the
 * settlement sheet uses, so the promise can never drift from the arithmetic.
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
    if (actor.role !== 'guide' && actor.role !== 'driver' && actor.role !== 'admin') {
      return NextResponse.json({ error: 'Guide, driver, or admin only' }, { status: 403 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_morning_briefing',
      key: `booking:${booking.id}`,
      perMinute: 2,
      perHour: 10,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    // Tour shape: shared → join briefing + day-wide fan-out (Model B).
    let isShared = false;
    let city: string | null = null;
    if (booking.tour_id) {
      const { data: tourRow } = await supabase
        .from('tours')
        .select('price_type, city')
        .eq('id', booking.tour_id)
        .maybeSingle();
      const tour = tourRow as { price_type?: string; city?: string | null } | null;
      isShared = tour?.price_type === 'person' || tour?.price_type === 'group';
      city = tour?.city ?? null;
    }
    const kind: BriefingKind = isShared ? 'join' : 'private';
    const bundle = composeMorningBriefing({
      kind,
      baseHours: baseHoursForCity(city),
      rateKrw: OVERTIME_RATE_KRW_PER_HOUR,
    });

    // B6 — today's weather + clothing hint (Open-Meteo, keyless, 4s budget).
    // Best-effort: a fetch miss just omits the line.
    const coords = cityCoords(city);
    if (coords && booking.tour_date) {
      const weather = await fetchDayWeather(coords, booking.tour_date);
      if (weather) {
        const weatherLines = renderWeatherLines(weather);
        for (const locale of Object.keys(bundle.translations)) {
          const line = weatherLines[locale];
          if (line) bundle.translations[locale] += `\n${line}`;
        }
        bundle.source_text = bundle.translations.en;
      }
    }

    type TargetBooking = { id: string; tour_id: string | null; tour_date: string | null };
    let targetBookings: TargetBooking[] = [booking as TargetBooking];
    if (isShared && booking.tour_id && booking.tour_date) {
      const { data: dayBookings } = await supabase
        .from('bookings')
        .select('id, tour_id, tour_date, preferred_language')
        .eq('tour_id', booking.tour_id)
        .eq('tour_date', booking.tour_date)
        .neq('status', 'cancelled');
      if (dayBookings && dayBookings.length > 0) targetBookings = dayBookings as TargetBooking[];
    }

    const actorParticipantId = actor.kind === 'session' ? actor.sessionPayload.participantId : null;
    let primaryMessage: unknown = null;
    let delivered = 0;

    for (const target of targetBookings) {
      try {
        const room = await ensureRoom(supabase, target);
        const isSender = target.id === booking.id;
        const { data: message, error: messageError } = await supabase
          .from('tour_room_messages')
          .insert({
            room_id: room.id,
            booking_id: target.id,
            sender_user_id: authUserId,
            sender_role: 'system',
            input_kind: 'text',
            source_text: bundle.source_text,
            source_locale: bundle.source_locale,
            translations: bundle.translations,
            target_locales: Object.keys(bundle.translations),
            metadata: {
              kind: 'morning_briefing',
              briefing_kind: kind,
              base_hours: kind === 'private' ? baseHoursForCity(city) : null,
              sent_by_role: actor.role,
              ...(targetBookings.length > 1 ? { fanout: true } : {}),
            },
          })
          .select()
          .single();
        if (messageError) throw messageError;

        await broadcastToRoom(room, 'message', { message });
        // The day's kickoff — worth a ring on opted-in devices.
        void sendGuestRoomPush(supabase, target, {
          translations: bundle.translations,
          tag: `morning-briefing-${room.id}`,
        }).catch(() => undefined);

        await recordRoomEvent(supabase, {
          roomId: room.id,
          bookingId: target.id,
          type: 'morning_briefing',
          actorRole: actor.role,
          actorParticipantId: isSender ? actorParticipantId : null,
          payload: { briefing_kind: kind },
        }).catch(() => undefined);

        if (isSender) primaryMessage = message;
        delivered += 1;
      } catch (roomFailure) {
        console.warn('morning-briefing room delivery failed:', target.id, roomFailure);
      }
    }

    if (delivered === 0) {
      return NextResponse.json({ error: 'Delivery failed for every room' }, { status: 500 });
    }
    return NextResponse.json({ message: primaryMessage, delivered, kind }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/morning-briefing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
