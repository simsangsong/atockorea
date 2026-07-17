import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import {
  DRIVER_DELAY_MINUTES,
  googleMapsPinUrl,
  renderDriverSignal,
  type DriverSignalType,
} from '@/lib/tour-room/driverSignals';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { renderSpotEventTranslations } from '@/lib/tour-room/spotContent';
import { sendOpsPush } from '@/lib/tour-ops/push';
import { sendGuestRoomPush } from '@/lib/tour-room/guestPush';

export const dynamic = 'force-dynamic';

/**
 * W3 — driver one-tap signals (SIGNAL primitive, P-D15).
 *
 * POST /api/tour-rooms/[bookingId]/driver-signal
 *   { type: 'delay'|'parking_pin'|'vehicle_arrived'|'vehicle_issue',
 *     minutes?, lat?, lng? }
 *
 * Fixed 5-locale templates (zero LLM). parking_pin / vehicle_arrived with
 * coords also write a one-shot tour_room_pins row (PIN primitive — an
 * explicit action snapshot, never a tracking stream). vehicle_issue
 * additionally pings ops push subscribers.
 *
 * 'return_time' (E1/E8 for solo drivers) posts the same free_time_timer
 * metadata the guide console's timer uses, so the guests' countdown banner
 * and the concierge's time-left Tier0 answer light up unchanged. Pass
 * cancel:true to clear it.
 */

const SIGNAL_TYPES: Array<DriverSignalType | 'return_time'> = [
  'delay',
  'parking_pin',
  'vehicle_arrived',
  'vehicle_issue',
  'return_time',
];

function numberOrNull(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as {
      type?: unknown;
      minutes?: unknown;
      lat?: unknown;
      lng?: unknown;
      time?: unknown;
      point?: unknown;
      cancel?: unknown;
    };

    const type = SIGNAL_TYPES.includes(body.type as DriverSignalType | 'return_time')
      ? (body.type as DriverSignalType | 'return_time')
      : null;
    if (!type) {
      return NextResponse.json({ error: `type must be one of: ${SIGNAL_TYPES.join(', ')}` }, { status: 400 });
    }

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor, authUserId } = resolved;
    if (actor.role !== 'driver' && actor.role !== 'guide' && actor.role !== 'admin') {
      return NextResponse.json({ error: 'Driver, guide, or admin only' }, { status: 403 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_driver_signal',
      key: `booking:${booking.id}`,
      perMinute: 6,
      perHour: 60,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    let minutes: number | null = null;
    if (type === 'delay') {
      minutes = numberOrNull(body.minutes);
      if (!minutes || !(DRIVER_DELAY_MINUTES as readonly number[]).includes(minutes)) {
        return NextResponse.json(
          { error: `minutes must be one of: ${DRIVER_DELAY_MINUTES.join(', ')}` },
          { status: 400 },
        );
      }
    }

    const lat = numberOrNull(body.lat);
    const lng = numberOrNull(body.lng);
    const hasCoords = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    const withPin = (type === 'parking_pin' || type === 'vehicle_arrived') && hasCoords;
    if (type === 'parking_pin' && !hasCoords) {
      return NextResponse.json({ error: 'lat and lng are required for parking_pin' }, { status: 400 });
    }

    const room = await ensureRoom(supabase, booking);

    // One-shot pin (PIN primitive) — TTL: end of the day handles itself via
    // room lifecycle; lost pins are harmless labels on a closed room.
    let pinId: string | null = null;
    if (withPin) {
      const { data: pin } = await supabase
        .from('tour_room_pins')
        .insert({
          room_id: room.id,
          kind: type === 'parking_pin' ? 'parking' : 'vehicle_arrived',
          lat,
          lng,
          created_by_role: actor.role,
          created_by_participant_id: actor.kind === 'session' ? actor.sessionPayload.participantId : null,
        })
        .select('id')
        .single();
      pinId = (pin as { id?: string } | null)?.id ?? null;
    }

    // return_time reuses the guide timer's exact metadata contract so the
    // existing NoticeBanner countdown + Tier0 time-left answers just work.
    let bundle: { source_locale: string; source_text: string; translations: Record<string, string> };
    let metadata: Record<string, unknown>;
    if (type === 'return_time') {
      const cancel = body.cancel === true;
      const time = typeof body.time === 'string' ? body.time.trim() : '';
      const point = (typeof body.point === 'string' ? body.point.trim().slice(0, 120) : '') || 'the vehicle';
      if (!cancel && !/^\d{2}:\d{2}$/.test(time)) {
        return NextResponse.json({ error: 'time (HH:MM, KST) is required for return_time' }, { status: 400 });
      }
      bundle = cancel
        ? renderSpotEventTranslations('free_time_cancelled', { point })
        : renderSpotEventTranslations('free_time', { time, point });
      metadata = {
        kind: 'free_time_timer',
        ...(cancel ? { cancelled: true } : { until_time: time }),
        meeting_point: point,
        sent_by_role: actor.role,
      };
    } else {
      bundle = renderDriverSignal(type, {
        minutes: minutes ?? undefined,
        mapsUrl: withPin ? googleMapsPinUrl(lat!, lng!) : undefined,
      });
      metadata = {
        kind: `driver_${type}`,
        signal_type: type,
        minutes,
        ...(withPin ? { lat, lng, pin_id: pinId } : {}),
        sent_by_role: actor.role,
      };
    }

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
        metadata,
      })
      .select()
      .single();
    if (messageError) throw messageError;

    await broadcastToRoom(room, 'message', { message });

    // W4.1 / P-D7 — delay + return-time also ring opted-in guest devices.
    if (type === 'delay' || (type === 'return_time' && body.cancel !== true)) {
      void sendGuestRoomPush(supabase, booking, {
        translations: bundle.translations,
        tag: `${type}-${room.id}`,
      }).catch(() => undefined);
    }

    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: booking.id,
      type: 'signal',
      actorRole: actor.role,
      actorParticipantId: actor.kind === 'session' ? actor.sessionPayload.participantId : null,
      payload: { signal: type, minutes, lat: withPin ? lat : null, lng: withPin ? lng : null },
    }).catch(() => undefined);

    // Vehicle trouble is an ops matter too (mirrors the SOS push, softer tone).
    if (type === 'vehicle_issue') {
      void sendOpsPush({
        title: '🚐 차량 문제 신고 (기사)',
        body: `booking ${booking.id.slice(0, 8)} — 기사님이 차량 문제를 보고했습니다.`,
        tag: `vehicle-issue-${room.id}`,
      }).catch(() => undefined);
    }

    return NextResponse.json({ message, pin_id: pinId }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/driver-signal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
