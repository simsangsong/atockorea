import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { recordRoomEvent } from '@/lib/tour-room/events';
import {
  generateSpotContent,
  getGeneratedSpotContent,
  refCandidatesFor,
} from '@/lib/tour-room/generatedContent';
import { humanizePoiKey } from '@/lib/tour-room/dayPlan';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';
import { renderSpotEventTranslations, resolveSpotContent } from '@/lib/tour-room/spotContent';
import { fetchArrivalFacilityPins } from '@/lib/tour-room/facilityPins.server';
import { fetchArrivalVideoCard } from '@/lib/tour-room/poiVideos.server';

export const dynamic = 'force-dynamic';

/**
 * W3/§O-8 — manual spot-arrival trigger (guide / driver / admin).
 *
 * POST /api/tour-rooms/[bookingId]/manual-arrival  { poiKey?, title?, locale? }
 *
 * The Korean-only solo driver's "guiding" moment: one tap announces arrival
 * and the guests receive the locale-resolved content card (same
 * metadata contract as the geofence path in spot-events). When a
 * tour_guide_spots row exists for the poi_key it supplies curated content
 * and audio; otherwise a pseudo-spot resolves through the poi_kb →
 * honest-null fallback chain. Zero LLM calls (§M-2 templates).
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as {
      poiKey?: unknown;
      title?: unknown;
      locale?: unknown;
    };

    const poiKey = typeof body.poiKey === 'string' && body.poiKey.trim() ? body.poiKey.trim() : null;
    const requestedTitle = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
    if (!poiKey && !requestedTitle) {
      return NextResponse.json({ error: 'poiKey or title is required' }, { status: 400 });
    }

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor, authUserId } = resolved;
    if (actor.role !== 'guide' && actor.role !== 'driver' && actor.role !== 'admin') {
      return NextResponse.json({ error: 'Guide, driver, or admin only' }, { status: 403 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_manual_arrival',
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

    // Prefer a real tour_guide_spots row (curated content + audio) when the
    // poi_key matches one on this tour; fall back to a pseudo-spot.
    interface SpotLike {
      id: string | null;
      title: string;
      audio_url: string | null;
      content: unknown;
      poi_key: string | null;
    }
    let spot: SpotLike | null = null;
    if (poiKey && booking.tour_id) {
      try {
        const { data } = await supabase
          .from('tour_guide_spots')
          .select('id, title, audio_url, content, poi_key')
          .eq('tour_id', booking.tour_id)
          .eq('poi_key', poiKey)
          .maybeSingle();
        if (data) spot = data as SpotLike;
      } catch {
        spot = null;
      }
    }
    if (!spot) {
      spot = {
        id: null,
        title: requestedTitle || (poiKey ? humanizePoiKey(poiKey) : ''),
        audio_url: null,
        content: null,
        poi_key: poiKey,
      };
    }

    const translation = renderSpotEventTranslations(spot.audio_url ? 'arrived_audio' : 'arrived', {
      spot: spot.title,
    });
    const viewerLocale = normalizeRoomLocale(body.locale, normalizeRoomLocale(booking.preferred_language));
    let content: { content: import('@/lib/tour-room/spotContent').SpotArrivalContent | null; tier: string } =
      resolveSpotContent({ title: spot.title, content: spot.content, poi_key: spot.poi_key }, viewerLocale);

    // P-D16 — the 'generated' tier sits between poi_kb and the honest null:
    // a booking-scoped, critic-verified mini-guide from the auto pipeline.
    const refs = refCandidatesFor({ poi_key: spot.poi_key, title: spot.title });
    if (!content.content) {
      const generated = await getGeneratedSpotContent(supabase, booking.id, refs, viewerLocale);
      if (generated) content = { content: generated.content, tier: 'generated' };
    }

    const room = await ensureRoom(supabase, booking);
    // W2.1 — ride the spot's restroom/photo pins in the arrival metadata.
    const facilityPins = await fetchArrivalFacilityPins(supabase, spot.poi_key);
    // W3/J4 — approved POI video renders ride the arrival card (best-effort).
    const videoCard = await fetchArrivalVideoCard(supabase, spot.poi_key);
    const { data: message, error: messageError } = await supabase
      .from('tour_room_messages')
      .insert({
        room_id: room.id,
        booking_id: booking.id,
        sender_user_id: authUserId,
        sender_role: 'system',
        input_kind: 'text',
        source_text: translation.source_text,
        source_locale: translation.source_locale,
        translations: translation.translations,
        target_locales: Object.keys(translation.translations),
        metadata: {
          kind: 'spot_arrival',
          spot_id: spot.id,
          spot_title: spot.title,
          poi_key: spot.poi_key,
          audio_url: spot.audio_url,
          manual: true,
          triggered_by_role: actor.role,
          ...(content.content ? { content: content.content, content_tier: content.tier } : {}),
          ...(facilityPins.length ? { facility_pins: facilityPins } : {}),
          ...(videoCard ? { video_card: videoCard } : {}),
        },
      })
      .select()
      .single();
    if (messageError) throw messageError;

    await broadcastToRoom(room, 'message', { message });

    // Event log (P-D5): actual-arrival timestamps feed the travel-time
    // flywheel (§H-1); no subject_key — re-announcing is legitimate.
    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: booking.id,
      type: 'manual_arrival',
      actorRole: actor.role,
      payload: { poi_key: spot.poi_key, title: spot.title, content_tier: content.tier },
    }).catch(() => undefined);

    // P-D16 on-demand path: no content anywhere → generate now (async) and
    // post a follow-up card when ready. The template message above already
    // answered honestly; this upgrades the moment, never blocks it.
    if (!content.content) {
      const spotTitle = spot.title;
      const spotPoiKey = spot.poi_key;
      void (async () => {
        try {
          const generatedRow = await generateSpotContent(supabase, {
            bookingId: booking.id,
            title: spotTitle,
            poiKey: spotPoiKey,
            locales: [viewerLocale],
          });
          if (!generatedRow) return;
          const followup = await getGeneratedSpotContent(supabase, booking.id, refs, viewerLocale);
          if (!followup) return;
          const { data: followupMessage } = await supabase
            .from('tour_room_messages')
            .insert({
              room_id: room.id,
              booking_id: booking.id,
              sender_role: 'system',
              input_kind: 'text',
              source_text: translation.source_text,
              source_locale: translation.source_locale,
              translations: translation.translations,
              target_locales: Object.keys(translation.translations),
              metadata: {
                kind: 'spot_arrival',
                spot_id: null,
                spot_title: spotTitle,
                manual: true,
                generated_followup: true,
                content: followup.content,
                content_tier: 'generated',
              },
            })
            .select()
            .single();
          if (followupMessage) await broadcastToRoom(room, 'message', { message: followupMessage });
        } catch (generationError) {
          console.warn('manual-arrival on-demand generation failed:', generationError);
        }
      })();
    }

    return NextResponse.json({ message, content_tier: content.tier }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/manual-arrival error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
