import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import {
  DRIVER_DELAY_MINUTES,
  DRIVER_SIGNAL_TYPES,
  ETA_REPLY_MINUTES,
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

/**
 * Every signal that renders a guest capsule, plus this route's own extras.
 *
 * 🔴 Spelled out by hand until the feature audit: adding a type to
 * `driverSignals.ts` and forgetting it here meant a 400 from a button the
 * cockpit was already showing. Derived now, so the list cannot fall behind.
 * `return_time` and the say-queue entries stay literal — they are this route's
 * bookkeeping and render no capsule, so they are deliberately not in the bundle.
 */
const SIGNAL_TYPES: Array<DriverSignalType | 'return_time' | 'say_dismissed' | 'say_expired'> = [
  ...DRIVER_SIGNAL_TYPES,
  'return_time',
  // SG-6 — say-queue bookkeeping: no message, no fan-out, just the event
  // ledger (dismissals dedupe the queue; expiries are N-5's decision data).
  'say_dismissed',
  'say_expired',
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

    const type = SIGNAL_TYPES.includes(body.type as (typeof SIGNAL_TYPES)[number])
      ? (body.type as (typeof SIGNAL_TYPES)[number])
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

    // SG-6 -- say-queue bookkeeping: ledger row only, then done. Before the
    // heavy per-type flows because it needs none of them.
    if (type === 'say_dismissed' || type === 'say_expired') {
      const subjectRaw = typeof (body as { subject?: unknown }).subject === 'string'
        ? ((body as { subject: string }).subject).trim().slice(0, 120)
        : '';
      if (!subjectRaw) {
        return NextResponse.json({ error: 'subject is required' }, { status: 400 });
      }
      const room = await ensureRoom(supabase, booking);
      const recorded = await recordRoomEvent(supabase, {
        roomId: room.id,
        bookingId: booking.id,
        type,
        actorRole: actor.role,
        actorParticipantId: actor.kind === 'session' ? actor.sessionPayload.participantId : null,
        subjectKey: `${type}:${subjectRaw}`,
        payload: { subject: subjectRaw },
      });
      return NextResponse.json(
        { ok: true, deduped: !recorded.inserted },
        { status: recorded.inserted ? 201 : 200 },
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
    if (type === 'eta_reply') {
      minutes = numberOrNull(body.minutes);
      if (!minutes || !(ETA_REPLY_MINUTES as readonly number[]).includes(minutes)) {
        return NextResponse.json(
          { error: `minutes must be one of: ${ETA_REPLY_MINUTES.join(', ')}` },
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

    // Build the (room-independent) message bundle + base metadata once.
    // return_time reuses the guide timer's exact metadata contract so the
    // existing NoticeBanner countdown + Tier0 time-left answers just work.
    let bundle: { source_locale: string; source_text: string; translations: Record<string, string> };
    let baseMetadata: Record<string, unknown>;
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
      baseMetadata = {
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
      baseMetadata = {
        kind: `driver_${type}`,
        signal_type: type,
        minutes,
        ...(withPin ? { lat, lng } : {}),
        sent_by_role: actor.role,
      };
    }

    // Bus-wide fan-out (Model B, T2 slice 3): a SHARED tour (price_type
    // 'person'/'group' — bus / small-group) delivers the driver's one-tap signal
    // to EVERY booking on the day, so 타세요 / 주차핀 / 차량도착 / 지연 reach the
    // whole vehicle. A PRIVATE charter (vehicle) stays a single room.
    let isShared = false;
    // A3 — eta_reply answers ONE party's pickup/drop-off request; it must
    // never fan out bus-wide.
    if (type !== 'eta_reply' && booking.tour_id && booking.tour_date) {
      const { data: tourRow } = await supabase
        .from('tours')
        .select('price_type')
        .eq('id', booking.tour_id)
        .maybeSingle();
      const priceType = (tourRow as { price_type?: string } | null)?.price_type;
      isShared = priceType === 'person' || priceType === 'group';
    }

    type TargetBooking = { id: string; tour_id: string | null; tour_date: string | null; preferred_language?: string | null };
    let targetBookings: TargetBooking[] = [booking as TargetBooking];
    if (isShared) {
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
    let primaryPinId: string | null = null;

    for (const target of targetBookings) {
      const room = await ensureRoom(supabase, target);
      const isSender = target.id === booking.id;

      // One-shot pin per room (PIN primitive) — a parking/arrival pin belongs to
      // every room on the vehicle. TTL handles itself via room lifecycle.
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
            created_by_participant_id: isSender ? actorParticipantId : null,
          })
          .select('id')
          .single();
        pinId = (pin as { id?: string } | null)?.id ?? null;
      }

      const metadata = { ...baseMetadata, ...(withPin ? { pin_id: pinId } : {}) };
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
          metadata,
        })
        .select()
        .single();
      if (messageError) throw messageError;

      await broadcastToRoom(room, 'message', { message });

      // W4.1 / P-D7 — delay + return-time + eta-reply ring opted-in guest
      // devices (the eta_reply guest is away from the vehicle, waiting).
      if (type === 'delay' || type === 'eta_reply' || (type === 'return_time' && body.cancel !== true)) {
        void sendGuestRoomPush(supabase, target, {
          translations: bundle.translations,
          tag: `${type}-${room.id}`,
        }).catch(() => undefined);
      }

      await recordRoomEvent(supabase, {
        roomId: room.id,
        bookingId: target.id,
        type: 'signal',
        actorRole: actor.role,
        actorParticipantId: isSender ? actorParticipantId : null,
        payload: { signal: type, minutes, lat: withPin ? lat : null, lng: withPin ? lng : null },
      }).catch(() => undefined);

      if (isSender) {
        primaryMessage = message;
        primaryPinId = pinId;
      }
    }

    // Vehicle trouble is an ops matter (once for the vehicle, not per booking).
    if (type === 'vehicle_issue') {
      void sendOpsPush({
        title: '🚐 차량 문제 신고 (기사)',
        body: `booking ${booking.id.slice(0, 8)} — 기사님이 차량 문제를 보고했습니다.`,
        tag: `vehicle-issue-${booking.id}`,
      }).catch(() => undefined);
    }

    /**
     * A found item has to reach ops as well as the guests.
     *
     * The room capsule covers the likely owner, but by the time the van is
     * cleaned the guests may have closed the app for good — and ops is who
     * physically stores the item and answers the claim. The guest's own
     * `lost_item` already pushes here; this is the same desk hearing about the
     * same object from the other end.
     */
    if (type === 'found_item') {
      void sendOpsPush({
        title: '🧳 분실물 발견 (기사)',
        body: `booking ${booking.id.slice(0, 8)} — 기사님이 차량에서 물건을 발견했습니다 (보관·연락 필요).`,
        tag: `found-item-${booking.id}`,
      }).catch(() => undefined);
    }

    return NextResponse.json(
      { message: primaryMessage, pin_id: primaryPinId, delivered: targetBookings.length },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/driver-signal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
