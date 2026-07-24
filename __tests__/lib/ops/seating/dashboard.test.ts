/**
 * 가이드 대시보드 순수 로직 검증 — AtoC 통합 플랜 §5.4b / §11.B B1 / §12 Q6.
 * 카운터·픽업 그룹핑·게이트 활성 조건·좌석 스트립(미지정 회색)·행 상태.
 */
import type { ManifestBooking } from '@/lib/ops/manifest/group';
import {
  buildRosterRows,
  buildRosterGroups,
  buildSeatStrip,
  dashboardCounts,
  gateStatus,
  rosterRowStatus,
  type DashboardAssignment,
} from '@/lib/ops/seating/dashboard';

function booking(over: Partial<ManifestBooking> & { id: string }): ManifestBooking {
  return {
    id: over.id,
    contactName: over.contactName ?? 'Guest',
    contactPhone: over.contactPhone ?? null,
    contactEmail: over.contactEmail ?? null,
    whatsapp: over.whatsapp ?? null,
    partySize: over.partySize ?? 1,
    preferredLanguage: over.preferredLanguage ?? null,
    status: over.status ?? 'confirmed',
    source: over.source ?? null,
    externalBookingId: over.externalBookingId ?? null,
    pickupName: over.pickupName ?? null,
    pickupTime: over.pickupTime ?? null,
    specialRequests: over.specialRequests ?? null,
  };
}

function seat(over: Partial<DashboardAssignment> & { seat_number: number; booking_id: string }): DashboardAssignment {
  return {
    seat_number: over.seat_number,
    booking_id: over.booking_id,
    guest_label: over.guest_label ?? null,
    checked_in_at: over.checked_in_at ?? null,
    absent_at: over.absent_at ?? null,
    locked: over.locked ?? null,
  };
}

describe('rosterRowStatus', () => {
  it('classifies unseated / seated / partial / checked_in / absent', () => {
    expect(rosterRowStatus([])).toBe('unseated');
    expect(rosterRowStatus([seat({ seat_number: 1, booking_id: 'b' })])).toBe('seated');
    expect(
      rosterRowStatus([
        seat({ seat_number: 1, booking_id: 'b', checked_in_at: 't' }),
        seat({ seat_number: 2, booking_id: 'b' }),
      ]),
    ).toBe('partial');
    expect(
      rosterRowStatus([
        seat({ seat_number: 1, booking_id: 'b', checked_in_at: 't' }),
        seat({ seat_number: 2, booking_id: 'b', checked_in_at: 't' }),
      ]),
    ).toBe('checked_in');
    expect(rosterRowStatus([seat({ seat_number: 1, booking_id: 'b', absent_at: 't' })])).toBe('absent');
  });
});

describe('buildRosterRows', () => {
  it('merges seats + highlights per booking', () => {
    const bookings = [
      booking({ id: 'b1', contactName: 'Massimo C.', partySize: 2, source: 'gyg', specialRequests: 'vegan, nut allergy' }),
    ];
    const assignments = [
      seat({ seat_number: 4, booking_id: 'b1', checked_in_at: 't' }),
      seat({ seat_number: 3, booking_id: 'b1', checked_in_at: 't' }),
    ];
    const [row] = buildRosterRows(bookings, assignments);
    expect(row.name).toBe('Massimo C.');
    expect(row.seatNumbers).toEqual([3, 4]); // sorted
    expect(row.status).toBe('checked_in');
    expect(row.channel).toBe('gyg');
    expect(row.highlights).toEqual(expect.arrayContaining(['dietary', 'allergy']));
  });
});

describe('dashboardCounts', () => {
  it('counts pax total/teams and check-in/waiting/no-show', () => {
    const bookings = [booking({ id: 'b1', partySize: 2 }), booking({ id: 'b2', partySize: 3 }), booking({ id: 'b3', partySize: 1 })];
    const assignments = [
      seat({ seat_number: 1, booking_id: 'b1', checked_in_at: 't' }),
      seat({ seat_number: 2, booking_id: 'b1', checked_in_at: 't' }),
      seat({ seat_number: 3, booking_id: 'b2', checked_in_at: 't' }),
      seat({ seat_number: 4, booking_id: 'b2' }), // waiting
      seat({ seat_number: 5, booking_id: 'b2', absent_at: 't' }), // no-show
    ];
    const c = dashboardCounts(bookings, assignments);
    expect(c.teams).toBe(3);
    expect(c.totalPax).toBe(6);
    expect(c.checkedInPax).toBe(3);
    expect(c.absentPax).toBe(1);
    // 대기 = 6 - 3 - 1 = 2 (좌석 미지정 b3 1명 포함)
    expect(c.waitingPax).toBe(2);
  });
});

describe('gateStatus', () => {
  it('enables only when every assigned seat is resolved (§5.4 C-15/C-16)', () => {
    expect(gateStatus([]).enabled).toBe(false); // 빈 룸 게이트 방지
    const pending = gateStatus([
      seat({ seat_number: 1, booking_id: 'b', checked_in_at: 't' }),
      seat({ seat_number: 2, booking_id: 'b' }),
    ]);
    expect(pending.enabled).toBe(false);
    expect(pending.pendingCount).toBe(1);
    const ready = gateStatus([
      seat({ seat_number: 1, booking_id: 'b', checked_in_at: 't' }),
      seat({ seat_number: 2, booking_id: 'b', absent_at: 't' }),
    ]);
    expect(ready.enabled).toBe(true);
    expect(ready.pendingCount).toBe(0);
  });
});

describe('buildSeatStrip (§11.B B1 / Q6)', () => {
  it('orders seated chips by seat and appends unseated grey chips', () => {
    const bookings = [
      booking({ id: 'b1', contactName: 'Massimo C.' }),
      booking({ id: 'b2', contactName: 'Sofia R.' }),
      booking({ id: 'b3', contactName: 'Tanaka Y.' }), // claim만, 좌석 미지정
    ];
    const assignments = [
      seat({ seat_number: 4, booking_id: 'b2', checked_in_at: 't' }),
      seat({ seat_number: 3, booking_id: 'b1' }),
    ];
    const chips = buildSeatStrip(bookings, assignments);
    expect(chips.map((c) => c.seatNumber)).toEqual([3, 4, null]);
    expect(chips[0]).toMatchObject({ seatNumber: 3, label: 'Massimo C.', checkedIn: false, unseated: false });
    expect(chips[1]).toMatchObject({ seatNumber: 4, checkedIn: true });
    // Q6 — 미지정 게스트는 회색 "－ 이름" 칩
    expect(chips[2]).toMatchObject({ seatNumber: null, unseated: true, label: 'Tanaka Y.' });
  });

  it('prefers the seat guest_label over the booking name', () => {
    const bookings = [booking({ id: 'b1', contactName: 'Massimo C.' })];
    const chips = buildSeatStrip(bookings, [seat({ seat_number: 2, booking_id: 'b1', guest_label: 'Child' })]);
    expect(chips[0].label).toBe('Child');
  });
});

describe('buildRosterGroups', () => {
  it('groups by pickup and keeps unassigned last', () => {
    const bookings = [
      booking({ id: 'b1', contactName: 'A', pickupName: 'Lotte Hotel', pickupTime: '08:00' }),
      booking({ id: 'b2', contactName: 'B', pickupName: 'lotte  hotel', pickupTime: '08:00' }), // 표기 변형 → 같은 그룹
      booking({ id: 'b3', contactName: 'C', pickupName: null }),
    ];
    const groups = buildRosterGroups(bookings, []);
    expect(groups).toHaveLength(2);
    expect(groups[0].group.teamCount).toBe(2); // Lotte 그룹 통합
    expect(groups[groups.length - 1].group.key).toBe('unassigned');
  });
});
