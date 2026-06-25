import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { translateTextForLocales } from '@/lib/openai-server';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';

export const dynamic = 'force-dynamic';

const DEFAULT_TARGET_LOCALES = ['en', 'ko', 'zh', 'ja', 'es'];
const DEFAULT_ARRIVAL_RADIUS_M = 3000;

type SpotEventType = 'arrived' | 'audio_played' | 'meeting_notice_sent';

function normalized(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

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

async function getBookingForRoom(
  supabase: ReturnType<typeof createServerClient>,
  bookingId: string,
) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, user_id, tour_id, merchant_id, tour_date, contact_name, contact_email, preferred_language')
    .eq('id', bookingId)
    .single();
  if (error || !data) return null;
  return data;
}

async function ensureRoom(
  supabase: ReturnType<typeof createServerClient>,
  booking: { id: string; tour_id?: string | null; tour_date?: string | null },
) {
  const { data, error } = await supabase
    .from('tour_rooms')
    .upsert(
      {
        booking_id: booking.id,
        tour_id: booking.tour_id ?? null,
        tour_date: booking.tour_date ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'booking_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

function isMerchantGuideForBooking(
  user: Awaited<ReturnType<typeof getAuthUser>>,
  booking: { merchant_id?: string | null },
): boolean {
  return Boolean(user?.role === 'merchant' && user.merchantId && booking.merchant_id === user.merchantId);
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
    const user = await getAuthUser(req);
    const body = await req.json().catch(() => ({}));
    const eventType = String(body.eventType || body.event_type || '') as SpotEventType;
    const spotId = String(body.spotId || body.spot_id || '');

    if (!['arrived', 'audio_played', 'meeting_notice_sent'].includes(eventType)) {
      return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
    }
    if (!spotId) {
      return NextResponse.json({ error: 'spotId is required' }, { status: 400 });
    }

    const booking = await getBookingForRoom(supabase, bookingId);
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const guestEmail = String(body.contactEmail || '');
    const guestName = String(body.contactName || '');
    const guestMatches =
      normalized(booking.contact_email) === normalized(guestEmail) &&
      (!guestName || normalized(booking.contact_name) === normalized(guestName));
    const isOwner = Boolean(user?.id && user.id === booking.user_id);
    const isAdmin = user?.role === 'admin';
    const isMerchantGuide = isMerchantGuideForBooking(user, booking);
    const authedByRole = isOwner || isAdmin || isMerchantGuide;

    // PA-4: throttle the unauthenticated guest email-match path per-IP to prevent
    // enumeration spray against a public bookingId (authed roles bypass).
    if (!authedByRole) {
      const gate = await requestGate({
        namespace: 'tour_room_guest',
        key: clientIpKey(req.headers),
        perMinute: 15,
        perHour: 60,
      });
      if (!gate.allowed) {
        return NextResponse.json(
          { error: 'rate_limited' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil(gate.retryAfterMs / 1000)) } },
        );
      }
    }

    if (!authedByRole && !guestMatches) {
      return NextResponse.json({ error: 'Access denied for this tour room' }, { status: 403 });
    }
    if (eventType === 'meeting_notice_sent' && !isAdmin && !isMerchantGuide) {
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
        sender_user_id: user?.id ?? null,
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
        triggered_by_user_id: user?.id ?? null,
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
