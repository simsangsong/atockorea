/**
 * 픽업그룹 색 오버레이 순수 로직 (§5.4b) — 결정론·안정성·미지정 규칙·접근성 짝.
 */
import {
  buildPickupGroupLegend,
  buildPickupSeatAccents,
  pickupGroupColor,
} from '@/lib/ops/seating/pickupGroupColor';
import { groupBookingsByPickup, normalizePickupKey, type ManifestBooking } from '@/lib/ops/manifest/group';
import { AVATAR_PALETTE } from '@/lib/tour-room/avatarColor';
import type { DashboardAssignment } from '@/lib/ops/seating/dashboard';

function booking(id: string, pickup: string | null, time: string | null, party = 1): ManifestBooking {
  return {
    id,
    contactName: id.toUpperCase(),
    contactPhone: null,
    contactEmail: null,
    partySize: party,
    preferredLanguage: 'en',
    status: 'confirmed',
    source: 'gyg',
    externalBookingId: null,
    pickupName: pickup,
    pickupTime: time,
    specialRequests: null,
  };
}

const seat = (n: number, bookingId: string): DashboardAssignment => ({
  seat_number: n,
  booking_id: bookingId,
});

describe('pickupGroupColor', () => {
  it('is deterministic: the same canonical key always yields the same colour', () => {
    const a = pickupGroupColor(normalizePickupKey('Lotte Hotel'));
    const b = pickupGroupColor(normalizePickupKey('lotte-hotel'));
    const c = pickupGroupColor(normalizePickupKey('Lotte  Hotel '));
    expect(a).toBeTruthy();
    expect(b).toBe(a); // 표기 변형은 같은 canonical 키 → 같은 색
    expect(c).toBe(a);
  });

  it('only ever emits colours from the shared avatar palette (no second scheme)', () => {
    const inks = new Set(AVATAR_PALETTE.map((p) => p.ink));
    for (const name of ['Lotte Hotel', 'Myeongdong', 'Seoul Station', '제주공항', 'Hongdae', 'Gangnam']) {
      expect(inks.has(pickupGroupColor(normalizePickupKey(name)) as string)).toBe(true);
    }
  });

  it('gives the unassigned bucket no colour at all', () => {
    expect(pickupGroupColor(normalizePickupKey(null))).toBeNull();
    expect(pickupGroupColor('unassigned')).toBeNull();
    expect(pickupGroupColor('')).toBeNull();
  });
});

describe('buildPickupGroupLegend', () => {
  const bookings = [
    booking('b1', 'Lotte Hotel', '08:00', 2),
    booking('b2', 'Myeongdong Station', '08:30', 3),
    booking('b3', null, null, 1),
  ];

  it('numbers groups 1..n in render order and carries pickup metadata', () => {
    const legend = buildPickupGroupLegend(groupBookingsByPickup(bookings));
    expect(legend.map((e) => e.index)).toEqual([1, 2, 3]);
    expect(legend[0]).toMatchObject({ displayName: 'Lotte Hotel', firstPickupTime: '08:00', paxCount: 2 });
    // 미지정은 항상 마지막이고 색이 없다.
    expect(legend[2].color).toBeNull();
    expect(legend[2].displayName).toBe('픽업 미지정');
  });

  it('keeps every group colour stable when another group is added or removed', () => {
    const before = buildPickupGroupLegend(groupBookingsByPickup(bookings));
    const withExtra = buildPickupGroupLegend(
      groupBookingsByPickup([...bookings, booking('b4', 'Gangnam', '07:15', 4)]),
    );
    const withoutFirst = buildPickupGroupLegend(
      groupBookingsByPickup(bookings.filter((b) => b.id !== 'b1')),
    );

    const colorOf = (legend: ReturnType<typeof buildPickupGroupLegend>, key: string) =>
      legend.find((e) => e.key === key)?.color;

    const lotte = normalizePickupKey('Lotte Hotel');
    const myeongdong = normalizePickupKey('Myeongdong Station');
    // 새 그룹이 맨 앞(07:15)에 끼어들어 index는 밀리지만 색은 그대로다.
    expect(withExtra.find((e) => e.key === lotte)!.index).toBe(2);
    expect(colorOf(withExtra, lotte)).toBe(colorOf(before, lotte));
    expect(colorOf(withExtra, myeongdong)).toBe(colorOf(before, myeongdong));
    // 그룹이 사라져도 남은 그룹의 색은 불변.
    expect(colorOf(withoutFirst, myeongdong)).toBe(colorOf(before, myeongdong));
  });
});

describe('buildPickupSeatAccents', () => {
  const bookings = [
    booking('b1', 'Lotte Hotel', '08:00', 2),
    booking('b2', 'Myeongdong Station', '08:30', 1),
    booking('b3', null, null, 1),
  ];
  const legend = buildPickupGroupLegend(groupBookingsByPickup(bookings));

  it('paints every seat of a booking with its pickup group colour + number badge', () => {
    const accents = buildPickupSeatAccents(legend, [seat(1, 'b1'), seat(2, 'b1'), seat(5, 'b2')]);
    expect(accents[1]).toEqual(accents[2]); // 같은 팀 = 같은 액센트
    expect(accents[1].color).toBe(pickupGroupColor(normalizePickupKey('Lotte Hotel')));
    expect(accents[5].color).not.toBe(accents[1].color);

    // 접근성: 색 외 2차 신호가 항상 함께 온다 (번호 배지 + aria 설명).
    expect(accents[1].label).toBe(String(legend.find((e) => e.key === normalizePickupKey('Lotte Hotel'))!.index));
    expect(accents[1].description).toContain('Lotte Hotel');
  });

  it('leaves seats of the unassigned bucket (and unknown bookings) untouched', () => {
    const accents = buildPickupSeatAccents(legend, [seat(9, 'b3'), seat(10, 'b-ghost')]);
    expect(accents[9]).toBeUndefined();
    expect(accents[10]).toBeUndefined();
  });

  it('returns an empty map for an empty legend or empty assignments', () => {
    expect(buildPickupSeatAccents([], [seat(1, 'b1')])).toEqual({});
    expect(buildPickupSeatAccents(legend, [])).toEqual({});
  });
});
