/**
 * T1-1 — driver overtime arithmetic (base hours per city + ₩30,000/h cash).
 */
import {
  baseHoursForCity,
  computeOvertime,
  overtimeAmount,
  minutesBetween,
  parseHm,
  OVERTIME_RATE_KRW_PER_HOUR,
  DEFAULT_BASE_HOURS,
} from '@/lib/tour-room/overtime';

describe('baseHoursForCity', () => {
  it('is 9 for Jeju, 8 for Busan, default otherwise', () => {
    expect(baseHoursForCity('Jeju')).toBe(9);
    expect(baseHoursForCity('제주')).toBe(9);
    expect(baseHoursForCity('Busan')).toBe(8);
    expect(baseHoursForCity('부산')).toBe(8);
    expect(baseHoursForCity('Seoul')).toBe(DEFAULT_BASE_HOURS);
    expect(baseHoursForCity(null)).toBe(DEFAULT_BASE_HOURS);
  });
});

describe('parseHm / minutesBetween', () => {
  it('parses HH:MM and rejects malformed', () => {
    expect(parseHm('09:00')).toBe(540);
    expect(parseHm('9:5')).toBeNull();
    expect(parseHm('25:00')).toBeNull();
    expect(parseHm('')).toBeNull();
  });
  it('clamps a non-positive span to 0', () => {
    expect(minutesBetween('09:00', '18:30')).toBe(570);
    expect(minutesBetween('18:00', '09:00')).toBe(0);
    expect(minutesBetween('09:00', undefined)).toBeNull();
  });
});

describe('computeOvertime', () => {
  it('bills nothing within the base hours', () => {
    // Jeju 9h base, worked 9h exactly.
    expect(computeOvertime(9, '09:00', '18:00')).toMatchObject({ overtimeHours: 0, amountKrw: 0 });
  });
  it('bills rounded half-hours beyond base at the fixed rate', () => {
    // Busan 8h base, worked 10h15m → 2.25h over → rounds to 2.5h → ₩75,000.
    const r = computeOvertime(8, '09:00', '19:15');
    expect(r.workedMinutes).toBe(615);
    expect(r.overtimeHours).toBe(2.5);
    expect(r.amountKrw).toBe(75000);
  });
  it('returns zero when the times are missing', () => {
    expect(computeOvertime(9, '09:00', null)).toMatchObject({ workedMinutes: null, overtimeHours: 0, amountKrw: 0 });
  });
});

describe('overtimeAmount', () => {
  it('is hours × the hourly rate, never negative', () => {
    expect(overtimeAmount(1.5)).toBe(45000);
    expect(overtimeAmount(0)).toBe(0);
    expect(overtimeAmount(-2)).toBe(0);
    expect(OVERTIME_RATE_KRW_PER_HOUR).toBe(30000);
  });
});
