/**
 * 배차의 스코프 — **읽기와 쓰기가 같은 답을 보게 하는 한 곳.**
 *
 * 🔴 왜 생겼나 (실측, 2026-08-07).
 *
 * 배차 조회(GET)는 §K B2.4 이후 **그룹 단위**다: 2호차가 그룹의 어느 룸에 붙었든
 * 그 그룹의 모든 팀 화면에 보인다. 그런데 같은 라우트의 **쓰기** 세 종류는
 * `vehicle.room_id !== roomId` 로 막고 있었다 — 룸 단위다.
 *
 * 그 둘이 어긋나면 화면이 이렇게 된다: 조인 투어 11팀 중 아무 팀이나 열면 버스가
 * **보이는데**, [배차 해제]를 누르면 **404**. 앵커 룸(차가 물린 그 한 룸)에서
 * 열었을 때만 통한다 — 11번 중 10번은 조용히 실패한다. 브라우저에서 그대로 재현했다:
 *   DELETE …/rooms/<비앵커 룸>/vehicles?vehicle_id=… → 404 "Vehicle not found in this room"
 * 사진 첨부·삭제와 배차 수정(PATCH)도 같은 검사를 쓰고 있었으므로 같이 죽는다.
 *
 * 이 저장소가 반복해서 밟는 모양 그대로다 — 만드는 문제가 아니라 **잇는 문제**이고,
 * 한쪽만 그룹을 알면 반드시 어긋난다. 그래서 규칙을 함수 하나로 못 박는다.
 */

import type { RoomDbClient } from '@/lib/tour-room/access';
import { selectRoomVehicles, type RoomVehicleRow } from '@/lib/ops/seating/layoutUsage';

export interface DispatchScopeRoom {
  id: string;
  tour_id: string | null;
  tour_date: string | null;
}

/**
 * 이 룸이 속한 그룹의 룸 id 전부. 투어/날짜를 모르는 룸은 자기 자신만 본다
 * (그룹 키를 못 만드는 룸에 남의 차를 보여 주면 그게 더 나쁘다).
 */
export async function roomIdsInGroup(
  supabase: RoomDbClient,
  room: DispatchScopeRoom,
): Promise<string[]> {
  if (!room.tour_id || !room.tour_date) return [room.id];
  const { data } = await supabase
    .from('tour_rooms')
    .select('id')
    .eq('tour_id', room.tour_id)
    .eq('tour_date', room.tour_date);
  const ids = Array.isArray(data) ? (data as Array<{ id: string }>).map((r) => r.id) : [];
  return ids.length > 0 ? [...new Set([room.id, ...ids])] : [room.id];
}

/**
 * 이 배차 행을 **이 룸에서 손대도 되는가**. 그룹 안에 있으면 된다.
 *
 * 반환이 null 이면 404 로 답해도 좋다 — 그룹 밖의 차량이면 이 룸의 화면에
 * 애초에 보이지도 않았다는 뜻이다.
 */
export async function vehicleInGroup(
  supabase: RoomDbClient,
  room: DispatchScopeRoom,
  vehicleId: string,
): Promise<RoomVehicleRow | null> {
  const { rows } = await selectRoomVehicles(supabase, { ids: [vehicleId] });
  const vehicle = rows[0];
  if (!vehicle) return null;
  // 레거시 앵커 행은 room_id 가 비어 있을 수 있다(B0.1) — 그룹이 진짜 소유자다.
  if (!vehicle.room_id) return vehicle;
  const groupRoomIds = await roomIdsInGroup(supabase, room);
  return groupRoomIds.includes(vehicle.room_id) ? vehicle : null;
}
