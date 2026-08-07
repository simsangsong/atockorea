/**
 * @jest-environment node
 *
 * 배차 쓰기의 스코프 — **보이는 차는 손댈 수 있어야 한다.**
 *
 * 🔴 The defect this pins, reproduced in a real browser on 2026-08-07.
 *
 * `GET …/rooms/[roomId]/vehicles` has been GROUP-scoped since §K B2.4: a second
 * bus attached to any room in the (tour_id, tour_date) group shows on every
 * team's dispatch panel. The writes were still ROOM-scoped
 * (`vehicle.room_id !== roomId → 404`). On a join tour with 11 teams that means
 * the operator sees the bus from all 11 and can only touch it from the one
 * anchor room — ten silent 404s out of eleven:
 *
 *   DELETE /api/admin/tour-ops/rooms/<non-anchor>/vehicles?vehicle_id=…
 *   → 404 "Vehicle not found in this room"   (the panel showed that very bus)
 *
 * PATCH and the two photo endpoints carried the same check, so 배차 수정 and
 * 차량 사진 died the same way. One rule now, in `dispatchScope.ts` — this file
 * exists so read-scope and write-scope cannot drift apart again.
 */
import '@/test-utils/restoreWebPrimitives';
import { roomIdsInGroup, vehicleInGroup } from '@/lib/ops/seating/dispatchScope';
import { selectRoomVehicles } from '@/lib/ops/seating/layoutUsage';

jest.mock('@/lib/ops/seating/layoutUsage', () => ({ selectRoomVehicles: jest.fn() }));
const selectRoomVehiclesMock = selectRoomVehicles as jest.Mock;

const TOUR = 'tour-join';
const DATE = '2026-08-08';
/** 앵커(차가 물린 룸)와 형제. 손님 11팀이면 형제가 10개다. */
const ANCHOR = { id: 'room-anchor', tour_id: TOUR, tour_date: DATE };
const SIBLING = { id: 'room-sibling', tour_id: TOUR, tour_date: DATE };
const OUTSIDER = { id: 'room-other', tour_id: 'tour-other', tour_date: DATE };

/** 그룹 조회는 (tour_id, tour_date) 로 형제 룸을 돌려준다. */
function db(groupRooms: string[] = ['room-anchor', 'room-sibling']) {
  return {
    from() {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq']) chain[m] = jest.fn(() => chain);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ data: groupRooms.map((id) => ({ id })), error: null }).then(res, rej);
      return chain;
    },
  } as never;
}

const busOnAnchor = { id: 'v1', room_id: 'room-anchor', layout_id: 'l1', plate_number: '12가 3456' };

beforeEach(() => {
  jest.clearAllMocks();
  selectRoomVehiclesMock.mockResolvedValue({ rows: [busOnAnchor], migrationPending: false });
});

describe('roomIdsInGroup', () => {
  it('returns the whole tour-date group', async () => {
    expect(await roomIdsInGroup(db(), ANCHOR)).toEqual(expect.arrayContaining(['room-anchor', 'room-sibling']));
  });

  it('falls back to the room alone when it has no tour scope', async () => {
    // 그룹 키를 못 만드는 룸에 남의 차를 보여 주는 쪽이 더 나쁘다.
    expect(await roomIdsInGroup(db(), { id: 'room-x', tour_id: null, tour_date: null })).toEqual(['room-x']);
  });
});

describe('vehicleInGroup — the write guard', () => {
  it('🔴 lets a SIBLING room touch the bus (the ten-out-of-eleven case)', async () => {
    expect(await vehicleInGroup(db(), SIBLING, 'v1')).toEqual(busOnAnchor);
  });

  it('still lets the anchor room touch it', async () => {
    expect(await vehicleInGroup(db(), ANCHOR, 'v1')).toEqual(busOnAnchor);
  });

  it('refuses a room in a DIFFERENT tour group', async () => {
    // 다른 투어의 룸에서 이 차를 지울 수 있으면 그건 스코프가 아니라 구멍이다.
    expect(await vehicleInGroup(db(['room-other']), OUTSIDER, 'v1')).toBeNull();
  });

  it('refuses a vehicle id that does not exist', async () => {
    selectRoomVehiclesMock.mockResolvedValue({ rows: [], migrationPending: false });
    expect(await vehicleInGroup(db(), ANCHOR, 'nope')).toBeNull();
  });

  /**
   * B0.1 남긴 레거시 행 — `room_id` 가 비어 있고 그룹이 소유자다. 룸 비교로는
   * 영영 못 건드리는 유령이 된다.
   */
  it('allows a legacy row whose room_id was cleared', async () => {
    selectRoomVehiclesMock.mockResolvedValue({
      rows: [{ ...busOnAnchor, room_id: null }],
      migrationPending: false,
    });
    expect(await vehicleInGroup(db(), SIBLING, 'v1')).not.toBeNull();
  });
});
