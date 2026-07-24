/**
 * §K B1 — 주/월 범위 (KST).
 */

import { datesIn, leadingBlanks, monthRange, monthRangeOf, weekRange } from '../ranges';

// 2026-08-17은 월요일(KST). 03:00Z = 12:00 KST.
const MON = Date.parse('2026-08-17T03:00:00Z');
const SUN = Date.parse('2026-08-23T03:00:00Z');

describe('weekRange — 월요일 시작', () => {
  it('월요일에는 그날이 주 시작이다', () => {
    expect(weekRange(MON)).toEqual({ from: '2026-08-17', to: '2026-08-23' });
  });

  it('🔴 일요일도 같은 주다 — 일요일 시작으로 자르면 토·일이 갈라진다(주말이 성수기)', () => {
    expect(weekRange(SUN)).toEqual({ from: '2026-08-17', to: '2026-08-23' });
  });

  it('주 중간 아무 날이나 같은 범위를 준다', () => {
    expect(weekRange(Date.parse('2026-08-20T03:00:00Z'))).toEqual({ from: '2026-08-17', to: '2026-08-23' });
  });

  it('KST 자정 직후(UTC 전날 15:00 이후)도 다음 날로 넘어간다', () => {
    // 2026-08-23T15:30Z = 2026-08-24 00:30 KST → 다음 주(월 24일)
    expect(weekRange(Date.parse('2026-08-23T15:30:00Z'))).toEqual({ from: '2026-08-24', to: '2026-08-30' });
  });
});

describe('monthRange', () => {
  it('그 달 1일부터 말일까지', () => {
    expect(monthRange(MON)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });

  it('30일 달', () => {
    expect(monthRange(Date.parse('2026-09-10T03:00:00Z'))).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('2월(평년)', () => {
    expect(monthRange(Date.parse('2026-02-10T03:00:00Z'))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
});

describe('monthRangeOf — 달력 이동', () => {
  it('YYYY-MM을 받는다', () => {
    expect(monthRangeOf('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('12월 다음이 다음 해 1월로 넘어간다', () => {
    expect(monthRangeOf('2027-01')).toEqual({ from: '2027-01-01', to: '2027-01-31' });
  });

  it('형식이 틀리면 null — 임의의 달을 지어내지 않는다', () => {
    expect(monthRangeOf('2026-13')).toBeNull();
    expect(monthRangeOf('2026-00')).toBeNull();
    expect(monthRangeOf('nonsense')).toBeNull();
    expect(monthRangeOf('2026-1')).toBeNull();
  });
});

describe('datesIn / leadingBlanks', () => {
  it('주간은 7일', () => {
    expect(datesIn({ from: '2026-08-17', to: '2026-08-23' })).toHaveLength(7);
  });

  it('8월은 31일', () => {
    const days = datesIn({ from: '2026-08-01', to: '2026-08-31' });
    expect(days).toHaveLength(31);
    expect(days[0]).toBe('2026-08-01');
    expect(days[30]).toBe('2026-08-31');
  });

  it('거꾸로 된 범위는 빈 배열 — 달력이 무한 루프에 빠지지 않게', () => {
    expect(datesIn({ from: '2026-08-31', to: '2026-08-01' })).toEqual([]);
    expect(datesIn({ from: 'x', to: 'y' })).toEqual([]);
  });

  it('선행 빈칸은 1일의 요일로 정해진다 (월요일 시작)', () => {
    expect(leadingBlanks('2026-08-17')).toBe(0); // 월요일
    expect(leadingBlanks('2026-08-01')).toBe(5); // 토요일
    expect(leadingBlanks('2026-08-02')).toBe(6); // 일요일
  });
});
