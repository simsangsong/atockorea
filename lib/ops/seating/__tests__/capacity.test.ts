/**
 * §K B2 — 정원 순수 함수.
 *
 * 이 스위트가 지키는 계약:
 *   1. 해석 순서가 한 곳에 있고 바뀌지 않는다 (B2.1b — 드리프트 방지).
 *   2. 전세 상품의 "정원 없음"과 "0명"이 절대 같아지지 않는다.
 *   3. 차량 미배정이 모든 그룹을 초과로 만들지 않는다.
 *   4. 취소 예약이 자리를 차지하지 않는다.
 */

import {
  CAPACITY_DEFAULTS,
  capacityVerdict,
  effectiveCapacity,
  groupHeadcount,
  overCapacityNotice,
  productCapacity,
} from '../capacity';

const smallGroup = { max_room_guests: 12, price_type: 'person' };
const unsetPerson = { max_room_guests: null, price_type: 'person' };
const charter = { max_room_guests: null, price_type: 'vehicle' };

describe('productCapacity — B2.1b 해석 순서', () => {
  it('① 그룹 예외가 있으면 그것이 이긴다', () => {
    expect(productCapacity(smallGroup, { capacity: 14 })).toBe(14);
  });

  it('② 그룹 예외가 없으면 상품값', () => {
    expect(productCapacity(smallGroup, { capacity: null })).toBe(12);
    expect(productCapacity(smallGroup)).toBe(12);
  });

  it('③ 상품값도 없으면 price_type 코드 기본값', () => {
    expect(productCapacity(unsetPerson)).toBe(CAPACITY_DEFAULTS.person);
    expect(productCapacity(unsetPerson)).toBe(12);
  });

  it('전세(vehicle)는 상품 축에 제한이 없다 — null이지 0이 아니다', () => {
    expect(productCapacity(charter)).toBeNull();
    expect(productCapacity(charter)).not.toBe(0);
  });

  it('모르는 price_type도 null — 임의의 숫자를 지어내지 않는다', () => {
    expect(productCapacity({ max_room_guests: null, price_type: 'mystery' })).toBeNull();
    expect(productCapacity(null)).toBeNull();
  });

  it('0·음수는 값이 아니다 — 다음 단계로 내려간다', () => {
    expect(productCapacity({ max_room_guests: 0, price_type: 'person' })).toBe(12);
    expect(productCapacity(smallGroup, { capacity: 0 })).toBe(12);
    expect(productCapacity(smallGroup, { capacity: -5 })).toBe(12);
  });
});

describe('effectiveCapacity — B2-D4 min(상품, 좌석)', () => {
  it('좌석이 더 적으면 좌석이 진실이다', () => {
    expect(effectiveCapacity(smallGroup, [{ total_seats: 13 }])).toBe(12);
    expect(effectiveCapacity({ max_room_guests: 20, price_type: 'person' }, [{ total_seats: 13 }])).toBe(13);
  });

  it('차량이 여러 대면 좌석을 합한다 — 2호차를 붙이면 정원이 늘어야 한다', () => {
    expect(effectiveCapacity({ max_room_guests: 30, price_type: 'person' }, [
      { total_seats: 13 },
      { total_seats: 20 },
    ])).toBe(30);
    expect(effectiveCapacity({ max_room_guests: 40, price_type: 'person' }, [
      { total_seats: 13 },
      { total_seats: 20 },
    ])).toBe(33);
  });

  it('🔴 차량 미배정이면 상품 정원만 쓴다 — 0으로 보면 배정 전 모든 그룹이 초과로 뜬다', () => {
    expect(effectiveCapacity(smallGroup, [])).toBe(12);
    expect(effectiveCapacity(smallGroup, null)).toBe(12);
    expect(effectiveCapacity(smallGroup, [{ total_seats: null }])).toBe(12);
  });

  it('전세 + 차량 배정 = 좌석수가 실효 정원이다', () => {
    expect(effectiveCapacity(charter, [{ total_seats: 13 }])).toBe(13);
  });

  it('전세 + 차량 미배정 = 정원 없음', () => {
    expect(effectiveCapacity(charter, [])).toBeNull();
  });
});

describe('groupHeadcount', () => {
  it('활성 예약의 게스트를 더한다', () => {
    expect(groupHeadcount([
      { number_of_guests: 2, status: 'confirmed' },
      { number_of_guests: 4, status: 'confirmed' },
    ])).toBe(6);
  });

  it('취소·환불은 자리를 차지하지 않는다', () => {
    expect(groupHeadcount([
      { number_of_guests: 2, status: 'confirmed' },
      { number_of_guests: 8, status: 'cancelled' },
      { number_of_guests: 8, status: 'REFUNDED' },
    ])).toBe(2);
  });

  it('빈 그룹은 0명', () => {
    expect(groupHeadcount([])).toBe(0);
    expect(groupHeadcount(null)).toBe(0);
  });
});

describe('capacityVerdict', () => {
  const party = (n: number) => ({ number_of_guests: n, status: 'confirmed' });

  it('정원 이내면 초과가 아니다', () => {
    const v = capacityVerdict([party(4), party(6)], smallGroup);
    expect(v).toEqual({ headcount: 10, capacity: 12, over: false, overBy: 0, remaining: 2 });
  });

  it('정확히 정원이면 초과가 아니다 — 경계에서 거짓 경고를 내지 않는다', () => {
    const v = capacityVerdict([party(12)], smallGroup);
    expect(v.over).toBe(false);
    expect(v.remaining).toBe(0);
  });

  it('초과하면 몇 명 초과인지까지 준다 — 2호차 인원 산정에 쓴다', () => {
    const v = capacityVerdict([party(8), party(6)], smallGroup);
    expect(v).toMatchObject({ headcount: 14, capacity: 12, over: true, overBy: 2, remaining: 0 });
  });

  it('정원이 없는 그룹은 절대 초과가 아니다', () => {
    const v = capacityVerdict([party(40)], charter, []);
    expect(v).toEqual({ headcount: 40, capacity: null, over: false, overBy: 0, remaining: null });
  });

  it('그룹 예외 정원이 판정을 바꾼다 — 그날만 14명 허용', () => {
    expect(capacityVerdict([party(14)], smallGroup).over).toBe(true);
    expect(capacityVerdict([party(14)], smallGroup, null, { capacity: 14 }).over).toBe(false);
  });
});

describe('overCapacityNotice — B2-D5 문구', () => {
  const party = (n: number) => ({ number_of_guests: n, status: 'confirmed' });

  it('초과가 아니면 문구가 없다', () => {
    expect(overCapacityNotice(capacityVerdict([party(10)], smallGroup))).toBeNull();
  });

  it('초과면 "2호차가 필요하다"로 말한다 — "막혔다"가 아니다', () => {
    const text = overCapacityNotice(capacityVerdict([party(14)], smallGroup), 'Jeju Grand Highlights');
    expect(text).toContain('14명');
    expect(text).toContain('정원 12 초과');
    expect(text).toContain('2호차');
  });

  it('🔴 B2-D1 — 문구 어디에도 매진·잔여가 없다(희소성 UI 금지)', () => {
    const text = overCapacityNotice(capacityVerdict([party(14)], smallGroup), 'Jeju') ?? '';
    for (const banned of ['매진', '잔여', 'Sold out', 'sold out', '마감', '자리 남']) {
      expect(text).not.toContain(banned);
    }
  });
});
