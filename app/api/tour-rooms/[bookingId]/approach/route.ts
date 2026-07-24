import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor, type RoomDbClient } from '@/lib/tour-room/access';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { getGeneratedSpotContent, refCandidatesFor } from '@/lib/tour-room/generatedContent';
import { humanizePoiKey } from '@/lib/tour-room/dayPlan';
import { haversineM } from '@/lib/tour-room/geo';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';
import { resolveSpotContent } from '@/lib/tour-room/spotContent';
import { fetchArrivalVideoCard } from '@/lib/tour-room/poiVideos.server';
import { kstToday } from '@/lib/tour-room/time';
import { maybePostDiningForStop, runAfterResponse } from '@/lib/ops/dining/post.server';
import {
  APPROACH_SERVER_RADIUS_M,
  composeApproachTranslations,
} from '@/lib/tour-room/approach';

export const dynamic = 'force-dynamic';

/**
 * §11.C C2 — approach preview (1 km auto-trigger).
 *
 * POST /api/tour-rooms/[bookingId]/approach  { poi_key, latitude, longitude }
 *
 * Fired by the guest's foreground geofence (hooks/useApproachWatch) when the
 * device crosses 1 km of a scheduled stop. Posts ONE light preview card per
 * (room, poi_key, tour day) carrying the same resolved POI content + approved
 * video the arrival card uses — never a meeting time, never facility pins.
 *
 * Duplicate suppression is triple:
 *   1. the client stepper fires once per POI per KST day;
 *   2. tour_room_events UNIQUE(room_id, subject_key, type) makes N guests
 *      crossing the ring together resolve to exactly one card;
 *   3. a stop whose ARRIVAL already posted today is skipped outright —
 *      arrival supersedes its own preview.
 *
 * Additive: no schema change, no effect on the arrival paths (spot-events /
 * manual-arrival / arrival-bundle).
 */

/** Arrival kinds that make a preview redundant, across all three paths. */
const ARRIVAL_KINDS = ['spot_arrival', 'arrival_bundle'];

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

/** match_pois coordinates for the poi_key — the anti-spoof reference point. */
async function poiCoords(
  supabase: RoomDbClient,
  poiKey: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const { data } = await supabase.from('match_pois').select('lat, lng').eq('poi_key', poiKey).maybeSingle();
    const row = data as { lat?: number | null; lng?: number | null } | null;
    return typeof row?.lat === 'number' && typeof row?.lng === 'number' ? { lat: row.lat, lng: row.lng } : null;
  } catch {
    return null;
  }
}

/**
 * True when this room already announced the stop's ARRIVAL today. Reading the
 * feed (rather than an event type) covers all three arrival paths at once and
 * needs no new column.
 */
async function arrivalAlreadyPosted(
  supabase: RoomDbClient,
  roomId: string,
  poiKey: string,
  dayKey: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('tour_room_messages')
      .select('id')
      .eq('room_id', roomId)
      .eq('metadata->>poi_key', poiKey)
      .in('metadata->>kind', ARRIVAL_KINDS)
      .gte('created_at', `${dayKey}T00:00:00+09:00`)
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false; // degrade open: a preview is cheaper than a silent failure
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as {
      poi_key?: unknown;
      poiKey?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      locale?: unknown;
    };

    const rawKey = typeof body.poi_key === 'string' ? body.poi_key : body.poiKey;
    const poiKey = typeof rawKey === 'string' && rawKey.trim() ? rawKey.trim().slice(0, 120) : null;
    if (!poiKey) return NextResponse.json({ error: 'poi_key is required' }, { status: 400 });

    const latitude = numberOrNull(body.latitude);
    const longitude = numberOrNull(body.longitude);
    if (
      latitude === null ||
      longitude === null ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return NextResponse.json({ error: 'latitude and longitude are required' }, { status: 400 });
    }

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor, authUserId } = resolved;
    const actorParticipantId = actor.kind === 'session' ? actor.sessionPayload.participantId : null;

    // Per-participant AND per-booking gates: one runaway device can't spam the
    // room, and a whole bus crossing at once can't stampede the route either.
    const participantGate = await requestGate({
      namespace: 'tour_room_approach',
      key: actorParticipantId ? `participant:${actorParticipantId}` : `booking:${booking.id}`,
      perMinute: 6,
      perHour: 40,
    });
    const bookingGate = participantGate.allowed
      ? await requestGate({
          namespace: 'tour_room_approach_room',
          key: `booking:${booking.id}`,
          perMinute: 12,
          perHour: 80,
        })
      : participantGate;
    if (!participantGate.allowed || !bookingGate.allowed) {
      const retryAfterMs = participantGate.allowed ? bookingGate.retryAfterMs : participantGate.retryAfterMs;
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((retryAfterMs ?? 0) / 1000)) } },
      );
    }

    // Anti-spoof: the reported position must really be near the POI. 1.2 km =
    // the 1 km ring + 20 % slack for GPS drift and the sample→POST delay.
    const coords = await poiCoords(supabase, poiKey);
    if (!coords) {
      return NextResponse.json({ error: 'Unknown poi_key' }, { status: 400 });
    }
    const distanceM = haversineM({ latitude, longitude }, { latitude: coords.lat, longitude: coords.lng });
    if (distanceM > APPROACH_SERVER_RADIUS_M) {
      return NextResponse.json(
        { error: 'Outside approach radius', distance_m: Math.round(distanceM) },
        { status: 400 },
      );
    }

    const room = await ensureRoom(supabase, booking);
    const dayKey = booking.tour_date ?? kstToday();

    // Arrival supersedes its own preview.
    if (await arrivalAlreadyPosted(supabase, room.id, poiKey, dayKey)) {
      return NextResponse.json({ skipped: 'arrived' }, { status: 200 });
    }

    // Claim the (room, poi, day) slot BEFORE composing: concurrent crossers
    // race here and exactly one proceeds to insert the card.
    const claim = await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: booking.id,
      type: 'spot_approach',
      actorRole: actor.role,
      actorParticipantId,
      subjectKey: `approach:${poiKey}:${dayKey}`,
      payload: { poi_key: poiKey, distance_m: Math.round(distanceM) },
    }).catch(() => ({ inserted: false, event: null }));
    if (!claim.inserted) {
      return NextResponse.json({ duplicate: true }, { status: 200 });
    }

    // ── content: same resolver chain as the arrival paths ─────────────────
    const viewerLocale = normalizeRoomLocale(body.locale, normalizeRoomLocale(booking.preferred_language));
    interface SpotLike {
      title: string;
      content: unknown;
      poi_key: string;
    }
    let spot: SpotLike = { title: humanizePoiKey(poiKey), content: null, poi_key: poiKey };
    if (booking.tour_id) {
      try {
        const { data } = await supabase
          .from('tour_guide_spots')
          .select('title, content, poi_key')
          .eq('tour_id', booking.tour_id)
          .eq('poi_key', poiKey)
          .maybeSingle();
        const row = data as { title?: string | null; content?: unknown } | null;
        if (row) {
          spot = { title: row.title?.trim() || humanizePoiKey(poiKey), content: row.content ?? null, poi_key: poiKey };
        }
      } catch {
        // degrade: keep the humanized pseudo-spot
      }
    }

    // curated → poi_kb → generated → null. No on-demand generation: a preview
    // must land instantly, and the arrival card still gets the full treatment.
    let content: { content: import('@/lib/tour-room/spotContent').SpotArrivalContent | null; tier: string } = {
      content: null,
      tier: 'none',
    };
    try {
      content = resolveSpotContent({ title: spot.title, content: spot.content, poi_key: spot.poi_key }, viewerLocale);
      if (!content.content) {
        const generated = await getGeneratedSpotContent(
          supabase,
          booking.id,
          refCandidatesFor({ poi_key: spot.poi_key, title: spot.title }),
          viewerLocale,
        );
        if (generated) content = { content: generated.content, tier: 'generated' };
      }
    } catch {
      content = { content: null, tier: 'none' };
    }

    const videoCard = await fetchArrivalVideoCard(supabase, poiKey).catch(() => null);

    const text = composeApproachTranslations({ spotTitle: spot.title, distanceM });
    const metadata = {
      kind: 'approach_card',
      spot_title: spot.title,
      poi_key: poiKey,
      distance_m: Math.round(distanceM),
      poi_lat: coords.lat,
      poi_lng: coords.lng,
      triggered_by_role: actor.role,
      ...(content.content ? { content: content.content, content_tier: content.tier } : {}),
      ...(videoCard ? { video_card: videoCard } : {}),
    };

    const { data: message, error: messageError } = await supabase
      .from('tour_room_messages')
      .insert({
        room_id: room.id,
        booking_id: booking.id,
        sender_user_id: authUserId,
        sender_role: 'system',
        input_kind: 'text',
        source_text: text.source_text,
        source_locale: text.source_locale,
        translations: text.translations,
        target_locales: Object.keys(text.translations),
        metadata,
      })
      .select()
      .single();
    if (messageError) throw messageError;

    // Realtime only — NO web push. The preview can only fire while the guest
    // already has the app open (foreground watcher, §12 Q2), so a notification
    // would be pure noise; pushes stay reserved for rally-critical arrivals.
    await broadcastToRoom(room, 'message', { message });

    // §5.7 R-2 trigger ① — when the stop we are approaching is a MEAL stop,
    // the dining picks follow as their own `dining_card` message (the preview
    // card itself is untouched). Deferred past the response via
    // runAfterResponse so a cache MISS's external calls are not cut off;
    // postDiningCard never throws, so this can never turn an approach into
    // a 500.
    runAfterResponse(() =>
      maybePostDiningForStop(supabase, {
        booking,
        stop: { title: spot.title, poi_key: poiKey },
        poiKey,
        spotTitle: spot.title,
        lat: coords.lat,
        lng: coords.lng,
        actorRole: actor.role,
        actorParticipantId,
        authUserId,
      }),
    );

    return NextResponse.json({ message, content_tier: content.tier }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/approach error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
