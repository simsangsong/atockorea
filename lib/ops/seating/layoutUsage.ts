/**
 * "이 배치도를 지금 누가 타고 있는가" — AtoC 통합 플랜 §5.3b.
 *
 * 배치도 편집이 위험한 이유는 JSON이 틀려서가 아니라 **이미 그 좌석에 앉기로
 * 한 손님이 있어서**다. 편집기·배차 화면이 저장 전에 반드시 이 조회를 돌려
 * "어느 룸의 몇 번 좌석이 사라지는가"를 이름과 함께 보여줄 수 있게 한다.
 *
 * 오버라이드가 걸린 실차는 표준 배치도 편집의 영향을 받지 않는다 —
 * 그래서 layout 단위 조회에서는 오버라이드 차량을 **제외**한다(그 차량은
 * 자기 오버라이드를 편집할 때만 위험군이 된다).
 *
 * ⚠ 서버 전용(주입된 Supabase 클라이언트로만 동작). 순수 규칙은 layoutEditor.ts.
 */

import type { RoomDbClient } from '@/lib/tour-room/access';
import { maskGuestName } from '@/lib/ops/seating/claim';
import type { InUseSeatRef } from './layoutEditor';
import type { VehicleLayoutJson } from './layouts';

export interface RoomVehicleRow {
  id: string;
  room_id: string;
  layout_id: string;
  plate_number: string | null;
  driver_participant_id: string | null;
  driver_name: string | null;
  layout_override_json: VehicleLayoutJson | null;
  override_note: string | null;
}

const BASE_COLUMNS = 'id, room_id, layout_id, plate_number, driver_participant_id';
const EXTENDED_COLUMNS = `${BASE_COLUMNS}, driver_name, layout_override_json, override_note`;

/**
 * ops_room_vehicles 조회 — 20260726090000 마이그레이션이 아직 적용되지 않은
 * 환경에서도 동작하도록 확장 컬럼 실패 시 기본 컬럼으로 물러선다.
 * (배포 순서가 마이그레이션보다 앞설 수 있다 — 그때 배차 화면 전체가 죽으면 안 된다.)
 */
export async function selectRoomVehicles(
  supabase: RoomDbClient,
  filter: { layoutId?: string; roomId?: string; roomIds?: string[]; ids?: string[] },
): Promise<{ rows: RoomVehicleRow[]; migrationPending: boolean }> {
  const run = async (columns: string) => {
    let query = supabase.from('ops_room_vehicles').select(columns);
    if (filter.layoutId) query = query.eq('layout_id', filter.layoutId);
    if (filter.roomId) query = query.eq('room_id', filter.roomId);
    // §K B2.4 — 그룹 스코프. 2호차가 어느 룸에서 붙었든 그룹 전원이 본다
    // (B0.4가 loadRoomVehicles에 넣은 것과 같은 규칙 — 배차 화면도 같은 답을
    //  봐야 좌석판과 어긋나지 않는다).
    if (filter.roomIds) query = query.in('room_id', filter.roomIds);
    if (filter.ids) query = query.in('id', filter.ids);
    return query;
  };

  const extended = await run(EXTENDED_COLUMNS);
  if (!extended.error && Array.isArray(extended.data)) {
    return { rows: normalizeRows(extended.data), migrationPending: false };
  }

  const base = await run(BASE_COLUMNS);
  if (!base.error && Array.isArray(base.data)) {
    return { rows: normalizeRows(base.data), migrationPending: true };
  }
  return { rows: [], migrationPending: true };
}

function normalizeRows(rows: unknown[]): RoomVehicleRow[] {
  return rows.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      id: String(row.id),
      // B0.1 이후 room_id는 nullable이다(레거시 앵커) — 소유는 group_id가 갖는다.
      room_id: row.room_id ? String(row.room_id) : '',
      layout_id: String(row.layout_id),
      plate_number: (row.plate_number as string | null) ?? null,
      driver_participant_id: (row.driver_participant_id as string | null) ?? null,
      driver_name: (row.driver_name as string | null) ?? null,
      layout_override_json: (row.layout_override_json as VehicleLayoutJson | null) ?? null,
      override_note: (row.override_note as string | null) ?? null,
    };
  });
}

export interface LayoutUsageVehicle {
  roomVehicleId: string;
  roomId: string;
  roomLabel: string;
  plateNumber: string | null;
  hasOverride: boolean;
  seats: InUseSeatRef[];
}

export interface LayoutUsage {
  vehicles: LayoutUsageVehicle[];
  /** 표준 배치도 편집이 실제로 깨뜨릴 수 있는 좌석들 (오버라이드 차량 제외). */
  inUse: InUseSeatRef[];
  migrationPending: boolean;
}

/** 룸 라벨 — "2026-08-17 성산 일출 · Massimo C." (PII 마스킹은 claim과 동일 규약). */
function roomLabel(
  room: { tour_date?: string | null } | undefined,
  tourTitle: string | null,
  contactName: string | null,
): string {
  const parts = [room?.tour_date ?? null, tourTitle, maskGuestName(contactName)].filter(
    (part): part is string => Boolean(part && part !== '—'),
  );
  return parts.length > 0 ? parts.join(' · ') : '룸';
}

/**
 * 배치도(또는 특정 실차)를 쓰는 좌석 배정 현황.
 *
 * @param opts.layoutId       표준 배치도 단위 조회 (오버라이드 차량 제외)
 * @param opts.roomVehicleId  실차 단위 조회 (오버라이드 편집용 — 제외 없음)
 */
export async function loadLayoutUsage(
  supabase: RoomDbClient,
  opts: { layoutId?: string; roomVehicleId?: string },
): Promise<LayoutUsage> {
  const { rows: vehicles, migrationPending } = await selectRoomVehicles(
    supabase,
    opts.roomVehicleId ? { ids: [opts.roomVehicleId] } : { layoutId: opts.layoutId },
  );
  if (vehicles.length === 0) return { vehicles: [], inUse: [], migrationPending };

  const roomIds = [...new Set(vehicles.map((v) => v.room_id))];
  const { data: roomData } = await supabase
    .from('tour_rooms')
    .select('id, booking_id, tour_id, tour_date')
    .in('id', roomIds);
  const rooms = new Map<string, { id: string; booking_id: string; tour_id: string | null; tour_date: string | null }>();
  for (const room of (roomData ?? []) as Array<{
    id: string;
    booking_id: string;
    tour_id: string | null;
    tour_date: string | null;
  }>) {
    rooms.set(room.id, room);
  }

  const bookingIds = [...new Set([...rooms.values()].map((room) => room.booking_id).filter(Boolean))];
  const bookingNames = new Map<string, string | null>();
  if (bookingIds.length > 0) {
    const { data } = await supabase.from('bookings').select('id, contact_name').in('id', bookingIds);
    for (const row of (data ?? []) as Array<{ id: string; contact_name: string | null }>) {
      bookingNames.set(row.id, row.contact_name);
    }
  }

  const tourIds = [...new Set([...rooms.values()].map((room) => room.tour_id).filter(Boolean))] as string[];
  const tourTitles = new Map<string, string | null>();
  if (tourIds.length > 0) {
    const { data } = await supabase.from('tours').select('id, title').in('id', tourIds);
    for (const row of (data ?? []) as Array<{ id: string; title: string | null }>) {
      tourTitles.set(row.id, row.title);
    }
  }

  const { data: assignmentData } = await supabase
    .from('ops_seat_assignments')
    .select('room_vehicle_id, seat_number, guest_label, checked_in_at')
    .in('room_vehicle_id', vehicles.map((v) => v.id));
  const assignments = (assignmentData ?? []) as Array<{
    room_vehicle_id: string;
    seat_number: number;
    guest_label: string | null;
    checked_in_at: string | null;
  }>;

  const usage: LayoutUsageVehicle[] = vehicles.map((vehicle) => {
    const room = rooms.get(vehicle.room_id);
    const label = roomLabel(
      room,
      room?.tour_id ? tourTitles.get(room.tour_id) ?? null : null,
      room?.booking_id ? bookingNames.get(room.booking_id) ?? null : null,
    );
    const seats: InUseSeatRef[] = assignments
      .filter((a) => a.room_vehicle_id === vehicle.id)
      .map((a) => ({
        roomId: vehicle.room_id,
        roomVehicleId: vehicle.id,
        roomLabel: label,
        seatNumber: a.seat_number,
        guestLabel: a.guest_label,
        checkedIn: Boolean(a.checked_in_at),
      }))
      .sort((a, b) => a.seatNumber - b.seatNumber);
    return {
      roomVehicleId: vehicle.id,
      roomId: vehicle.room_id,
      roomLabel: label,
      plateNumber: vehicle.plate_number,
      hasOverride: Boolean(vehicle.layout_override_json),
      seats,
    };
  });

  // 표준 배치도 편집은 오버라이드 차량을 건드리지 않는다.
  const relevant = opts.roomVehicleId ? usage : usage.filter((vehicle) => !vehicle.hasOverride);
  return {
    vehicles: usage,
    inUse: relevant.flatMap((vehicle) => vehicle.seats),
    migrationPending,
  };
}
