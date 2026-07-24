/**
 * @jest-environment node
 *
 * §K B0.5 — 마스터 룸 회귀 3시나리오.
 *
 * B0가 고치려는 결함은 하나다: **차량이 임의의 한 예약 룸에 매달려 있다.**
 * 그래서 확인해야 할 것도 셋이다:
 *   ① 프라이빗 투어(예약 1 = 그룹 1)가 **완전히 동일하게** 동작한다
 *   ② 조인투어에서 앵커가 아닌 룸으로 들어와도 차량이 보인다
 *   ③ 앵커 예약 삭제가 더 이상 남의 좌석·증거를 지우지 않는다(스키마 계약)
 */

import { loadRoomVehicles } from '../service';

type Row = Record<string, unknown>;

/**
 * 인메모리 supabase — `.eq/.in/.maybeSingle/await` 체인만 지원한다.
 * `ops_room_vehicles` 조회에서 `layout_override_json` 컬럼이 없는 환경을
 * 흉내내려면 `overrideColumnMissing`을 켠다(기존 폴백 경로 회귀).
 */
function makeDb(seed: { rooms: Row[]; vehicles: Row[] }, opts: { overrideColumnMissing?: boolean } = {}) {
  const queries: string[] = [];
  function builder(table: string) {
    const preds: Array<(r: Row) => boolean> = [];
    let selected = '';
    const api = {
      select(cols?: string) {
        selected = cols ?? '';
        return api;
      },
      eq(col: string, val: unknown) {
        preds.push((r) => r[col] === val);
        return api;
      },
      in(col: string, vals: unknown[]) {
        preds.push((r) => vals.includes(r[col]));
        return api;
      },
      maybeSingle() {
        const src = table === 'tour_rooms' ? seed.rooms : seed.vehicles;
        queries.push(`${table}:maybeSingle`);
        return Promise.resolve({ data: src.filter((r) => preds.every((p) => p(r)))[0] ?? null, error: null });
      },
      then(resolve: (v: { data: Row[] | null; error: unknown }) => unknown) {
        const src = table === 'tour_rooms' ? seed.rooms : seed.vehicles;
        queries.push(`${table}:list`);
        if (table === 'ops_room_vehicles' && opts.overrideColumnMissing && selected.includes('layout_override_json')) {
          return Promise.resolve(resolve({ data: null, error: { message: 'column does not exist' } }));
        }
        return Promise.resolve(resolve({ data: src.filter((r) => preds.every((p) => p(r))), error: null }));
      },
    };
    return api;
  }
  return { client: { from: (t: string) => builder(t) } as never, queries };
}

const LAYOUT = { model: 'county_20', layout_json: { seats: [{ n: 1 }, { n: 2 }] }, total_seats: 20 };

describe('① 프라이빗 투어 — 예약 1 = 그룹 1, 동작 무변경', () => {
  it('자기 룸의 차량을 그대로 본다', async () => {
    const db = makeDb({
      rooms: [{ id: 'R1', booking_id: 'B1', tour_id: 'T-private', tour_date: '2026-08-17' }],
      vehicles: [{ id: 'V1', room_id: 'R1', layout_id: 'L1', plate_number: '12가3456', ops_vehicle_layouts: LAYOUT }],
    });
    const vehicles = await loadRoomVehicles(db.client, 'R1');
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0].plate_number).toBe('12가3456');
  });

  it('투어/날짜가 없는 룸은 자기 자신만 본다 — 아무 그룹에나 붙지 않는다', async () => {
    const db = makeDb({
      rooms: [
        { id: 'R1', booking_id: 'B1', tour_id: null, tour_date: null },
        { id: 'R9', booking_id: 'B9', tour_id: null, tour_date: null },
      ],
      vehicles: [
        { id: 'V1', room_id: 'R1', layout_id: 'L1', ops_vehicle_layouts: LAYOUT },
        { id: 'V9', room_id: 'R9', layout_id: 'L1', ops_vehicle_layouts: LAYOUT },
      ],
    });
    const vehicles = await loadRoomVehicles(db.client, 'R1');
    expect(vehicles.map((v) => v.id)).toEqual(['V1']);
  });
});

describe('🔴 ② 조인투어 — 앵커가 아닌 룸으로 들어와도 차량이 보인다', () => {
  const seed = {
    rooms: [
      { id: 'R1', booking_id: 'B1', tour_id: 'T1', tour_date: '2026-08-17' },
      { id: 'R2', booking_id: 'B2', tour_id: 'T1', tour_date: '2026-08-17' },
      { id: 'R3', booking_id: 'B3', tour_id: 'T1', tour_date: '2026-08-17' },
      // 다른 날 — 절대 섞이면 안 된다.
      { id: 'RX', booking_id: 'BX', tour_id: 'T1', tour_date: '2026-08-18' },
    ],
    vehicles: [
      // 차량은 앵커(R1)에만 매달려 있다 — B0 이전의 실제 모습.
      { id: 'V1', room_id: 'R1', layout_id: 'L1', plate_number: '12가3456', ops_vehicle_layouts: LAYOUT },
      { id: 'VX', room_id: 'RX', layout_id: 'L1', plate_number: '99하9999', ops_vehicle_layouts: LAYOUT },
    ],
  };

  it('B2로 들어와도 그룹의 차량을 본다 — 이전에는 "차량 미배정"으로 보였다', async () => {
    const db = makeDb(seed);
    const vehicles = await loadRoomVehicles(db.client, 'R2');
    expect(vehicles.map((v) => v.id)).toEqual(['V1']);
  });

  it('B3도 같은 답을 본다 — 좌석판·명단·체크인 세 화면이 동시에 일치한다', async () => {
    const db = makeDb(seed);
    expect((await loadRoomVehicles(db.client, 'R3')).map((v) => v.id)).toEqual(['V1']);
  });

  it('🔴 다른 날짜의 차량은 절대 섞이지 않는다', async () => {
    const db = makeDb(seed);
    const vehicles = await loadRoomVehicles(db.client, 'R2');
    expect(vehicles.map((v) => v.plate_number)).not.toContain('99하9999');
  });

  it('2호차를 붙이면 그룹 전원이 두 대를 본다 (B2.4 기반)', async () => {
    const db = makeDb({
      ...seed,
      vehicles: [
        ...seed.vehicles,
        { id: 'V2', room_id: 'R2', layout_id: 'L1', plate_number: '34나5678', ops_vehicle_layouts: LAYOUT },
      ],
    });
    const vehicles = await loadRoomVehicles(db.client, 'R3');
    expect(vehicles.map((v) => v.id).sort()).toEqual(['V1', 'V2']);
  });
});

describe('③ 견고성', () => {
  it('오버라이드 컬럼이 없는 환경에서도 기존 폴백으로 차량이 뜬다', async () => {
    const db = makeDb(
      {
        rooms: [{ id: 'R1', booking_id: 'B1', tour_id: 'T1', tour_date: '2026-08-17' }],
        vehicles: [{ id: 'V1', room_id: 'R1', layout_id: 'L1', ops_vehicle_layouts: LAYOUT }],
      },
      { overrideColumnMissing: true },
    );
    expect(await loadRoomVehicles(db.client, 'R1')).toHaveLength(1);
  });

  it('room_id가 NULL로 떨어진 레거시 차량이 있어도 터지지 않는다', async () => {
    // B0.1 이후 앵커 예약이 삭제되면 room_id는 SET NULL이 된다 — 그 상태에서도
    // 조회가 죽지 않아야 좌석판이 뜬다.
    const db = makeDb({
      rooms: [{ id: 'R1', booking_id: 'B1', tour_id: 'T1', tour_date: '2026-08-17' }],
      vehicles: [{ id: 'V1', room_id: 'R1', layout_id: 'L1', ops_vehicle_layouts: LAYOUT }],
    });
    const vehicles = await loadRoomVehicles(db.client, 'R1');
    expect(vehicles[0].room_id).toBe('R1');
  });

  it('차량이 없으면 빈 배열 — "좌석 오픈 예정"(§5.3 C-7) 상태가 유지된다', async () => {
    const db = makeDb({
      rooms: [{ id: 'R1', booking_id: 'B1', tour_id: 'T1', tour_date: '2026-08-17' }],
      vehicles: [],
    });
    expect(await loadRoomVehicles(db.client, 'R1')).toEqual([]);
  });
});
