/**
 * ops 좌석 서버 공용 조회/브로드캐스트 — AtoC 통합 플랜 §5.3/§5.4.
 *
 * 라우트 5개(claim/seats/checkin/absent/gate)가 공유하는 DB 조회와
 * seat_update 팬아웃. 순수 계산은 lib/ops/seating/logic.ts, 인가는
 * lib/ops/seating/access.ts — 이 파일은 그 사이의 I/O 배관만 담는다.
 */

import type { RoomDbClient } from '@/lib/tour-room/access';
import { broadcastToRooms, broadcastToRoom } from '@/lib/tour-room/realtime';
import type { VehicleLayoutJson } from '@/lib/ops/seating/layouts';
import type { SeatAssignmentLike } from '@/lib/ops/seating/logic';
import type { OpsRoom } from '@/lib/ops/seating/access';

export interface RoomVehicleWithLayout {
  id: string;
  room_id: string;
  layout_id: string;
  plate_number: string | null;
  layout: VehicleLayoutJson | null;
  total_seats: number | null;
  model: string | null;
  /** §5.3b — 이 실차만 표준 배치와 다르면 true (layout은 오버라이드본이다). */
  layout_overridden: boolean;
}

export interface SeatAssignmentRow extends SeatAssignmentLike {
  id: string;
  room_vehicle_id: string;
  participant_id: string | null;
  guest_label: string | null;
  checkin_actor: string | null;
  assigned_at: string | null;
}

const ROOM_VEHICLE_BASE_SELECT =
  'id, room_id, layout_id, plate_number, ops_vehicle_layouts ( model, layout_json, total_seats )';
/** §5.3b — 실차 단위 오버라이드. 20260726090000 마이그레이션 이후에만 존재한다. */
const ROOM_VEHICLE_OVERRIDE_SELECT = `${ROOM_VEHICLE_BASE_SELECT}, layout_override_json`;

/**
 * 룸의 차량들 + 배치도 (§5.3 C-7: 차량 미배정이면 빈 배열 = "좌석 오픈 예정").
 *
 * §5.3b 오버라이드가 걸린 실차는 표준 배치도 대신 자기 layout_override_json을
 * 쓴다 — 좌석판·명단·게이트가 전부 이 함수를 통해 배치도를 받으므로 여기 한
 * 곳만 알면 된다. 오버라이드 컬럼이 아직 없는 환경(마이그레이션 미적용)에서는
 * 기존 select로 물러선다 — 배포 순서가 앞서더라도 좌석 플로우가 죽지 않게.
 */
/**
 * §K B0.4 — 이 룸이 속한 **그룹**의 룸 id 전부.
 *
 * 조인투어의 차량은 그룹 소유지만(B0.1), 레거시 행은 아직 `room_id`로만
 * 매달려 있다. 두 경로를 모두 훑어야 이관 중에도 좌석판이 비지 않는다.
 * 그룹 키를 못 만드는 룸(투어/날짜 없음)은 자기 자신만 본다.
 */
async function groupRoomIds(supabase: RoomDbClient, roomId: string): Promise<string[]> {
  try {
    const { data: room } = await supabase
      .from('tour_rooms')
      .select('id, tour_id, tour_date')
      .eq('id', roomId)
      .maybeSingle();
    const r = room as { tour_id?: string | null; tour_date?: string | null } | null;
    if (!r?.tour_id || !r?.tour_date) return [roomId];
    const { data: siblings } = await supabase
      .from('tour_rooms')
      .select('id')
      .eq('tour_id', r.tour_id)
      .eq('tour_date', r.tour_date);
    const ids = Array.isArray(siblings) ? (siblings as Array<{ id: string }>).map((x) => x.id) : [];
    return ids.length > 0 ? [...new Set([roomId, ...ids])] : [roomId];
  } catch {
    return [roomId];
  }
}

/**
 * 룸의 차량들 — 정확히는 **그 룸이 속한 그룹의** 차량들 (§K B0.4).
 *
 * 시그니처는 그대로 두고 내부만 바꿨다: 호출부 5곳(좌석판·명단·체크인·게이트·
 * 노쇼)이 전부 이걸 통해 차량을 받으므로, 여기 한 곳이 그룹을 알면 세 화면이
 * 동시에 같은 답을 본다. 이전에는 조인투어에서 **앵커가 아닌 룸으로 들어온
 * 손님에게 차량이 없는 것처럼 보였다** — 차량이 임의의 한 룸에만 매달려
 * 있었기 때문이다.
 */
export async function loadRoomVehicles(
  supabase: RoomDbClient,
  roomId: string,
): Promise<RoomVehicleWithLayout[]> {
  const roomIds = await groupRoomIds(supabase, roomId);
  let { data, error } = await supabase
    .from('ops_room_vehicles')
    .select(ROOM_VEHICLE_OVERRIDE_SELECT)
    .in('room_id', roomIds);
  if (error) {
    ({ data, error } = await supabase
      .from('ops_room_vehicles')
      .select(ROOM_VEHICLE_BASE_SELECT)
      .in('room_id', roomIds));
  }
  if (error || !Array.isArray(data)) return [];
  return data.map((row: Record<string, unknown>) => {
    const joined = row.ops_vehicle_layouts as
      | { model?: string; layout_json?: VehicleLayoutJson; total_seats?: number }
      | null;
    const override = (row.layout_override_json as VehicleLayoutJson | null) ?? null;
    const layout = override ?? joined?.layout_json ?? null;
    return {
      id: String(row.id),
      // B0.1 이후 room_id는 nullable이다(레거시 앵커) — 그룹이 진짜 소유자다.
      room_id: row.room_id ? String(row.room_id) : '',
      layout_id: String(row.layout_id),
      plate_number: (row.plate_number as string | null) ?? null,
      layout,
      // 오버라이드가 있으면 정원도 그 배치도가 진실이다.
      total_seats: override ? override.seats.length : joined?.total_seats ?? null,
      model: joined?.model ?? null,
      layout_overridden: Boolean(override),
    };
  });
}

export async function loadAssignments(
  supabase: RoomDbClient,
  roomVehicleIds: string[],
): Promise<SeatAssignmentRow[]> {
  if (roomVehicleIds.length === 0) return [];
  const { data, error } = await supabase
    .from('ops_seat_assignments')
    .select(
      'id, room_vehicle_id, booking_id, participant_id, seat_number, guest_label, assigned_at, checked_in_at, checkin_actor, absent_at, locked',
    )
    .in('room_vehicle_id', roomVehicleIds);
  if (error || !Array.isArray(data)) return [];
  return data as SeatAssignmentRow[];
}

/**
 * seat_update 팬아웃 (§5.3 C-10 / §5.4 C-14 Realtime 동기).
 *
 * 게스트/가이드 클라이언트는 각자 per-booking 룸의 Broadcast 채널을 구독하므로
 * (D-1 — postgres_changes 아님), 같은 (tour_id, tour_date)의 모든 룸 채널로
 * 릴레이한다. RLS 정책 0개 유지 — anon 노출면 증가 없음 (스코프드 SELECT
 * 정책 대안은 기각됨).
 */
export async function broadcastSeatUpdate(
  supabase: RoomDbClient,
  room: OpsRoom,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    if (room.tour_id && room.tour_date) {
      const { data } = await supabase
        .from('tour_rooms')
        .select('id, status')
        .eq('tour_id', room.tour_id)
        .eq('tour_date', room.tour_date);
      const rooms = Array.isArray(data) && data.length > 0 ? data : [{ id: room.id, status: room.status }];
      await broadcastToRooms(rooms as Array<{ id: string; status?: string | null }>, 'seat_update', payload);
      return;
    }
    await broadcastToRoom({ id: room.id, status: room.status }, 'seat_update', payload);
  } catch {
    // best-effort by contract (broadcastToRoom과 동일) — DB 행이 진실이다.
  }
}
