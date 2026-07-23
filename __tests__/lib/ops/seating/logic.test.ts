/**
 * 좌석 순수 로직 검증 — seatStatus 우선순위, 시작 게이트(C-15),
 * 카운터 집계, party 연속좌석 추천.
 */
import {
  allSeatsResolved,
  buildSeatStateMap,
  seatCounts,
  seatStatus,
  suggestPartySeats,
  type SeatAssignmentLike,
} from '@/lib/ops/seating/logic';
import { VEHICLE_LAYOUT_SEEDS } from '@/lib/ops/seating/layouts';

const T = '2026-07-23T08:12:00Z';

function a(partial: Partial<SeatAssignmentLike> & { seat_number: number }): SeatAssignmentLike {
  return { booking_id: 'b-1', ...partial };
}

describe('seatStatus', () => {
  it('returns available for missing assignment', () => {
    expect(seatStatus(null)).toBe('available');
    expect(seatStatus(undefined)).toBe('available');
  });

  it('prioritizes absent > checked_in > locked > mine/taken', () => {
    expect(
      seatStatus(a({ seat_number: 1, absent_at: T, checked_in_at: T, locked: true }), 'b-1'),
    ).toBe('absent');
    expect(seatStatus(a({ seat_number: 1, checked_in_at: T, locked: true }), 'b-1')).toBe(
      'checked_in',
    );
    expect(seatStatus(a({ seat_number: 1, locked: true }), 'b-1')).toBe('locked');
  });

  it('distinguishes mine vs taken by viewerBookingId', () => {
    expect(seatStatus(a({ seat_number: 1 }), 'b-1')).toBe('mine');
    expect(seatStatus(a({ seat_number: 1 }), 'b-2')).toBe('taken');
    // 가이드/admin 뷰 (viewer 없음) → 배정석은 taken 계열
    expect(seatStatus(a({ seat_number: 1 }))).toBe('taken');
  });
});

describe('buildSeatStateMap', () => {
  const layout = VEHICLE_LAYOUT_SEEDS.solati_16.layout;

  it('maps assignments to states and leaves unassigned seats out (=available)', () => {
    const map = buildSeatStateMap(
      layout,
      [
        a({ seat_number: 1 }),
        a({ seat_number: 2, booking_id: 'b-2', checked_in_at: T }),
        a({ seat_number: 3, booking_id: 'b-3', absent_at: T }),
      ],
      'b-1',
    );
    expect(map).toEqual({ 1: 'mine', 2: 'checked_in', 3: 'absent' });
    expect(map[4]).toBeUndefined();
  });

  it('ignores seat numbers outside the layout', () => {
    const map = buildSeatStateMap(layout, [a({ seat_number: 99 })]);
    expect(map).toEqual({});
  });
});

describe('allSeatsResolved (시작 게이트 C-15)', () => {
  it('is false with no assignments (빈 룸에서 게이트가 열리면 안 됨)', () => {
    expect(allSeatsResolved([])).toBe(false);
  });

  it('is true when every seat is checked in or absent', () => {
    expect(
      allSeatsResolved([
        a({ seat_number: 1, checked_in_at: T }),
        a({ seat_number: 2, checked_in_at: T }),
      ]),
    ).toBe(true);
    expect(
      allSeatsResolved([
        a({ seat_number: 1, checked_in_at: T }),
        a({ seat_number: 2, absent_at: T }), // 노쇼는 게이트 계산에서 제외
      ]),
    ).toBe(true);
  });

  it('is false while anyone is still waiting', () => {
    expect(
      allSeatsResolved([
        a({ seat_number: 1, checked_in_at: T }),
        a({ seat_number: 2 }), // seated, not yet checked in
      ]),
    ).toBe(false);
  });
});

describe('seatCounts', () => {
  it('aggregates checked-in / absent / waiting', () => {
    expect(
      seatCounts([
        a({ seat_number: 1, checked_in_at: T }),
        a({ seat_number: 2, checked_in_at: T }),
        a({ seat_number: 3, absent_at: T }),
        a({ seat_number: 4 }),
      ]),
    ).toEqual({ total: 4, checkedIn: 2, absent: 1, waiting: 1 });
  });
});

describe('suggestPartySeats', () => {
  const bus45 = VEHICLE_LAYOUT_SEEDS.bus_45.layout;
  const county = VEHICLE_LAYOUT_SEEDS.county_20.layout;

  it('prefers a physically adjacent run in the frontmost row', () => {
    expect(suggestPartySeats(bus45, [], 2)).toEqual([1, 2]);
  });

  it('skips taken seats and does not bridge the aisle as "adjacent"', () => {
    // 좌석 1 점유 → 1열 잔여 {2(c1),3(c3),4(c4)}: 2와 3은 통로로 단절 →
    // 인접 run은 [3,4].
    expect(suggestPartySeats(bus45, [1], 2)).toEqual([3, 4]);
  });

  it('finds the rear bench for parties larger than a 2-seat pair', () => {
    // bus_45 중간열 run 최대 2 → 3명은 최후열 5연석에서.
    expect(suggestPartySeats(bus45, [], 3)).toEqual([41, 42, 43]);
  });

  it('falls back to same-row seats across the aisle, then front-to-back fill', () => {
    // county_20에서 4번(r1)과 17번(r5)만 비어 있음 → 같은 행 불가 → 앞→뒤 폴백.
    const taken = county.seats.map((s) => s.n).filter((n) => n !== 4 && n !== 17);
    expect(suggestPartySeats(county, taken, 2)).toEqual([4, 17]);
  });

  it('returns null when there are not enough free seats or party size is invalid', () => {
    const allTaken = bus45.seats.map((s) => s.n);
    expect(suggestPartySeats(bus45, allTaken, 1)).toBeNull();
    expect(suggestPartySeats(bus45, allTaken.slice(0, 44), 2)).toBeNull();
    expect(suggestPartySeats(bus45, [], 0)).toBeNull();
  });
});
