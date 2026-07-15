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
import { roomLifecycle, type RoomLifecycle } from '@/lib/tour-room/time';

/** Locales the room UI + translation targeting understand (D-8). */
export const ROOM_LOCALES = ['en', 'ko', 'zh', 'ja', 'es'] as const;
export type RoomLocale = (typeof ROOM_LOCALES)[number];

/** Normalize a client-reported locale to a room locale ('zh-TW' → 'zh'). */
export function normalizeRoomLocale(value: unknown, fallback: RoomLocale = 'en'): RoomLocale {
  if (typeof value !== 'string') return fallback;
  const lower = value.trim().toLowerCase();
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

export interface RoomSnapshot {
  room: TourRoom;
  lifecycle: RoomLifecycle;
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
}

/** Participant columns safe to share with the whole room (no device_key/user_id). */
const PARTICIPANT_PUBLIC_COLUMNS =
  'id, role, display_name, locale, location_sharing, tts_capable, last_seen_at, created_at';

export async function buildRoomSnapshot(
  supabase: RoomDbClient,
  booking: RoomBooking,
  room: TourRoom,
): Promise<RoomSnapshot> {
  const tourId = booking.tour_id;

  const [bookingRes, messagesRes, participantsRes, locationsRes, spotsRes, facilitiesRes, busRes, pickupSeqRes] =
    await Promise.all([
      supabase
        .from('bookings')
        .select(
          `id, booking_reference, tour_date, tour_time, number_of_guests, contact_name,
           tours ( id, slug, title, city, image_url, schedule ),
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
            .select('id, pickup_points ( id, name, lat, lng, pickup_time )')
            .eq('tour_id', tourId)
            .eq('tour_date', booking.tour_date)
        : Promise.resolve({ data: [], error: null }),
    ]);

  // The snapshot is a read bundle: any individual failure degrades to an
  // empty section rather than failing the whole cold start.
  const bookingRow = (bookingRes?.data ?? null) as RoomSnapshot['booking'] & { tours?: unknown } | null;
  const tour = bookingRow && Array.isArray(bookingRow.tours) ? bookingRow.tours[0] : bookingRow?.tours ?? null;

  const messages = ((messagesRes?.data ?? []) as Array<Record<string, unknown>>).reverse();

  return {
    room,
    lifecycle: roomLifecycle(booking.tour_date),
    booking: bookingRow
      ? {
          id: bookingRow.id,
          booking_reference: bookingRow.booking_reference ?? null,
          tour_date: bookingRow.tour_date ?? null,
          tour_time: bookingRow.tour_time ?? null,
          number_of_guests: bookingRow.number_of_guests ?? null,
          contact_name: bookingRow.contact_name ?? null,
          tours: tour,
          pickup_points: bookingRow.pickup_points ?? null,
        }
      : null,
    messages,
    participants: (participantsRes?.data ?? []) as Array<Record<string, unknown>>,
    locations: (locationsRes?.data ?? []) as Array<Record<string, unknown>>,
    tour_guide_spots: (spotsRes?.data ?? []) as Array<Record<string, unknown>>,
    tour_facilities: (facilitiesRes?.data ?? []) as Array<Record<string, unknown>>,
    bus_detail: (busRes?.data ?? null) as Record<string, unknown> | null,
    pickup_sequence: buildPickupSequence(
      (pickupSeqRes?.data ?? []) as Array<{ id: string; pickup_points: unknown }>,
    ),
    schedule: (tour as { schedule?: unknown } | null)?.schedule ?? [],
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
  for (const row of rows as Array<{ id: string; pickup_points: unknown }>) {
    const point = Array.isArray(row.pickup_points) ? row.pickup_points[0] : row.pickup_points;
    if (!point || typeof point !== 'object') continue;
    const p = point as { id?: string; name?: string; lat?: number; lng?: number; pickup_time?: string };
    stops.push({
      booking_id: row.id,
      pickup_point_id: p.id ?? null,
      name: p.name ?? null,
      lat: typeof p.lat === 'number' ? p.lat : null,
      lng: typeof p.lng === 'number' ? p.lng : null,
      pickup_time: p.pickup_time ?? null,
    });
  }
  return stops.sort((a, b) => {
    if (!a.pickup_time) return 1;
    if (!b.pickup_time) return -1;
    return a.pickup_time < b.pickup_time ? -1 : a.pickup_time > b.pickup_time ? 1 : 0;
  });
}
