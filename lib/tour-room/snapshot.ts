/**
 * Room snapshot builder (tickets T1.1/T1.2, master plan §D).
 *
 * One round-trip returns everything a client needs to cold-start a room:
 * room + lifecycle, booking summary, latest messages, participants,
 * location snapshots, spots (incl. the content layer), facilities, bus
 * detail, and the tour schedule. Shared by POST /join (initial state) and
 * GET /snapshot (reconnect / visibilitychange resync, §O-6).
 */

import type { RoomBooking, RoomDbClient, TourRoom } from '@/lib/tour-room/access';
import { pickupDetailAsJoin, resolvePickupDetail } from '@/lib/bookings/pickupDetail';
import { mergeTranslationTargets } from '@/lib/tour-room/chatLocale';
import { resolveDaySchedule, type DayPlanRow, type ScheduleSource } from '@/lib/tour-room/dayPlan';
import { poiImageCandidates, type PoiImageSource } from '@/lib/tour-room/poiImage';
import { meetingPhotoPublicUrl } from '@/lib/tour-room/meetingPhoto';
import {
  DEFAULT_REVIEW_POLICY,
  externalReviewPlatformFor,
  isOtaChannel,
  normalizeBookingChannel,
  resolveReviewPolicy,
  type RoomReviewPolicy,
} from '@/lib/tour-room/reviewPolicy';
import { hydrateMessageMedia, type RoomMediaStorageClient } from '@/lib/tour-room/roomMedia';
import { roomLifecycle, type RoomLifecycle } from '@/lib/tour-room/time';

/**
 * Locales the room UI understands (D-8; fr/de/ru/it added 2026-07-27,
 * docs/smartapp-ui-locale-expansion-fr-de-ru-it-2026-07-27.md L-D1).
 * Every static copy Record in the app is keyed by this union — extending it
 * turns tsc into the completeness gate.
 */
export const ROOM_LOCALES = ['en', 'ko', 'zh', 'zh-TW', 'ja', 'es', 'fr', 'de', 'ru', 'it'] as const;
export type RoomLocale = (typeof ROOM_LOCALES)[number];

/**
 * L-D1 — the FROZEN LLM-fanout base. Routes that translate content against a
 * static locale list (message fallback targets, arrival bundles, signal
 * notes…) pin to THIS, not ROOM_LOCALES, so adding UI locales never silently
 * multiplies translation cost. Dynamic targeting (getRoomTranslationTargets)
 * is participant-driven and already picks up new-locale guests only when one
 * is actually in the room.
 */
export const CORE_TRANSLATION_LOCALES = ['en', 'ko', 'zh', 'ja', 'es'] as const;

/**
 * Normalize a client-reported locale to a room locale. Traditional-script
 * Chinese tags (zh-TW/zh-HK/zh-MO and any zh-Hant-*) map to 'zh-TW'
 * (2026-07-27); every other tag folds to its base language.
 */
export function normalizeRoomLocale(value: unknown, fallback: RoomLocale = 'en'): RoomLocale {
  if (typeof value !== 'string') return fallback;
  const lower = value.trim().toLowerCase();
  if (lower === 'zh-tw' || lower === 'zh-hk' || lower === 'zh-mo' || lower.startsWith('zh-hant')) {
    return 'zh-TW';
  }
  const base = lower.split('-')[0];
  return (ROOM_LOCALES as readonly string[]).includes(base) ? (base as RoomLocale) : fallback;
}

const SNAPSHOT_MESSAGE_LIMIT = 100;

/**
 * D-8 — the union of locales actually present in the room, so a message is
 * translated only into languages someone will read. Empty when the
 * participants table has no rows yet (pre-join legacy traffic); callers fall
 * back to their previous defaults in that case.
 */
export async function getParticipantLocales(
  supabase: RoomDbClient,
  roomId: string,
): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('tour_room_participants')
      .select('locale')
      .eq('room_id', roomId);
    const locales = ((data ?? []) as Array<{ locale?: string | null }>)
      .map((row) => normalizeRoomLocale(row.locale))
      .filter(Boolean);
    return [...new Set(locales)];
  } catch {
    return [];
  }
}

/**
 * Language-agnostic chat targets (2026-07-18): the folded room locales PLUS
 * every raw detected chat_locale in the room, so a driver's Korean reply
 * fans out as a bubble in whatever language each guest actually writes.
 * Empty on failure/pre-join — callers keep their defaults.
 */
export async function getRoomTranslationTargets(
  supabase: RoomDbClient,
  roomId: string,
): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('tour_room_participants')
      .select('locale, chat_locale')
      .eq('room_id', roomId);
    const rows = (data ?? []) as Array<{ locale?: string | null; chat_locale?: string | null }>;
    const roomLocales = [...new Set(rows.map((row) => normalizeRoomLocale(row.locale)).filter(Boolean))];
    return mergeTranslationTargets(roomLocales, rows.map((row) => row.chat_locale));
  } catch {
    return [];
  }
}

export interface RoomSnapshot {
  room: TourRoom;
  lifecycle: RoomLifecycle;
  /**
   * SG-0c — the server's clock at build time. Injected HERE rather than in
   * any one route because every snapshot consumer (join cold-start, the
   * snapshot GET, the cockpit's own fetch) must carry it; the client derives
   * one offset from it and every room countdown reads that corrected clock.
   */
  server_now_ms: number;
  booking: {
    id: string;
    booking_reference: string | null;
    tour_date: string | null;
    tour_time: string | null;
    number_of_guests: number | null;
    contact_name: string | null;
    tours: unknown;
    pickup_points: unknown;
  } | null;
  messages: Array<Record<string, unknown>>;
  participants: Array<Record<string, unknown>>;
  locations: Array<Record<string, unknown>>;
  tour_guide_spots: Array<Record<string, unknown>>;
  tour_facilities: Array<Record<string, unknown>>;
  bus_detail: Record<string, unknown> | null;
  /** T3.7 — pickup_time-ordered stops for the whole tour day. */
  pickup_sequence: PickupSequenceStop[];
  schedule: unknown;
  /** W0.2 — which stage of the day-schedule resolver produced `schedule`. */
  schedule_source: ScheduleSource;
  /** SG-4b — poi_key → photo URL for the hero band; client picks by key. */
  stop_images: Record<string, string>;
  /** SG-4d — poi_key → VERIFIED meeting-point photo (public URL). */
  meeting_photos: Record<string, string>;
  /** W0.2 — the active private-mode day plan, when one owns the schedule. */
  day_plan: DayPlanRow | null;
  /**
   * OTA 심사 대비 — 이 예약의 리뷰 CTA 도착지와 자사 쿠폰 허용 여부.
   * 서버가 정해서 내려보낸다(클라가 채널을 해석하지 않는다).
   */
  review_policy: RoomReviewPolicy;
}

/** DE3 — the live dispatch row that actually carries today's vehicle. */
type RoomVehicleRow = {
  plate_number: string | null;
  driver_name: string | null;
  vehicle_layouts?: { model?: string | null; display_name?: Record<string, string> | null } | null;
};

/**
 * DE3 (진입점 감사 2026-07-27) — 손님 화면의 차량 안내 줄이 죽은 테이블을 읽고 있었다.
 *
 * `tour_bus_details`를 읽는 곳은 4군데인데, **쓰는** 곳은 어떤 UI도 부르지 않는
 * `POST /api/admin/tours/[id]/bus-detail` 하나뿐이었다. `driver.ts`의 주석이 이미
 * "the old sheet"라고 적어 두었듯 살아 있는 배차는 `ops_room_vehicles`다. 그래서
 * 관제가 정상적으로 배차해도 손님 홈의 차량 줄은 영원히 비어 있었다.
 *
 * 옛 시트가 남아 있으면 그것을 존중한다(손으로 넣은 값이 이긴다 — 운영자가 일부러
 * 적은 것을 코드가 덮으면 안 된다). 없을 때만 배차에서 만들어 준다. 모양은
 * `vehicleLineFromPayload`가 이미 읽는 느슨한 payload 그대로라, 소비처는 무변경이다.
 */
export function resolveBusDetail(
  legacy: Record<string, unknown> | null,
  dispatch: RoomVehicleRow | null,
): Record<string, unknown> | null {
  const legacyPayload = legacy?.payload;
  const legacyHasContent =
    legacyPayload && typeof legacyPayload === 'object' && Object.keys(legacyPayload as object).length > 0;
  if (legacyHasContent) return legacy;
  if (!dispatch) return legacy;

  const model = dispatch.vehicle_layouts?.display_name?.ko ?? dispatch.vehicle_layouts?.model ?? null;
  const payload: Record<string, string> = {};
  if (model) payload.vehicle_model = model;
  if (dispatch.plate_number) payload.plate_number = dispatch.plate_number;
  if (dispatch.driver_name) payload.driver_name = dispatch.driver_name;
  // 배차는 됐지만 타입·번호판·기사 셋 다 비어 있으면 보여줄 것이 없다.
  if (Object.keys(payload).length === 0) return legacy;
  return { payload, source: 'ops_room_vehicles' };
}

/** Participant columns safe to share with the whole room (no device_key/user_id). */
const PARTICIPANT_PUBLIC_COLUMNS =
  'id, role, display_name, locale, location_sharing, tts_capable, last_seen_at, last_read_at, created_at';

/**
 * 리뷰 CTA·쿠폰 정책을 예약 채널로 정한다 (reviewPolicy.ts 참고).
 *
 * OTA 예약일 때만 `tour_external_reviews`를 한 번 더 읽는다 — 자사 예약이
 * 대부분이고, 그쪽은 조회 없이 곧장 결정되기 때문이다. 이 조회가 실패해도
 * 정책은 살아 있다(리스팅 URL이 없는 것과 같게 처리되어 CTA만 숨는다).
 */
async function loadReviewPolicy(
  supabase: RoomDbClient,
  source: string | null,
  tourSlug: string | null,
): Promise<RoomReviewPolicy> {
  const channel = normalizeBookingChannel(source);
  if (!isOtaChannel(channel)) {
    return resolveReviewPolicy({ source, tourSlug });
  }

  const platform = externalReviewPlatformFor(channel);
  if (!platform || !tourSlug) return resolveReviewPolicy({ source, tourSlug });

  let otaListingUrl: string | null = null;
  try {
    const { data } = await supabase
      .from('tour_external_reviews')
      .select('source_url')
      .eq('tour_product_slug', tourSlug)
      .eq('platform', platform)
      .eq('is_visible', true)
      .maybeSingle();
    otaListingUrl = (data as { source_url?: string | null } | null)?.source_url ?? null;
  } catch {
    /* 읽기 실패 = 리스팅 URL 없음. 자사 페이지로 폴백하지 않는 것이 요점이다. */
  }

  return resolveReviewPolicy({ source, tourSlug, otaListingUrl });
}

export async function buildRoomSnapshot(
  supabase: RoomDbClient,
  booking: RoomBooking,
  room: TourRoom,
  /** P0-5 — the reader's language, so the schedule resolves in it (not English). */
  locale?: string | null,
): Promise<RoomSnapshot> {
  const tourId = booking.tour_id;

  /**
   * 🔴 FA-027 (full-app audit 2026-07-30). A join tour is one room PER BOOKING,
   * and ops attaches the vehicle to whichever room they happened to open — so
   * reading `ops_room_vehicles` by this room alone told every guest but the
   * anchor's that the tour has no vehicle. Live proof: tour f08b1603 on
   * 2026-07-27 ran 2 rooms and 1 of them carried the dispatch, so the other
   * room's guests had a blank vehicle line on the home tab.
   *
   * `lib/ops/seating/service.ts` already solved this (`groupRoomIds` +
   * `loadRoomVehicles`) and the seat board, manifest, check-in and gate all
   * share it. This file cannot import it: client components import types from
   * here, and pulling a server module in would break the client boundary the
   * `clientBoundary` gate protects. So the sibling lookup is inlined — the same
   * key (tour_id + tour_date), deliberately not a second definition of the
   * layout/override logic, which stays in the shared loader.
   */
  const vehicleRoomIds = await (async (): Promise<string[]> => {
    if (!tourId || !booking.tour_date) return [room.id];
    try {
      const { data, error } = await supabase
        .from('tour_rooms')
        .select('id')
        .eq('tour_id', tourId)
        .eq('tour_date', booking.tour_date);
      if (error || !Array.isArray(data)) return [room.id];
      const ids = (data as Array<{ id?: unknown }>)
        .map((row) => row.id)
        .filter((id): id is string => typeof id === 'string');
      return ids.length > 0 ? [...new Set([room.id, ...ids])] : [room.id];
    } catch {
      return [room.id];
    }
  })();

  const [
    bookingRes,
    messagesRes,
    participantsRes,
    locationsRes,
    spotsRes,
    facilitiesRes,
    busRes,
    pickupSeqRes,
    roomVehicleRes,
  ] =
    await Promise.all([
      supabase
        .from('bookings')
        .select(
          `id, booking_reference, tour_date, tour_time, number_of_guests, contact_name, itinerary,
           ota_raw_meta,
           tours ( id, slug, title, city, image_url, schedule, price_type ),
           pickup_points ( id, name, address, lat, lng, pickup_time )`,
        )
        .eq('id', booking.id)
        .maybeSingle(),
      supabase
        .from('tour_room_messages')
        .select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false })
        .limit(SNAPSHOT_MESSAGE_LIMIT),
      supabase.from('tour_room_participants').select(PARTICIPANT_PUBLIC_COLUMNS).eq('room_id', room.id),
      supabase.from('tour_room_locations').select('*').eq('room_id', room.id),
      tourId
        ? supabase.from('tour_guide_spots').select('*').eq('tour_id', tourId).order('sort_order', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      tourId
        ? supabase.from('tour_facilities').select('*').eq('tour_id', tourId).order('sort_order', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      tourId && booking.tour_date
        ? supabase
            .from('tour_bus_details')
            .select('*')
            .eq('tour_id', tourId)
            .eq('tour_date', booking.tour_date)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      // T3.7 — every pickup stop for this tour day (all bookings), so the
      // board can place "my pickup" in the bus's stop order.
      tourId && booking.tour_date
        ? supabase
            .from('bookings')
            // DE8 — 실제 픽업 값은 대부분 ota_raw_meta 에 있다. 이걸 안 읽으면
            // 픽업 순서가 통째로 비어 손님이 자기 차례를 못 본다.
            .select('id, ota_raw_meta, pickup_points ( id, name, lat, lng, pickup_time )')
            .eq('tour_id', tourId)
            .eq('tour_date', booking.tour_date)
        : Promise.resolve({ data: [], error: null }),
      // DE3 — 살아 있는 배차. 2호차가 붙어도 손님이 탈 차는 이 투어일에 붙은 첫 차다.
      // 룸 하나가 아니라 형제 룸 전부를 본다(FA-027, 위 주석).
      supabase
        .from('ops_room_vehicles')
        .select('plate_number, driver_name, vehicle_layouts ( model, display_name )')
        .in('room_id', vehicleRoomIds)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

  // The snapshot is a read bundle: any individual failure degrades to an
  // empty section rather than failing the whole cold start.
  const bookingRow = (bookingRes?.data ?? null) as
    | (RoomSnapshot['booking'] & { tours?: unknown; itinerary?: unknown })
    | null;
  const tour = bookingRow && Array.isArray(bookingRow.tours) ? bookingRow.tours[0] : bookingRow?.tours ?? null;

  /**
   * Exit 5 of 5 — the snapshot carries the last 100 messages, `select('*')`,
   * straight into the app's first paint. Miss this one and every photo the
   * guest has already received renders broken on cold open, then repairs itself
   * the moment the feed refetches — the worst kind of bug to reproduce.
   */
  const messages = await hydrateMessageMedia(
    supabase as unknown as RoomMediaStorageClient,
    ((messagesRes?.data ?? []) as Array<Record<string, unknown>>).reverse() as Array<{
      metadata?: Record<string, unknown> | null;
    }>,
  );

  // W0.2 — the 4-stage resolver chain (§C-4). With no day plan and no
  // itinerary poi_keys this returns tour.schedule ?? [] exactly as before.
  const resolvedSchedule = await resolveDaySchedule(supabase, {
    bookingId: booking.id,
    tourDate: booking.tour_date,
    itinerary: bookingRow?.itinerary ?? null,
    tourSchedule: (tour as { schedule?: unknown } | null)?.schedule,
    tourId: booking.tour_id ?? null,
    locale,
  });

  const reviewPolicy = bookingRow
    ? await loadReviewPolicy(
        supabase,
        booking.source ?? null,
        (tour as { slug?: string | null } | null)?.slug ?? null,
      )
    : DEFAULT_REVIEW_POLICY;

  // SG-4b — one photo URL per scheduled stop, keyed by poi_key so the CLIENT
  // picks as its "next" advances (a single snapshot-time field would show a
  // stale stop's photo — v1.2 2차 감사 #19). ONE `.in()` query for the whole
  // schedule; the snapshot is the room's hottest read path and gets no N+1.
  // Best-effort: a failed lookup means no bands, never a failed snapshot.
  let stopImages: Record<string, string> = {};
  try {
    const poiKeys = [
      ...new Set(
        (Array.isArray(resolvedSchedule.schedule) ? resolvedSchedule.schedule : [])
          .map((item) => (item as { poi_key?: unknown }).poi_key)
          .filter((key): key is string => typeof key === 'string' && key.length > 0),
      ),
    ];
    if (poiKeys.length > 0) {
      const { data: poiRows } = await supabase
        .from('match_pois')
        .select('poi_key, default_image_url, images')
        .in('poi_key', poiKeys);
      for (const row of (poiRows as Array<{ poi_key: string } & PoiImageSource> | null) ?? []) {
        const [candidate] = poiImageCandidates(row);
        if (candidate) stopImages[row.poi_key] = candidate;
      }
    }
  } catch {
    stopImages = {};
  }

  // SG-4d -- VERIFIED meeting-point photos only, keyed by poi_key (public
  // bucket URLs, so the SW image lane can cache them). Pending/rejected rows
  // never leave the review queue.
  let meetingPhotos: Record<string, string> = {};
  try {
    const poiKeys = Object.keys(stopImages).length
      ? [...new Set(
          (Array.isArray(resolvedSchedule.schedule) ? resolvedSchedule.schedule : [])
            .map((item) => (item as { poi_key?: unknown }).poi_key)
            .filter((key): key is string => typeof key === 'string' && key.length > 0),
        )]
      : [];
    if (poiKeys.length > 0) {
      const { data: photoRows } = await supabase
        .from('tour_poi_arrival_profiles')
        .select('poi_key, meeting_photo_path')
        .in('poi_key', poiKeys)
        .eq('meeting_photo_status', 'verified')
        .not('meeting_photo_path', 'is', null);
      for (const row of (photoRows as Array<{ poi_key: string; meeting_photo_path: string }> | null) ?? []) {
        meetingPhotos[row.poi_key] = meetingPhotoPublicUrl(row.meeting_photo_path);
      }
    }
  } catch {
    meetingPhotos = {};
  }

  return {
    room,
    lifecycle: roomLifecycle(booking.tour_date),
    server_now_ms: Date.now(),
    booking: bookingRow
      ? {
          id: bookingRow.id,
          booking_reference: bookingRow.booking_reference ?? null,
          tour_date: bookingRow.tour_date ?? null,
          tour_time: bookingRow.tour_time ?? null,
          number_of_guests: bookingRow.number_of_guests ?? null,
          contact_name: bookingRow.contact_name ?? null,
          tours: tour,
          // DE8 — 관제 명단과 **같은 리졸버**. 예전에는 스냅샷만 구조화된 지점을
          // 읽어서, 같은 예약을 가이드는 보고 손님은 못 보는 상태였다.
          pickup_points: pickupDetailAsJoin(resolvePickupDetail(bookingRow)),
        }
      : null,
    messages,
    participants: (participantsRes?.data ?? []) as Array<Record<string, unknown>>,
    locations: (locationsRes?.data ?? []) as Array<Record<string, unknown>>,
    tour_guide_spots: (spotsRes?.data ?? []) as Array<Record<string, unknown>>,
    tour_facilities: (facilitiesRes?.data ?? []) as Array<Record<string, unknown>>,
    bus_detail: resolveBusDetail(
      (busRes?.data ?? null) as Record<string, unknown> | null,
      (roomVehicleRes?.data ?? null) as RoomVehicleRow | null,
    ),
    pickup_sequence: buildPickupSequence(
      (pickupSeqRes?.data ?? []) as Array<{ id: string; pickup_points: unknown }>,
    ),
    schedule:
      resolvedSchedule.source === 'tour_schedule' || resolvedSchedule.source === 'none'
        ? ((tour as { schedule?: unknown } | null)?.schedule ?? [])
        : resolvedSchedule.schedule,
    schedule_source: resolvedSchedule.source,
    stop_images: stopImages,
    meeting_photos: meetingPhotos,
    day_plan: resolvedSchedule.dayPlan,
    review_policy: reviewPolicy,
  };
}

export interface PickupSequenceStop {
  booking_id: string;
  pickup_point_id: string | null;
  name: string | null;
  lat: number | null;
  lng: number | null;
  pickup_time: string | null;
}

/**
 * T3.7 — flatten the tour-day bookings' pickup joins into one pickup_time-
 * ordered stop list (nulls last). Pure; exported for tests.
 */
export function buildPickupSequence(
  rows: Array<{ id: string; pickup_points: unknown }> | unknown,
): PickupSequenceStop[] {
  const stops: PickupSequenceStop[] = [];
  if (!Array.isArray(rows)) return stops; // degraded snapshot section (read bundle contract)
  for (const row of rows as Array<{ id: string; pickup_points: unknown; ota_raw_meta?: unknown }>) {
    // DE8 — 예약 한 건의 픽업은 한 곳에서만 해석한다. 예전에는 여기서 구조화된
    // 지점만 읽어, 실제 값이 ota_raw_meta 에 있는 라이브 예약은 순서에서 통째로
    // 빠졌다(= 손님이 자기 차례를 못 봄).
    const detail = resolvePickupDetail(row);
    if (!detail) continue;
    stops.push({
      booking_id: row.id,
      pickup_point_id: detail.pickup_point_id,
      name: detail.name,
      lat: detail.lat,
      lng: detail.lng,
      pickup_time: detail.pickup_time,
    });
  }
  return stops.sort((a, b) => {
    if (!a.pickup_time) return 1;
    if (!b.pickup_time) return -1;
    return a.pickup_time < b.pickup_time ? -1 : a.pickup_time > b.pickup_time ? 1 : 0;
  });
}
