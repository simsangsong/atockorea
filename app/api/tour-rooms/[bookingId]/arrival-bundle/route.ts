import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { getGeneratedSpotContent, refCandidatesFor } from '@/lib/tour-room/generatedContent';
import { humanizePoiKey, resolveDaySchedule } from '@/lib/tour-room/dayPlan';
import { renderNextLegLine, type NextLegMeta } from '@/lib/tour-room/eta';
import { estimateNextLeg } from '@/lib/tour-room/eta.server';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { normalizeRoomLocale, ROOM_LOCALES } from '@/lib/tour-room/snapshot';
import { resolveSpotContent } from '@/lib/tour-room/spotContent';
import { fetchArrivalFacilityPins } from '@/lib/tour-room/facilityPins.server';
import { fetchArrivalVideoCard } from '@/lib/tour-room/poiVideos.server';
import {
  arrivalProfileFromRow,
  composeArrivalBundleText,
  VEHICLE_POINT,
  type ArrivalProfile,
  type EventStatus,
  type FollowMode,
} from '@/lib/tour-room/arrivalBundle';
import { translateTextForLocales } from '@/lib/openai-server';
import { sendGuestRoomPush } from '@/lib/tour-room/guestPush';

export const dynamic = 'force-dynamic';

/**
 * A0 — arrival one-tap bundle (docs/smart-guide-ops-detail-audit-2026-07-21.md).
 *
 * GET  /api/tour-rooms/[bookingId]/arrival-bundle?poiKey=…
 *   → { profile } — the sticky per-POI defaults for the cockpit sheet.
 *
 * POST /api/tour-rooms/[bookingId]/arrival-bundle
 *   { poiKey?, title?, meetingTime?: 'HH:MM'|null, lat?, lng?,
 *     profile?: { follow_mode?, ticket_required?, route_note?, meeting_point? } }
 *
 * ONE operator tap announces a stop with everything a guest needs: the spot
 * briefing card (manual-arrival's 4-tier content), the meeting time (rides the
 * existing NoticeBanner countdown + rally ladder via activeNotice), the
 * parking pin (= the gather point), follow-vs-free, the ticket step, and the
 * viewing-route note. Per-day variables are ONLY meetingTime + lat/lng; the
 * rest are sticky per-POI defaults persisted back on send (user decision
 * 2026-07-21). Shared tours (price_type person/group) fan out to every booking
 * of the tour date — same Model B as driver-signal.
 */

interface ProfilePatch {
  follow_mode?: FollowMode;
  ticket_required?: boolean;
  route_note?: string | null;
  meeting_point?: string | null;
  event_label?: string | null;
  ticket_krw?: number | null;
}

function parseProfilePatch(value: unknown): ProfilePatch | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const patch: ProfilePatch = {};
  if (raw.follow_mode === 'follow' || raw.follow_mode === 'free') patch.follow_mode = raw.follow_mode;
  if (typeof raw.ticket_required === 'boolean') patch.ticket_required = raw.ticket_required;
  if (typeof raw.route_note === 'string') patch.route_note = raw.route_note.trim().slice(0, 500) || null;
  if (raw.route_note === null) patch.route_note = null;
  if (typeof raw.meeting_point === 'string') patch.meeting_point = raw.meeting_point.trim().slice(0, 120) || null;
  if (raw.meeting_point === null) patch.meeting_point = null;
  if (typeof raw.event_label === 'string') patch.event_label = raw.event_label.trim().slice(0, 120) || null;
  if (raw.event_label === null) patch.event_label = null;
  // J1 — adult admission in KRW (0..1,000,000; anything else is ignored).
  if (raw.ticket_krw === null) patch.ticket_krw = null;
  if (typeof raw.ticket_krw === 'number' && Number.isInteger(raw.ticket_krw) && raw.ticket_krw >= 0 && raw.ticket_krw <= 1_000_000) {
    patch.ticket_krw = raw.ticket_krw;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

function numberOrNull(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** T2-2 pattern: translate operator-typed text, verbatim on failure (R-6). */
async function tryTranslate(text: string): Promise<Record<string, string> | null> {
  try {
    return (await translateTextForLocales(text, [...ROOM_LOCALES])).translations;
  } catch (error) {
    console.warn('arrival-bundle translation failed, using verbatim:', error);
    return null;
  }
}

async function loadProfile(
  supabase: ReturnType<typeof createServerClient>,
  poiKey: string,
): Promise<ArrivalProfile> {
  try {
    const { data } = await supabase
      .from('tour_poi_arrival_profiles')
      .select('*')
      .eq('poi_key', poiKey)
      .maybeSingle();
    return arrivalProfileFromRow(poiKey, data as Record<string, unknown> | null);
  } catch {
    return arrivalProfileFromRow(poiKey, null);
  }
}

export async function GET(
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
    if (resolved.actor.role !== 'guide' && resolved.actor.role !== 'driver' && resolved.actor.role !== 'admin') {
      return NextResponse.json({ error: 'Guide, driver, or admin only' }, { status: 403 });
    }
    const poiKey = req.nextUrl.searchParams.get('poiKey')?.trim();
    if (!poiKey) return NextResponse.json({ error: 'poiKey is required' }, { status: 400 });
    const profile = await loadProfile(supabase, poiKey);
    // A4 — today's already-confirmed status prefills the sheet toggle.
    let eventStatus: EventStatus | null = null;
    if (profile.event_label && resolved.booking.tour_date) {
      try {
        const { data } = await supabase
          .from('poi_day_events')
          .select('status')
          .eq('poi_key', poiKey)
          .eq('event_date', resolved.booking.tour_date)
          .maybeSingle();
        const status = (data as { status?: string } | null)?.status;
        eventStatus = status === 'on' || status === 'off' ? status : null;
      } catch {
        eventStatus = null;
      }
    }
    // B4 — a compact Korean spot briefing for the OPERATOR (the "arrive-5-min
    // -early" prep): resolved from the same content tiers the guest card uses,
    // so the lead can glance hours/closed-day/tips before tapping send.
    let briefing: string[] | null = null;
    try {
      let spotRow: { title?: string; content?: unknown } | null = null;
      if (resolved.booking.tour_id) {
        const { data } = await supabase
          .from('tour_guide_spots')
          .select('title, content, poi_key')
          .eq('tour_id', resolved.booking.tour_id)
          .eq('poi_key', poiKey)
          .maybeSingle();
        spotRow = data as { title?: string; content?: unknown } | null;
      }
      const resolvedContent = resolveSpotContent(
        { title: spotRow?.title ?? humanizePoiKey(poiKey), content: spotRow?.content ?? null, poi_key: poiKey },
        'ko',
      );
      const c = resolvedContent.content;
      if (c) {
        const lines = [
          c.visitBasics?.hours ? `⏰ ${c.visitBasics.hours}` : null,
          c.visitBasics?.closed ? `🚫 ${c.visitBasics.closed}` : null,
          c.visitBasics?.admission ? `🎟️ ${c.visitBasics.admission}` : null,
          c.visitBasics?.walking ? `🚶 ${c.visitBasics.walking}` : null,
          c.convenience?.restroom ? `🚻 ${c.convenience.restroom}` : null,
          c.smartNotes?.photo ? `📸 ${c.smartNotes.photo}` : null,
          c.smartNotes?.tip ? `💡 ${c.smartNotes.tip}` : null,
        ].filter((line): line is string => Boolean(line));
        briefing = lines.length > 0 ? lines.slice(0, 6) : null;
      }
    } catch {
      briefing = null;
    }
    return NextResponse.json({ profile, event_status: eventStatus, briefing });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/arrival-bundle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      poiKey?: unknown;
      title?: unknown;
      meetingTime?: unknown;
      lat?: unknown;
      lng?: unknown;
      profile?: unknown;
      eventStatus?: unknown;
    };

    const poiKey = typeof body.poiKey === 'string' && body.poiKey.trim() ? body.poiKey.trim() : null;
    const requestedTitle = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
    if (!poiKey && !requestedTitle) {
      return NextResponse.json({ error: 'poiKey or title is required' }, { status: 400 });
    }

    // meetingTime: HH:MM (KST wall clock) or explicit null → a no-meeting stop.
    let meetingTime: string | null = null;
    if (typeof body.meetingTime === 'string' && body.meetingTime.trim()) {
      const match = /^(\d{2}):(\d{2})$/.exec(body.meetingTime.trim());
      const valid = match && Number(match[1]) <= 23 && Number(match[2]) <= 59;
      if (!valid) {
        return NextResponse.json({ error: 'meetingTime must be HH:MM (KST)' }, { status: 400 });
      }
      meetingTime = body.meetingTime.trim();
    }

    const lat = numberOrNull(body.lat);
    const lng = numberOrNull(body.lng);
    const hasPin = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor, authUserId } = resolved;
    if (actor.role !== 'guide' && actor.role !== 'driver' && actor.role !== 'admin') {
      return NextResponse.json({ error: 'Guide, driver, or admin only' }, { status: 403 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_arrival_bundle',
      key: `booking:${booking.id}`,
      perMinute: 4,
      perHour: 40,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    // ── sticky profile: load → merge the sheet's toggles → persist ─────────
    let profile = poiKey
      ? await loadProfile(supabase, poiKey)
      : arrivalProfileFromRow('', null);
    const patch = parseProfilePatch(body.profile);
    if (poiKey && patch) {
      if (patch.follow_mode !== undefined) profile.follow_mode = patch.follow_mode;
      if (patch.ticket_required !== undefined) profile.ticket_required = patch.ticket_required;
      if (patch.route_note !== undefined && patch.route_note !== profile.route_note) {
        profile.route_note = patch.route_note;
        profile.route_note_i18n = patch.route_note ? await tryTranslate(patch.route_note) : null;
      }
      if (patch.meeting_point !== undefined && patch.meeting_point !== profile.meeting_point) {
        profile.meeting_point = patch.meeting_point;
        profile.meeting_point_i18n = patch.meeting_point ? await tryTranslate(patch.meeting_point) : null;
      }
      if (patch.event_label !== undefined && patch.event_label !== profile.event_label) {
        profile.event_label = patch.event_label;
        profile.event_label_i18n = patch.event_label ? await tryTranslate(patch.event_label) : null;
      }
      if (patch.ticket_krw !== undefined) profile.ticket_krw = patch.ticket_krw;
      await supabase
        .from('tour_poi_arrival_profiles')
        .upsert(
          {
            poi_key: poiKey,
            follow_mode: profile.follow_mode,
            ticket_required: profile.ticket_required,
            route_note: profile.route_note,
            route_note_i18n: profile.route_note_i18n,
            meeting_point: profile.meeting_point,
            meeting_point_i18n: profile.meeting_point_i18n,
            event_label: profile.event_label,
            event_label_i18n: profile.event_label_i18n,
            ticket_krw: profile.ticket_krw,
            updated_by_role: actor.role,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'poi_key' },
        );
    }

    // A4 — today's event confirmation: 'on' | 'off' | undefined (unconfirmed).
    // Persisted per (poi_key, tour_date) so a later bundle re-send, the GET
    // prefill, and future consumers (concierge) all see the same answer.
    const eventStatus: EventStatus | null =
      body.eventStatus === 'on' || body.eventStatus === 'off' ? body.eventStatus : null;
    if (eventStatus && poiKey && booking.tour_date && profile.event_label) {
      await supabase
        .from('poi_day_events')
        .upsert(
          {
            poi_key: poiKey,
            event_date: booking.tour_date,
            status: eventStatus,
            label: profile.event_label,
            set_by_role: actor.role,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'poi_key,event_date' },
        );
    }

    // ── spot resolution (same chain as manual-arrival) ─────────────────────
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

    const facilityPins = await fetchArrivalFacilityPins(supabase, spot.poi_key);
    // W3/J4 — approved POI video renders ride the bundle (best-effort).
    const videoCard = await fetchArrivalVideoCard(supabase, spot.poi_key);
    const refs = refCandidatesFor({ poi_key: spot.poi_key, title: spot.title });

    // A2 — next-stop ETA tail (measured travel-matrix minutes over the
    // synthetic haversine estimate). Best-effort: any miss just omits the line.
    let nextLeg: NextLegMeta | null = null;
    try {
      const { schedule } = await resolveDaySchedule(supabase, {
        bookingId: booking.id,
        tourDate: booking.tour_date ?? null,
      });
      const idx = spot.poi_key ? schedule.findIndex((item) => item.poi_key === spot.poi_key) : -1;
      const next =
        idx >= 0
          ? schedule.slice(idx + 1).find((item) => typeof item.poi_key === 'string' && item.poi_key)
          : undefined;
      if (next?.poi_key) {
        const estimate = await estimateNextLeg(supabase, {
          fromCoords: hasPin ? { lat: lat as number, lng: lng as number } : null,
          fromPoiKey: spot.poi_key,
          toPoiKey: next.poi_key as string,
        });
        if (estimate) {
          nextLeg = {
            title: (typeof next.title === 'string' && next.title) || humanizePoiKey(next.poi_key as string),
            poi_key: next.poi_key as string,
            distance_m: estimate.distanceM,
            minutes: estimate.minutes,
            source: estimate.source,
          };
        }
      }
    } catch {
      nextLeg = null;
    }

    // Named gather point: translated when we have it, verbatim otherwise
    // (R-6); no name at all → the per-locale "the vehicle" default.
    const pointByLocale = profile.meeting_point
      ? profile.meeting_point_i18n ??
        Object.fromEntries(ROOM_LOCALES.map((locale) => [locale, profile.meeting_point as string]))
      : null;
    const bundleText = composeArrivalBundleText({
      spotTitle: spot.title,
      followMode: profile.follow_mode,
      ticketRequired: profile.ticket_required,
      meetingTime,
      pointByLocale,
      routeNoteI18n: profile.route_note_i18n,
      routeNote: profile.route_note,
      eventStatus,
      eventLabelByLocale: profile.event_label_i18n,
      eventLabel: profile.event_label,
      ticketKrw: profile.ticket_krw,
    });
    if (nextLeg) {
      for (const locale of Object.keys(bundleText.translations)) {
        bundleText.translations[locale] += `\n${renderNextLegLine(locale as import('@/lib/tour-room/snapshot').RoomLocale, {
          title: nextLeg.title,
          distanceM: nextLeg.distance_m,
          minutes: nextLeg.minutes,
        })}`;
      }
      bundleText.source_text = bundleText.translations.en;
    }

    // ── fan-out targets: shared tour = every booking of the day (Model B) ──
    let isShared = false;
    if (booking.tour_id && booking.tour_date) {
      const { data: tourRow } = await supabase
        .from('tours')
        .select('price_type')
        .eq('id', booking.tour_id)
        .maybeSingle();
      const priceType = (tourRow as { price_type?: string } | null)?.price_type;
      isShared = priceType === 'person' || priceType === 'group';
    }
    type TargetBooking = {
      id: string;
      tour_id: string | null;
      tour_date: string | null;
      preferred_language?: string | null;
    };
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
    let delivered = 0;

    for (const target of targetBookings) {
      try {
        const room = await ensureRoom(supabase, target);
        const isSender = target.id === booking.id;
        const viewerLocale = normalizeRoomLocale(target.preferred_language);

        // Parking pin per room (PIN primitive) — the vehicle IS the gather
        // point, so the same coords ride as meeting_lat/lng for the banner map.
        let pinId: string | null = null;
        if (hasPin) {
          const { data: pin } = await supabase
            .from('tour_room_pins')
            .insert({
              room_id: room.id,
              kind: 'parking',
              lat,
              lng,
              created_by_role: actor.role,
              created_by_participant_id: isSender ? actorParticipantId : null,
            })
            .select('id')
            .single();
          pinId = (pin as { id?: string } | null)?.id ?? null;
        }

        // Content per viewer locale (curated → poi_kb → generated → null).
        // No on-demand generation here — the bundle must send instantly; a
        // content-less stop still ships the meeting/follow/ticket lines and
        // guests can ask the concierge.
        let content: {
          content: import('@/lib/tour-room/spotContent').SpotArrivalContent | null;
          tier: string;
        } = resolveSpotContent({ title: spot.title, content: spot.content, poi_key: spot.poi_key }, viewerLocale);
        if (!content.content) {
          const generated = await getGeneratedSpotContent(supabase, target.id, refs, viewerLocale);
          if (generated) content = { content: generated.content, tier: 'generated' };
        }

        const metadata = {
          kind: 'arrival_bundle',
          spot_id: spot.id,
          spot_title: spot.title,
          poi_key: spot.poi_key,
          audio_url: spot.audio_url,
          manual: true,
          triggered_by_role: actor.role,
          follow_mode: profile.follow_mode,
          ticket_required: profile.ticket_required,
          ticket_krw: profile.ticket_krw,
          route_note: profile.route_note,
          route_note_i18n: profile.route_note_i18n,
          meeting_time: meetingTime,
          // Banner point: named gather point, else the localized vehicle
          // default — the NoticeBanner reads these keys as a meeting notice.
          meeting_point: profile.meeting_point ?? (meetingTime ? VEHICLE_POINT.en : null),
          meeting_point_i18n:
            profile.meeting_point_i18n ?? (profile.meeting_point ? null : meetingTime ? VEHICLE_POINT : null),
          ...(meetingTime && hasPin ? { meeting_lat: lat, meeting_lng: lng } : {}),
          ...(hasPin ? { parking_lat: lat, parking_lng: lng, pin_id: pinId } : {}),
          ...(content.content ? { content: content.content, content_tier: content.tier } : {}),
          ...(facilityPins.length ? { facility_pins: facilityPins } : {}),
          ...(videoCard ? { video_card: videoCard } : {}),
          ...(nextLeg ? { next_leg: nextLeg } : {}),
          ...(eventStatus && profile.event_label
            ? {
                event_status: eventStatus,
                event_label: profile.event_label,
                event_label_i18n: profile.event_label_i18n,
              }
            : {}),
          ...(targetBookings.length > 1 ? { fanout: true } : {}),
        };

        const { data: message, error: messageError } = await supabase
          .from('tour_room_messages')
          .insert({
            room_id: room.id,
            booking_id: target.id,
            sender_user_id: authUserId,
            sender_role: 'system',
            input_kind: 'text',
            source_text: bundleText.source_text,
            source_locale: bundleText.source_locale,
            translations: bundleText.translations,
            target_locales: Object.keys(bundleText.translations),
            metadata,
          })
          .select()
          .single();
        if (messageError) throw messageError;

        await broadcastToRoom(room, 'message', { message });

        // W4.1 / P-D7 — an arrival with a meeting time is rally-critical:
        // ring opted-in guest devices (fire-and-forget).
        if (meetingTime) {
          void sendGuestRoomPush(supabase, target, {
            translations: bundleText.translations,
            tag: `arrival-bundle-${room.id}`,
          }).catch(() => undefined);
        }

        // Event log — type stays 'manual_arrival' so the travel-matrix
        // flywheel (§H-1) keeps learning from bundle arrivals unchanged.
        await recordRoomEvent(supabase, {
          roomId: room.id,
          bookingId: target.id,
          type: 'manual_arrival',
          actorRole: actor.role,
          actorParticipantId: isSender ? actorParticipantId : null,
          payload: {
            poi_key: spot.poi_key,
            title: spot.title,
            content_tier: content.tier,
            bundle: true,
            meeting_time: meetingTime,
          },
        }).catch(() => undefined);

        if (isSender) primaryMessage = message;
        delivered += 1;
      } catch (roomFailure) {
        console.warn('arrival-bundle room delivery failed:', target.id, roomFailure);
      }
    }

    if (delivered === 0) {
      return NextResponse.json({ error: 'Delivery failed for every room' }, { status: 500 });
    }
    return NextResponse.json(
      { message: primaryMessage, delivered, profile: poiKey ? profile : null },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/arrival-bundle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
