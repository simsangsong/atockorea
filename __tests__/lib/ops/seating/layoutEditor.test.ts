/**
 * §5.3b 배치도 편집 순수 계층 — 검증 규칙과 변형.
 *
 * 검증이 지켜야 하는 건 "예쁜 JSON"이 아니라 운영이다: 중복 번호·격자 밖
 * 좌석·정원 불일치는 좌석판과 카운터를 즉시 깨뜨리고, 사용 중 배치도에서
 * 좌석이 사라지면 그 손님의 좌석이 조용히 증발한다.
 */
import {
  MAX_COLS,
  addSeat,
  cellAt,
  groupAffectedRooms,
  hasBlockingIssues,
  issueSeatNumbers,
  issuesOfCode,
  layoutRows,
  moveSeat,
  nextSeatNumber,
  normalizeLayoutJson,
  putFixture,
  removeFixtureAt,
  removeSeat,
  removedInUseSeats,
  renumberSeats,
  setCols,
  validateVehicleLayout,
  type InUseSeatRef,
} from '@/lib/ops/seating/layoutEditor';
import { VEHICLE_LAYOUT_SEEDS } from '@/lib/ops/seating/layouts';
import type { VehicleLayoutJson } from '@/lib/ops/seating/layouts';

function base(): VehicleLayoutJson {
  return {
    model: 'county_20',
    cols: 5,
    fixtures: [{ type: 'driver', r: 0, c: 0 }],
    seats: [
      { n: 1, r: 1, c: 0 },
      { n: 2, r: 1, c: 1 },
      { n: 3, r: 1, c: 3 },
    ],
  };
}

const inUse = (seatNumber: number, roomId = 'room-1', guest = 'Massimo C.'): InUseSeatRef => ({
  roomId,
  roomVehicleId: `rv-${roomId}`,
  roomLabel: `2026-08-17 성산 · ${guest}`,
  seatNumber,
  guestLabel: guest,
});

describe('validateVehicleLayout — 저장을 막는 error', () => {
  it('passes a clean layout', () => {
    const issues = validateVehicleLayout({ layout: base(), totalSeats: 3, model: 'county_20' });
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it('every seeded model validates against its own totalSeats', () => {
    for (const seed of Object.values(VEHICLE_LAYOUT_SEEDS)) {
      const issues = validateVehicleLayout({
        layout: seed.layout,
        totalSeats: seed.totalSeats,
        model: seed.model,
      });
      expect(hasBlockingIssues(issues)).toBe(false);
    }
  });

  it('flags duplicate seat numbers and names them', () => {
    const layout = base();
    layout.seats.push({ n: 2, r: 2, c: 0 });
    const issues = validateVehicleLayout({ layout, totalSeats: 4, model: 'county_20' });
    const dup = issuesOfCode(issues, 'duplicate_seat_number');
    expect(dup).toHaveLength(1);
    expect(dup[0].severity).toBe('error');
    expect(dup[0].seats).toEqual([2]);
    expect(dup[0].message).toContain('2');
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it('flags seats outside the grid (column beyond cols)', () => {
    const layout = base();
    layout.seats.push({ n: 4, r: 1, c: 9 });
    const issues = validateVehicleLayout({ layout, totalSeats: 4, model: 'county_20' });
    expect(issuesOfCode(issues, 'seat_out_of_grid')).toHaveLength(1);
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it('flags a negative row as out of grid', () => {
    const layout = base();
    layout.seats.push({ n: 4, r: -1, c: 0 });
    expect(issuesOfCode(validateVehicleLayout({ layout }), 'seat_out_of_grid')).toHaveLength(1);
  });

  it('flags total_seats disagreeing with seats.length', () => {
    const issues = validateVehicleLayout({ layout: base(), totalSeats: 20, model: 'county_20' });
    const mismatch = issuesOfCode(issues, 'total_seats_mismatch');
    expect(mismatch).toHaveLength(1);
    expect(mismatch[0].message).toContain('20');
    expect(mismatch[0].message).toContain('3');
  });

  it('flags two seats sharing one cell', () => {
    const layout = base();
    layout.seats.push({ n: 4, r: 1, c: 0 });
    expect(issuesOfCode(validateVehicleLayout({ layout }), 'seat_cell_collision')).toHaveLength(1);
  });

  it('flags a seat placed on a fixture cell', () => {
    const layout = base();
    layout.seats.push({ n: 4, r: 0, c: 0 }); // 운전석 자리
    expect(issuesOfCode(validateVehicleLayout({ layout }), 'seat_on_fixture')).toHaveLength(1);
  });

  it('flags a fixture that overflows the grid width', () => {
    const layout = base();
    layout.fixtures.push({ type: 'door', r: 0, c: 4, w: 2 }); // cols=5 → 4+2 > 5
    expect(issuesOfCode(validateVehicleLayout({ layout }), 'fixture_out_of_grid')).toHaveLength(1);
  });

  it('rejects cols outside 1..MAX_COLS', () => {
    expect(issuesOfCode(validateVehicleLayout({ layout: setCols(base(), 0) }), 'cols_out_of_range')).toHaveLength(1);
    expect(
      issuesOfCode(validateVehicleLayout({ layout: setCols(base(), MAX_COLS + 1) }), 'cols_out_of_range'),
    ).toHaveLength(1);
  });

  it('rejects a layout whose model disagrees with the row', () => {
    expect(issuesOfCode(validateVehicleLayout({ layout: base(), model: 'bus_45' }), 'model_mismatch')).toHaveLength(1);
  });

  it('rejects an empty seat list', () => {
    const layout = { ...base(), seats: [] };
    expect(issuesOfCode(validateVehicleLayout({ layout }), 'no_seats')).toHaveLength(1);
  });

  it('collects every problem seat for highlighting', () => {
    const layout = base();
    layout.seats.push({ n: 2, r: 2, c: 0 }); // duplicate
    layout.seats.push({ n: 7, r: 1, c: 9 }); // out of grid
    expect(issueSeatNumbers(validateVehicleLayout({ layout })).sort()).toEqual([2, 7]);
  });
});

describe('validateVehicleLayout — 사용 중 배치도 (warning, 이름을 댄다)', () => {
  it('warns (not errors) when an assigned seat disappears, naming the rooms', () => {
    const layout = base(); // seats 1..3
    const issues = validateVehicleLayout({
      layout,
      totalSeats: 3,
      model: 'county_20',
      inUse: [inUse(3), inUse(9), inUse(11, 'room-2', 'Lena K.')],
    });
    const warn = issuesOfCode(issues, 'in_use_seat_removed');
    expect(warn).toHaveLength(1);
    expect(warn[0].severity).toBe('warning');
    // error가 아니어야 한다 — 사람이 확인하면 통과하는 게이트다.
    expect(hasBlockingIssues(issues)).toBe(false);
    expect(warn[0].seats?.sort((a, b) => a - b)).toEqual([9, 11]);
    expect(warn[0].rooms).toHaveLength(2);
    expect(warn[0].message).toContain('성산'); // 룸 이름이 문구에 들어간다
    expect(warn[0].rooms?.[0].guests).toContain('Massimo C.');
  });

  it('does not warn when every assigned seat survives', () => {
    const issues = validateVehicleLayout({ layout: base(), totalSeats: 3, inUse: [inUse(1), inUse(2)] });
    expect(issuesOfCode(issues, 'in_use_seat_removed')).toHaveLength(0);
  });

  it('removedInUseSeats returns only the vanished ones', () => {
    expect(removedInUseSeats(base(), [inUse(1), inUse(8)]).map((r) => r.seatNumber)).toEqual([8]);
  });

  it('groupAffectedRooms folds seats per room', () => {
    const grouped = groupAffectedRooms([inUse(9), inUse(8), inUse(4, 'room-2', 'Lena K.')]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].seats).toEqual([8, 9]); // 정렬됨
  });

  it('warns when the driver fixture is missing', () => {
    const layout = { ...base(), fixtures: [] };
    const issues = validateVehicleLayout({ layout, totalSeats: 3 });
    expect(issuesOfCode(issues, 'no_driver_fixture')[0].severity).toBe('warning');
    expect(hasBlockingIssues(issues)).toBe(false);
  });
});

describe('transforms (순수)', () => {
  it('addSeat appends at the next number and refuses occupied cells', () => {
    const added = addSeat(base(), 2, 0);
    expect(added.seats).toHaveLength(4);
    expect(added.seats[3]).toEqual({ n: 4, r: 2, c: 0 });
    // 운전석 칸 / 기존 좌석 칸에는 추가되지 않는다.
    expect(addSeat(base(), 0, 0).seats).toHaveLength(3);
    expect(addSeat(base(), 1, 0).seats).toHaveLength(3);
  });

  it('nextSeatNumber never reuses a freed number', () => {
    const shrunk = removeSeat(base(), 2);
    expect(nextSeatNumber(shrunk)).toBe(4);
  });

  it('moveSeat relocates only into free cells', () => {
    const moved = moveSeat(base(), 1, 3, 4);
    expect(moved.seats.find((s) => s.n === 1)).toEqual({ n: 1, r: 3, c: 4 });
    expect(moveSeat(base(), 1, 1, 1)).toEqual(base()); // 다른 좌석이 있는 칸
    expect(moveSeat(base(), 1, 0, 0)).toEqual(base()); // 운전석 칸
  });

  it('removeSeat drops exactly one seat', () => {
    expect(removeSeat(base(), 2).seats.map((s) => s.n)).toEqual([1, 3]);
  });

  it('renumberSeats renumbers front→rear, left→right', () => {
    const layout = base();
    layout.seats = [
      { n: 7, r: 2, c: 4 },
      { n: 1, r: 1, c: 3 },
      { n: 4, r: 1, c: 0 },
    ];
    expect(renumberSeats(layout).seats).toEqual([
      { n: 1, r: 1, c: 0 },
      { n: 2, r: 1, c: 3 },
      { n: 3, r: 2, c: 4 },
    ]);
  });

  it('putFixture replaces the existing driver rather than adding a second', () => {
    const next = putFixture(base(), 'driver', 3, 4);
    expect(next.fixtures.filter((f) => f.type === 'driver')).toHaveLength(1);
    expect(next.fixtures[0]).toEqual({ type: 'driver', r: 3, c: 4 });
  });

  it('putFixture refuses to cover a seat', () => {
    expect(putFixture(base(), 'door', 1, 0, 2)).toEqual(base());
  });

  it('putFixture stores width only when wider than one cell', () => {
    const next = putFixture(base(), 'door', 4, 3, 2);
    expect(next.fixtures.find((f) => f.type === 'door')).toEqual({ type: 'door', r: 4, c: 3, w: 2 });
  });

  it('removeFixtureAt clears a fixture through any of its cells', () => {
    const withDoor = putFixture(base(), 'door', 4, 3, 2);
    expect(removeFixtureAt(withDoor, 4, 4).fixtures.some((f) => f.type === 'door')).toBe(false);
  });

  it('cellAt reports seats, fixtures and empties', () => {
    expect(cellAt(base(), 1, 0).kind).toBe('seat');
    expect(cellAt(base(), 0, 0).kind).toBe('fixture');
    expect(cellAt(base(), 4, 4).kind).toBe('empty');
  });

  it('layoutRows covers the deepest seat or fixture', () => {
    expect(layoutRows(base())).toBe(2);
    expect(layoutRows(VEHICLE_LAYOUT_SEEDS.bus_45.layout)).toBe(12);
  });
});

describe('normalizeLayoutJson', () => {
  it('round-trips a valid layout', () => {
    expect(normalizeLayoutJson(base())).toEqual(base());
  });

  it('drops unknown fields but keeps the schema', () => {
    const parsed = normalizeLayoutJson({ ...base(), bogus: 1, seats: [{ n: 1, r: 0, c: 1, extra: 'x' }] });
    expect(parsed?.seats).toEqual([{ n: 1, r: 0, c: 1 }]);
    expect((parsed as unknown as Record<string, unknown>).bogus).toBeUndefined();
  });

  it('rejects an unknown model, non-integer coords and bad fixtures', () => {
    expect(normalizeLayoutJson({ ...base(), model: 'sedan' })).toBeNull();
    expect(normalizeLayoutJson({ ...base(), seats: [{ n: 1, r: 0.5, c: 1 }] })).toBeNull();
    expect(normalizeLayoutJson({ ...base(), fixtures: [{ type: 'toilet', r: 0, c: 0 }] })).toBeNull();
    expect(normalizeLayoutJson(null)).toBeNull();
    expect(normalizeLayoutJson('{}')).toBeNull();
  });
});
