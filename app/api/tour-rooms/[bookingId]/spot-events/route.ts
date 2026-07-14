import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { translateTextForLocales } from '@/lib/openai-server';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';

export const dynamic = 'force-dynamic';

const DEFAULT_TARGET_LOCALES = ['en', 'ko', 'zh', 'ja', 'es'];
const DEFAULT_ARRIVAL_RADIUS_M = 3000;

type SpotEventType = 'arrived' | 'audio_played' | 'meeting_notice_sent';

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLocales(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.map(String).filter(Boolean))];
  if (typeof value === 'string' && value.trim()) {
    return [...new Set(value.split(',').map((v) => v.trim()).filter(Boolean))];
  }
  return DEFAULT_TARGET_LOCALES;
}

function sourceTextForEvent(
  eventType: SpotEventType,
  spot: { title: string; audio_url?: string | null },
  payload: Record<string, unknown>,
): string {
  if (eventType === 'meeting_notice_sent') {
    const meetingTime = String(payload.meetingTime || '').trim();
    const meetingPoint = String(payload.meetingPoint || 'the drop-off point').trim();
    return meetingTime
      ? `Meeting time is ${meetingTime}. Please gather at ${meetingPoint}.`
      : `Please gather at ${meetingPoint}.`;
  }

  if (eventType === 'audio_played') {
    return `Audio guide started for ${spot.title}.`;
  }

  return spot.audio_url
    ? `You have arrived near ${spot.title}. Tap the audio guide button to play the guide.`
    : `You have arrived near ${spot.title}.`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const body = await req.json().catch(() => ({}));
    const eventType = String(body.eventType || body.event_type || '') as SpotEventType;
    const spotId = String(body.spotId || body.spot_id || '');

    if (!['arrived', 'audio_played', 'meeting_notice_sent'].includes(eventType)) {
      return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
    }
    if (!spotId) {
      return NextResponse.json({ error: 'spotId is required' }, { status: 400 });
    }

    // PA-4: guest email-match path stays throttled per-IP (gate fires only when
    // no stronger credential authenticated the request — pre-refactor ordering).
    const resolved = await resolveRoomActor(req, bookingId, {
      supabase,
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

    // Meeting notices are guide/admin only. Guide-role actors now include the
    // tour-date invite token (§O-3), not just merchant accounts.
    if (eventType === 'meeting_notice_sent' && actor.role !== 'admin' && actor.role !== 'guide') {
      return NextResponse.json({ error: 'Only guides can send meeting time notices' }, { status: 403 });
    }

    const { data: spot, error: spotError } = await supabase
      .from('tour_guide_spots')
      .select('id, tour_id, title, description, audio_url, latitude, longitude, trigger_radius_m')
      .eq('id', spotId)
      .single();
    if (spotError || !spot) {
      return NextResponse.json({ error: 'Tour guide spot not found' }, { status: 404 });
    }
    if (spot.tour_id !== booking.tour_id) {
      return NextResponse.json({ error: 'Spot does not belong to this booking tour' }, { status: 400 });
    }

    const distanceM = numberOrNull(body.distanceM ?? body.distance_m);
    const arrivalRadiusM = Number(process.env.TOUR_ROOM_ARRIVAL_RADIUS_M || DEFAULT_ARRIVAL_RADIUS_M);
    if (eventType === 'arrived' && distanceM !== null && distanceM > arrivalRadiusM) {
      return NextResponse.json(
        { error: 'Outside arrival radius', distance_m: distanceM, arrival_radius_m: arrivalRadiusM },
        { status: 400 },
      );
    }

    const room = await ensureRoom(supabase, booking);
    const payload = typeof body.payload === 'object' && body.payload !== null ? body.payload : {};
    const eventPayload = {
      ...payload,
      meetingTime: body.meetingTime ?? (payload as Record<string, unknown>).meetingTime,
      meetingPoint: body.meetingPoint ?? (payload as Record<string, unknown>).meetingPoint,
    };
    const targetLocales = parseLocales(body.targetLocales || booking.preferred_language || DEFAULT_TARGET_LOCALES);
    const sourceText = sourceTextForEvent(eventType, spot, eventPayload as Record<string, unknown>);
    const translation = await translateTextForLocales(sourceText, targetLocales);
    const metadata = {
      kind: eventType === 'arrived' ? 'spot_arrival' : eventType,
      spot_id: spot.id,
      spot_title: spot.title,
      audio_url: spot.audio_url,
      distance_m: distanceM,
      arrival_radius_m: arrivalRadiusM,
      ...eventPayload,
    };

    const { data: existingEvent } = await supabase
      .from('tour_room_spot_events')
      .select('*, tour_room_messages(*)')
      .eq('booking_id', booking.id)
      .eq('spot_id', spot.id)
      .eq('event_type', eventType)
      .maybeSingle();
    if (existingEvent) {
      return NextResponse.json({ room, event: existingEvent, duplicate: true }, { status: 200 });
    }

    const { data: message, error: messageError } = await supabase
      .from('tour_room_messages')
      .insert({
        room_id: room.id,
        booking_id: booking.id,
        sender_user_id: authUserId,
        sender_role: eventType === 'meeting_notice_sent' ? 'guide' : 'system',
        input_kind: 'text',
        source_text: sourceText,
        source_locale: translation.source_locale,
        translations: translation.translations,
        target_locales: targetLocales,
        metadata,
      })
      .select()
      .single();
    if (messageError) throw messageError;

    const { data: event, error: eventError } = await supabase
      .from('tour_room_spot_events')
      .insert({
        booking_id: booking.id,
        room_id: room.id,
        spot_id: spot.id,
        message_id: message.id,
        event_type: eventType,
        triggered_by_user_id: authUserId,
        distance_m: distanceM === null ? null : Math.round(distanceM),
        current_latitude: numberOrNull(body.currentLatitude ?? body.current_latitude),
        current_longitude: numberOrNull(body.currentLongitude ?? body.current_longitude),
        payload: metadata,
      })
      .select()
      .single();
    if (eventError) throw eventError;

    return NextResponse.json({ room, message, event }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/spot-events error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
