import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { getAuthUser } from '@/lib/auth';
import { verifyRoomToken } from '@/lib/tour-room/token';
import { translateTextForLocales } from '@/lib/openai-server';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { sendGuestRoomPush } from '@/lib/tour-room/guestPush';
import { getQuickReplyPreset } from '@/lib/tour-room/quickReplies';
import { getOperatorPreset } from '@/lib/tour-room/operatorPresets';
import { renderSpotEventTranslations } from '@/lib/tour-room/spotContent';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';
import { pregenerateGuideNoticeTts, type TtsStorageClient } from '@/lib/tour-room/tts-server';

export const dynamic = 'force-dynamic';

/**
 * T6.1 — guide fan-out: one send lands in EVERY room of a (tourId, tourDate).
 *
 * POST /api/tour-rooms/broadcast
 *   { tourId, tourDate, text | presetKey, metadata?, bookingIds? }
 *   auth: guide tour-date token (rt query/header/body) or admin login.
 *
 * D-3 model: booking-per-room — the guide writes once, the server inserts a
 * message row per room and broadcasts each. Partial failure is REPORTED, not
 * rolled back (a delivered room must keep its message): the response lists
 * per-room ok/error and an overall `partial` flag.
 *
 * §K B3.1 — `bookingIds` narrows the fan-out to chosen guests (direct message
 * or pickup-group message). B3-D1: there is deliberately no second fan-out
 * path. Translation across the room locales, push, per-room partial reporting
 * and idempotency all already live here; a client-side loop or a separate DM
 * route would reimplement every one of them and they would drift apart.
 * Omitting the field keeps the previous whole-tour behaviour byte for byte.
 *
 * Ids outside the token's (tourId, tourDate) scope are dropped, not honoured —
 * a guide's tour-date token must not become a way to message another day's
 * guests by passing their booking id.
 */

const MAX_TEXT_CHARS = 2000;
const DEFAULT_TARGET_LOCALES = ['en', 'ko', 'zh', 'ja', 'es'];

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json().catch(() => ({}));
    const tourId = String(body.tourId || '');
    const tourDate = String(body.tourDate || '');
    if (!tourId || !/^\d{4}-\d{2}-\d{2}$/.test(tourDate)) {
      return NextResponse.json({ error: 'tourId and tourDate (YYYY-MM-DD) are required' }, { status: 400 });
    }

    // Authorization: admin login, or a guide token whose (tourId, tourDate)
    // scope matches the fan-out target exactly (§O-3).
    const user = await getAuthUser(req);
    let senderRole: 'guide' | 'admin' | null = user?.role === 'admin' ? 'admin' : null;
    let senderName = senderRole === 'admin' ? 'AtoC Korea' : '';
    if (!senderRole) {
      const token =
        (typeof body.token === 'string' ? body.token : null) ??
        req.nextUrl.searchParams.get('rt') ??
        req.headers.get('x-tour-room-token');
      const payload = token ? verifyRoomToken(token) : null;
      // P-D15: driver tokens share the tour-date scope but are NOT fan-out
      // senders — the driver bridge speaks per-room via the messages route.
      if (payload?.scope === 'tour-date' && payload.role === 'guide' && payload.tourId === tourId && payload.tourDate === tourDate) {
        senderRole = 'guide';
        senderName = payload.displayName;
      }
    }
    if (!senderRole) {
      return NextResponse.json({ error: 'A guide tour-date token or admin login is required' }, { status: 403 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_broadcast',
      key: `tour:${tourId}:${tourDate}`,
      perMinute: 12,
      perHour: 240,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    // Payload: preset (zero-LLM) or free text (one translation call shared
    // by every room — the fan-out reuses the same translations).
    let text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT_CHARS) : '';
    let translations: Record<string, string> = {};
    let sourceLocale = 'und';
    let messageMetadata: Record<string, unknown> =
      typeof body.metadata === 'object' && body.metadata !== null ? { ...body.metadata } : {};
    const presetKey = typeof body.presetKey === 'string' ? body.presetKey : null;
    if (presetKey) {
      const preset = getQuickReplyPreset(presetKey);
      if (!preset) return NextResponse.json({ error: 'Unknown quick-reply preset' }, { status: 400 });
      text = preset.text.en;
      translations = { ...preset.text };
      sourceLocale = 'en';
      messageMetadata = { ...messageMetadata, kind: 'quick_reply', preset_key: preset.key };
    }

    // T3-4 — operator situational preset (따라오세요 / 여기서 표 사세요 / …). Also
    // zero-LLM (pre-translated), announced to the whole vehicle via the fan-out.
    const operatorPresetKey = typeof body.operatorPresetKey === 'string' ? body.operatorPresetKey : null;
    if (operatorPresetKey) {
      const preset = getOperatorPreset(operatorPresetKey);
      if (!preset) return NextResponse.json({ error: 'Unknown operator preset' }, { status: 400 });
      text = preset.text.en;
      translations = { ...preset.text };
      sourceLocale = 'en';
      messageMetadata = { ...messageMetadata, kind: 'operator_preset', preset_key: preset.key };
    }

    // T6.3/T6.5 — structured notices: zero-LLM template constants; the time
    // and place interpolate verbatim, the banner countdowns key off metadata.
    const notice =
      typeof body.notice === 'object' && body.notice !== null
        ? (body.notice as { kind?: string; time?: string; point?: string; cancelled?: boolean; lat?: number; lng?: number })
        : null;
    if (notice) {
      const point = String(notice.point || '').trim().slice(0, 120);
      const time = String(notice.time || '').trim(); // HH:MM (KST wall clock)
      // T2-1 — an optional gather-point PIN. The pin lat/lng rides on the
      // metadata (banner) AND a Google Maps URL is appended to the text so the
      // feed renders an inline map thumbnail (parseLocationMessage), the one
      // affordance that transcends language for a foreign guest.
      const lat = typeof notice.lat === 'number' && Number.isFinite(notice.lat) && Math.abs(notice.lat) <= 90 ? notice.lat : null;
      const lng = typeof notice.lng === 'number' && Number.isFinite(notice.lng) && Math.abs(notice.lng) <= 180 ? notice.lng : null;
      const hasPin = lat !== null && lng !== null;
      const pinUrl = hasPin ? `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}` : null;
      const pinMeta = hasPin ? { meeting_lat: lat, meeting_lng: lng } : {};
      const withPin = (bundle: { source_locale: string; source_text: string; translations: Record<string, string> }) => {
        if (!pinUrl) return bundle;
        const translations = Object.fromEntries(
          Object.entries(bundle.translations).map(([loc, value]) => [loc, `${value}\n${pinUrl}`]),
        );
        return { ...bundle, source_text: `${bundle.source_text}\n${pinUrl}`, translations };
      };
      // T2-2 — translate the operator's typed place name so a Korean gather
      // point reads in each guest's language (banner + feed). R-6: on failure
      // fall through to the verbatim point (previous behaviour).
      let pointByLocale: Record<string, string> | null = null;
      if (point) {
        try {
          pointByLocale = (await translateTextForLocales(point, [...ROOM_LOCALES])).translations;
        } catch (translationError) {
          console.warn('notice point translation failed, using verbatim:', translationError);
          pointByLocale = null;
        }
      }
      const pointI18nMeta = pointByLocale ? { meeting_point_i18n: pointByLocale } : {};
      if (notice.kind === 'meeting_notice') {
        if (!point) return NextResponse.json({ error: 'notice.point is required' }, { status: 400 });
        const bundle = withPin(
          time
            ? renderSpotEventTranslations('meeting_notice_timed', { time, point }, pointByLocale)
            : renderSpotEventTranslations('meeting_notice', { point }, pointByLocale),
        );
        text = bundle.source_text;
        translations = bundle.translations;
        sourceLocale = bundle.source_locale;
        messageMetadata = { ...messageMetadata, kind: 'meeting_notice', meeting_time: time || null, meeting_point: point, ...pinMeta, ...pointI18nMeta };
      } else if (notice.kind === 'free_time_timer') {
        if (notice.cancelled) {
          const bundle = withPin(renderSpotEventTranslations('free_time_cancelled', { point: point || 'the meeting point' }, pointByLocale));
          text = bundle.source_text;
          translations = bundle.translations;
          sourceLocale = bundle.source_locale;
          messageMetadata = { ...messageMetadata, kind: 'free_time_timer', cancelled: true, meeting_point: point || null, ...pinMeta, ...pointI18nMeta };
        } else {
          if (!time || !/^\d{2}:\d{2}$/.test(time)) {
            return NextResponse.json({ error: 'notice.time (HH:MM) is required for a free-time timer' }, { status: 400 });
          }
          const bundle = withPin(renderSpotEventTranslations('free_time', { time, point: point || 'the meeting point' }, pointByLocale));
          text = bundle.source_text;
          translations = bundle.translations;
          sourceLocale = bundle.source_locale;
          messageMetadata = {
            ...messageMetadata,
            kind: 'free_time_timer',
            until_time: time, // KST wall clock on the tour date
            meeting_point: point || null,
            ...pinMeta,
            ...pointI18nMeta,
          };
        }
      } else {
        return NextResponse.json({ error: 'Unknown notice.kind' }, { status: 400 });
      }
    }

    if (!text) return NextResponse.json({ error: 'text, presetKey, or notice is required' }, { status: 400 });

    // Rooms = every booking of the tour day (rooms are created lazily by
    // /join, so ensure one per booking).
    const { data: allBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, tour_id, tour_date, preferred_language, status')
      .eq('tour_id', tourId)
      .eq('tour_date', tourDate)
      .neq('status', 'cancelled');
    if (bookingsError) throw bookingsError;
    if (!allBookings || allBookings.length === 0) {
      return NextResponse.json({ error: 'No bookings on this tour date' }, { status: 404 });
    }

    // §K B3.1 — optional narrowing. The filter is applied to the rows already
    // scoped by the token, so an id from another tour or another day simply
    // does not match and is dropped.
    const requestedIds = Array.isArray(body.bookingIds)
      ? [...new Set(body.bookingIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0))]
      : null;
    const bookings = requestedIds ? allBookings.filter((b) => requestedIds.includes(b.id)) : allBookings;
    if (requestedIds && bookings.length === 0) {
      // Every requested id was outside this tour day. Sending to the whole
      // tour instead would be the exact mis-send B3-D3 exists to prevent.
      return NextResponse.json({ error: 'None of the requested bookings are on this tour date' }, { status: 404 });
    }
    const isTargeted = Boolean(requestedIds) && bookings.length < allBookings.length;
    if (requestedIds) {
      // B3.4 — the guide feed distinguishes a direct message from an
      // announcement, so "who did I tell what" stays answerable afterwards.
      messageMetadata = {
        ...messageMetadata,
        audience: isTargeted ? 'selected' : 'all',
        audience_count: bookings.length,
      };
    }

    if (!presetKey && !operatorPresetKey && !notice) {
      const targetLocales = [
        ...new Set([
          ...bookings.map((booking) => String(booking.preferred_language || '')).filter(Boolean),
          ...DEFAULT_TARGET_LOCALES,
        ]),
      ];
      try {
        const translated = await translateTextForLocales(text, targetLocales);
        translations = translated.translations;
        sourceLocale = translated.source_locale;
      } catch (translationError) {
        // R-6: the fan-out ships the original rather than failing.
        console.warn('broadcast translation failed, sending original:', translationError);
        messageMetadata = { ...messageMetadata, translation_status: 'pending' };
      }
    }

    const results: Array<{ bookingId: string; ok: boolean; error?: string }> = [];
    for (const booking of bookings) {
      try {
        const { data: room, error: roomError } = await supabase
          .from('tour_rooms')
          .upsert(
            {
              booking_id: booking.id,
              tour_id: booking.tour_id,
              tour_date: booking.tour_date,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'booking_id' },
          )
          .select()
          .single();
        if (roomError || !room) throw roomError ?? new Error('room upsert failed');

        const { data: message, error: messageError } = await supabase
          .from('tour_room_messages')
          .insert({
            room_id: room.id,
            booking_id: booking.id,
            sender_user_id: user?.id ?? null,
            sender_role: senderRole,
            input_kind: 'text',
            source_text: text,
            source_locale: sourceLocale,
            translations,
            target_locales: Object.keys(translations),
            metadata: { ...messageMetadata, fanout: true, sender_name: senderName },
          })
          .select()
          .single();
        if (messageError) throw messageError;

        await broadcastToRoom(room, 'message', { message });
        void pregenerateGuideNoticeTts(supabase as unknown as TtsStorageClient, room.id, message).catch(
          () => undefined,
        );
        // W4.1 / P-D7 — the two critical kinds also ring opted-in guest
        // devices (rally target / free-time return). Fire-and-forget.
        if (notice && (notice.kind === 'meeting_notice' || notice.kind === 'free_time_timer') && !notice.cancelled) {
          void sendGuestRoomPush(supabase, booking, {
            translations,
            tag: `rally-${room.id}`,
          }).catch(() => undefined);
        }
        results.push({ bookingId: booking.id, ok: true });
      } catch (roomFailure) {
        results.push({
          bookingId: booking.id,
          ok: false,
          error: roomFailure instanceof Error ? roomFailure.message : String(roomFailure),
        });
      }
    }

    const delivered = results.filter((result) => result.ok).length;
    return NextResponse.json(
      {
        delivered,
        total: results.length,
        partial: delivered > 0 && delivered < results.length,
        results,
      },
      { status: delivered > 0 ? 201 : 500 },
    );
  } catch (error) {
    console.error('POST /api/tour-rooms/broadcast error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
