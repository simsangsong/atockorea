/**
 * 가이드 명단+좌석 통합 로더 — AtoC 통합 플랜 §5.4b / §11.B B1.
 *
 * 조인투어는 booking마다 tour_rooms 행이 하나씩 생긴다(ensureRoom onConflict
 * booking_id) — 차량(ops_room_vehicles)은 그 중 한 "앵커" 룸에 붙고, 좌석판·
 * 명단·좌석 스트립은 (tour_id, tour_date) 전체를 같은 좌석판으로 본다. 이
 * 로더는 tour 스코프로:
 *   - roster: (tour_id, tour_date)의 전 bookings (명단 = bookings 파생 뷰)
 *   - vehicles: 형제 룸들에 붙은 차량 + 배치도
 *   - assignments: 그 차량들의 ops_seat_assignments (단일 소스)
 *   - anchorRoomId: 차량이 붙은 룸(변경 API 대상) + channelTopic(Realtime)
 * 를 한 번에 계산한다. 기존 service.ts/manifest/group.ts를 소비만 하고
 * 코어 로직은 건드리지 않는다 (additive).
 */

import type { RoomDbClient } from '@/lib/tour-room/access';
import type { ManifestBooking } from '@/lib/ops/manifest/group';
import { roomChannelTopic } from '@/lib/tour-room/realtime';
import type { RoomVehicleWithLayout, SeatAssignmentRow } from '@/lib/ops/seating/service';
import { loadAssignments } from '@/lib/ops/seating/service';
import type { VehicleLayoutJson } from '@/lib/ops/seating/layouts';

export interface TourManifest {
  tour: { id: string; title: string | null; city: string | null } | null;
  tourId: string;
  tourDate: string;
  bookings: ManifestBooking[];
  vehicles: RoomVehicleWithLayout[];
  assignments: SeatAssignmentRow[];
  /** 차량이 붙은 룸 — checkin/absent/gate/seats 변경 API 대상. */
  anchorRoomId: string | null;
  /** 앵커 룸 Realtime Broadcast 토픽 (seat_update 구독용). */
  channelTopic: string | null;
  started: boolean;
}

interface RosterRow {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  number_of_guests: number | null;
  preferred_language: string | null;
  status: string | null;
  source: string | null;
  external_booking_id: string | null;
  special_requests: string | null;
  ota_raw_meta: Record<string, unknown> | null;
  pickup_points:
    | { name?: string | null; pickup_time?: string | null }
    | Array<{ name?: string | null; pickup_time?: string | null }>
    | null;
}

/** admin manifest 라우트와 동일 매핑 (bookings → ManifestBooking, 픽업 해석). */
function toManifestBooking(row: RosterRow): ManifestBooking {
  const point = Array.isArray(row.pickup_points) ? row.pickup_points[0] : row.pickup_points;
  const meta = row.ota_raw_meta ?? {};
  const pickupName =
    (point?.name as string | undefined) ??
    (typeof meta.pickup_normalized === 'string' ? meta.pickup_normalized : null) ??
    (typeof meta.pickup_raw === 'string' ? meta.pickup_raw : null);
  const pickupTime =
    (point?.pickup_time as string | undefined) ??
    (typeof meta.pickup_time === 'string' ? meta.pickup_time : null);
  const whatsapp = typeof meta.whatsapp === 'string' ? meta.whatsapp : null;
  return {
    id: row.id,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    whatsapp,
    partySize: row.number_of_guests ?? 1,
    preferredLanguage: row.preferred_language,
    status: row.status,
    source: row.source,
    externalBookingId: row.external_booking_id,
    pickupName: pickupName ?? null,
    pickupTime: pickupTime ?? null,
    specialRequests: row.special_requests,
  };
}

/** 형제 룸들에 붙은 차량 + 배치도 (loadRoomVehicles의 다중 룸판). */
async function loadVehiclesForRooms(
  supabase: RoomDbClient,
  roomIds: string[],
): Promise<RoomVehicleWithLayout[]> {
  if (roomIds.length === 0) return [];
  const base =
    'id, room_id, layout_id, plate_number, ops_vehicle_layouts ( model, layout_json, total_seats )';
  // §5.3b 실차 오버라이드 (마이그레이션 미적용 환경에서는 기존 select로 물러선다).
  let { data, error } = await supabase
    .from('ops_room_vehicles')
    .select(`${base}, layout_override_json`)
    .in('room_id', roomIds);
  if (error) {
    ({ data, error } = await supabase.from('ops_room_vehicles').select(base).in('room_id', roomIds));
  }
  if (error || !Array.isArray(data)) return [];
  return data.map((row: Record<string, unknown>) => {
    const joined = row.ops_vehicle_layouts as
      | { model?: string; layout_json?: VehicleLayoutJson; total_seats?: number }
      | null;
    const override = (row.layout_override_json as VehicleLayoutJson | null) ?? null;
    return {
      id: String(row.id),
      room_id: String(row.room_id),
      layout_id: String(row.layout_id),
      plate_number: (row.plate_number as string | null) ?? null,
      layout: override ?? joined?.layout_json ?? null,
      total_seats: override ? override.seats.length : joined?.total_seats ?? null,
      model: joined?.model ?? null,
      layout_overridden: Boolean(override),
    };
  });
}

/**
 * (tour_id, tour_date) 통합 명단+좌석 로드. 취소 예약 제외(§3.2). wa 로그·
 * ops 테이블 미적용 시에도 graceful degrade (좌석 0건이면 vehicles/assignments
 * 빈 배열 → 화면은 "좌석 오픈 예정").
 */
export async function loadTourManifest(
  supabase: RoomDbClient,
  input: { tourId: string; tourDate: string },
): Promise<TourManifest> {
  const { tourId, tourDate } = input;

  const [{ data: tour }, { data: bookingRows }, { data: roomRows }] = await Promise.all([
    supabase.from('tours').select('id, title, city').eq('id', tourId).maybeSingle(),
    supabase
      .from('bookings')
      .select(
        'id, contact_name, contact_phone, contact_email, number_of_guests, preferred_language, status, source, external_booking_id, special_requests, ota_raw_meta, pickup_points ( name, pickup_time )',
      )
      .eq('tour_id', tourId)
      .eq('tour_date', tourDate)
      .neq('status', 'cancelled'),
    supabase.from('tour_rooms').select('id, status').eq('tour_id', tourId).eq('tour_date', tourDate),
  ]);

  const bookings = ((bookingRows ?? []) as unknown as RosterRow[]).map(toManifestBooking);

  const rooms = (roomRows ?? []) as Array<{ id: string; status: string | null }>;
  const vehicles = await loadVehiclesForRooms(supabase, rooms.map((r) => r.id));
  const assignments = await loadAssignments(supabase, vehicles.map((v) => v.id));

  const anchorVehicle = vehicles[0] ?? null;
  const anchorRoomId = anchorVehicle?.room_id ?? null;
  const anchorRoom = anchorRoomId ? rooms.find((r) => r.id === anchorRoomId) ?? null : null;
  const channelTopic = anchorRoomId
    ? roomChannelTopic(anchorRoomId, anchorRoom?.status ?? 'active')
    : null;

  // 시작 여부: locked 좌석이 하나라도 있으면 시작된 룸 (gate가 전 좌석 잠금).
  const started = assignments.some((a) => a.locked);

  return {
    tour: (tour as { id: string; title: string | null; city: string | null } | null) ?? null,
    tourId,
    tourDate,
    bookings,
    vehicles,
    assignments,
    anchorRoomId,
    channelTopic,
    started,
  };
}
