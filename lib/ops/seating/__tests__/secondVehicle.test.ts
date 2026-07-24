/**
 * @jest-environment node
 *
 * §K B2.4 — 2호차 분리.
 *
 * B2-D5는 "초과는 차단이 아니라 경고 + 분리 제안"이다. 그 제안이 실제로
 * 성립하려면 **2호차를 붙였을 때 실효 정원이 늘어나야** 하고, 좌석판·명단이
 * 두 대를 함께 봐야 한다(B0.4가 그 절반을 했다).
 */

import { capacityVerdict, effectiveCapacity, overCapacityNotice } from '../capacity';

const smallGroup = { max_room_guests: 12, price_type: 'person' };
const party = (n: number) => ({ number_of_guests: n, status: 'confirmed' });
const county = { total_seats: 20 };
const solati = { total_seats: 13 };

describe('2호차를 붙이면 실효 정원이 늘어난다', () => {
  it('차량 1대: 좌석수가 상품 정원보다 적으면 좌석이 진실이다', () => {
    // 쏠라티 13석에 12인 캡 → 12 (상품 캡이 더 작다)
    expect(effectiveCapacity(smallGroup, [solati])).toBe(12);
  });

  it('🔴 상품 정원이 병목이면 2호차를 붙여도 정원은 그대로다 — 상품 캡을 올려야 한다', () => {
    // B2-D4가 min()인 이상, 좌석만 늘려서는 상품 캡을 넘길 수 없다.
    // 운영자가 "차를 붙였는데 왜 여전히 초과지?"를 만나는 지점이라 명시해 둔다.
    expect(effectiveCapacity(smallGroup, [solati, county])).toBe(12);
  });

  it('그룹 예외 정원을 올린 뒤 2호차를 붙이면 좌석만큼 늘어난다', () => {
    const group = { capacity: 30 };
    expect(effectiveCapacity(smallGroup, [solati], group)).toBe(13);
    expect(effectiveCapacity(smallGroup, [solati, county], group)).toBe(30);
  });

  it('전세(상품 캡 없음)는 붙인 좌석 합이 그대로 정원이다', () => {
    const charter = { max_room_guests: null, price_type: 'vehicle' };
    expect(effectiveCapacity(charter, [solati])).toBe(13);
    expect(effectiveCapacity(charter, [solati, county])).toBe(33);
  });
});

describe('초과 → 분리 → 해소', () => {
  const group = { capacity: 30 };

  it('14명 / 쏠라티 1대(13석) = 초과', () => {
    const v = capacityVerdict([party(8), party(6)], smallGroup, [solati], group);
    expect(v).toMatchObject({ headcount: 14, capacity: 13, over: true, overBy: 1 });
  });

  it('카운티를 2호차로 붙이면 해소된다', () => {
    const v = capacityVerdict([party(8), party(6)], smallGroup, [solati, county], group);
    expect(v.over).toBe(false);
    expect(v.capacity).toBe(30);
  });

  it('경고 문구가 "2호차"를 말한다 — "막혔다"가 아니다 (B2-D5)', () => {
    const v = capacityVerdict([party(8), party(6)], smallGroup, [solati], group);
    const text = overCapacityNotice(v, 'Jeju Grand Highlights') ?? '';
    expect(text).toContain('2호차');
    expect(text).not.toContain('불가');
    expect(text).not.toContain('차단');
  });

  it('🔴 B2-D1 — 분리 동선 어디에도 매진·잔여 문구가 없다', () => {
    const v = capacityVerdict([party(14)], smallGroup, [solati], group);
    const text = overCapacityNotice(v, 'Jeju') ?? '';
    for (const banned of ['매진', '잔여', 'sold out', 'Sold out', '마감']) {
      expect(text).not.toContain(banned);
    }
  });
});

describe('차량 미배정 상태', () => {
  it('배차 전에는 상품 정원만 본다 — 좌석 0으로 오해해 전부 초과로 만들지 않는다', () => {
    const v = capacityVerdict([party(10)], smallGroup, []);
    expect(v.capacity).toBe(12);
    expect(v.over).toBe(false);
  });

  it('배차 전이라도 상품 정원을 넘으면 초과다 — 그게 2호차를 미리 준비하는 신호다', () => {
    const v = capacityVerdict([party(14)], smallGroup, []);
    expect(v).toMatchObject({ over: true, overBy: 2 });
  });
});
