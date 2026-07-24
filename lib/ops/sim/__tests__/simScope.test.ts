/**
 * A0.1 — 시뮬 격리 판정.
 *
 * 이 스위트가 지키는 계약:
 *   1. 실 예약은 어떤 경로로도 시뮬로 오판되지 않는다 (오판 = 매출 실종).
 *   2. 태그 없는 레거시 시뮬 행도 잡힌다 (누락 = 법인 원장 오염).
 *   3. 시뮬 예약을 뺄 때 그 예약의 파생 행(룸)도 함께 뺄 수 있다.
 */

import { SIM_TAG, dropSimBookings, isSimBooking, simBookingIds } from '../simScope';

const real = { id: 'r1', sim_tag: null, contact_email: 'massimo@example.com' };
const realNoEmail = { id: 'r2', sim_tag: null, contact_email: null };
const tagged = { id: 's1', sim_tag: SIM_TAG, contact_email: 'sim-tour-mode@atockorea.test' };
const legacy = { id: 's2', sim_tag: null, contact_email: 'sim-tour-mode@atockorea.test' };
const legacyAdmin = { id: 's3', sim_tag: null, contact_email: 'sim-tour-ops-admin@atockorea.test' };

describe('isSimBooking', () => {
  it('실 예약은 시뮬이 아니다', () => {
    expect(isSimBooking(real)).toBe(false);
    expect(isSimBooking(realNoEmail)).toBe(false);
  });

  it('태그가 있으면 시뮬이다', () => {
    expect(isSimBooking(tagged)).toBe(true);
    // 시더는 'sim'만 쓰지만 판정은 값을 가리지 않는다.
    expect(isSimBooking({ sim_tag: 'e2e' })).toBe(true);
  });

  it('컬럼이 생기기 전 시더가 남긴 행도 주소로 잡는다', () => {
    expect(isSimBooking(legacy)).toBe(true);
    expect(isSimBooking(legacyAdmin)).toBe(true);
  });

  it('대소문자·공백은 판정을 바꾸지 않는다', () => {
    expect(isSimBooking({ contact_email: '  SIM-TOUR-MODE@ATOCKOREA.TEST ' })).toBe(true);
  });

  it('빈 태그는 태그가 아니다 — 빈 문자열로 실 예약을 시뮬 취급하지 않는다', () => {
    expect(isSimBooking({ sim_tag: '', contact_email: 'guest@example.com' })).toBe(false);
    expect(isSimBooking({ sim_tag: '   ', contact_email: 'guest@example.com' })).toBe(false);
  });

  it('null·undefined 행은 시뮬이 아니다', () => {
    expect(isSimBooking(null)).toBe(false);
    expect(isSimBooking(undefined)).toBe(false);
    expect(isSimBooking({})).toBe(false);
  });

  it('비슷하지만 다른 주소를 시뮬로 잡지 않는다 — 오판은 실 매출을 지운다', () => {
    expect(isSimBooking({ contact_email: 'sim-tour-mode@atockorea.com' })).toBe(false);
    expect(isSimBooking({ contact_email: 'notsim-tour-mode@atockorea.test' })).toBe(false);
    expect(isSimBooking({ contact_email: 'simon@atockorea.test' })).toBe(false);
  });
});

describe('dropSimBookings / simBookingIds', () => {
  const rows = [real, tagged, legacy, realNoEmail, legacyAdmin];

  it('실 예약만 남긴다', () => {
    expect(dropSimBookings(rows).map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('빠진 것들의 id 집합을 준다 — 룸·좌석을 같이 떨어뜨리기 위해서다', () => {
    const ids = simBookingIds(rows);
    expect([...ids].sort()).toEqual(['s1', 's2', 's3']);
    expect(ids.has('r1')).toBe(false);
  });

  it('시뮬이 없으면 원본 그대로다', () => {
    expect(dropSimBookings([real, realNoEmail])).toHaveLength(2);
    expect(simBookingIds([real, realNoEmail]).size).toBe(0);
  });

  it('빈 입력에서 터지지 않는다', () => {
    expect(dropSimBookings([])).toEqual([]);
    expect(simBookingIds([]).size).toBe(0);
  });
});
