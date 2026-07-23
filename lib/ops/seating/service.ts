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
}

export interface SeatAssignmentRow extends SeatAssignmentLike {
  id: string;
  room_vehicle_id: string;
  participant_id: string | null;
  guest_label: string | null;
  checkin_actor: string | null;
  assigned_at: string | null;
}

/** 룸의 차량들 + 배치도 (§5.3 C-7: 차량 미배정이면 빈 배열 = "좌석 오픈 예정"). */
export async function loadRoomVehicles(
  supabase: RoomDbClient,
  roomId: string,
): Promise<RoomVehicleWithLayout[]> {
  const { data, error } = await supabase
    .from('ops_room_vehicles')
    .select('id, room_id, layout_id, plate_number, ops_vehicle_layouts ( model, layout_json, total_seats )')
    .eq('room_id', roomId);
  if (error || !Array.isArray(data)) return [];
  return data.map((row: Record<string, unknown>) => {
    const joined = row.ops_vehicle_layouts as
      | { model?: string; layout_json?: VehicleLayoutJson; total_seats?: number }
      | null;
    return {
      id: String(row.id),
      room_id: String(row.room_id),
      layout_id: String(row.layout_id),
      plate_number: (row.plate_number as string | null) ?? null,
      layout: joined?.layout_json ?? null,
      total_seats: joined?.total_seats ?? null,
      model: joined?.model ?? null,
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
