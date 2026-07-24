/**
 * T1-1 / D5 — driver overtime arithmetic: base hours per city, per-city rate
 * (Jeju ₩30,000/h · Busan ₩40,000/h), and a 20-minute free grace.
 */
import {
  baseHoursForCity,
  rateForCity,
  computeOvertime,
  overtimeAmount,
  minutesBetween,
  parseHm,
  OVERTIME_RATE_KRW_PER_HOUR,
  OVERTIME_GRACE_MINUTES,
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

describe('rateForCity', () => {
  it('is ₩30,000 for Jeju, ₩40,000 for Busan, and the flat fallback otherwise', () => {
    expect(rateForCity('Jeju')).toBe(30000);
    expect(rateForCity('제주')).toBe(30000);
    expect(rateForCity('Busan')).toBe(40000);
    expect(rateForCity('부산')).toBe(40000);
    expect(rateForCity('Seoul')).toBe(OVERTIME_RATE_KRW_PER_HOUR);
    expect(rateForCity('Seoul')).toBe(30000);
    expect(rateForCity(null)).toBe(OVERTIME_RATE_KRW_PER_HOUR);
    expect(rateForCity(undefined)).toBe(OVERTIME_RATE_KRW_PER_HOUR);
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

describe('computeOvertime — grace + per-city rate', () => {
  it('exposes a 20-minute grace constant', () => {
    expect(OVERTIME_GRACE_MINUTES).toBe(20);
  });

  it('bills nothing within the base hours', () => {
    // Jeju 9h base, worked 9h exactly.
    expect(computeOvertime(9, '09:00', '18:00', { city: 'Jeju' })).toMatchObject({
      rawOvertimeMinutes: 0,
      overtimeHours: 0,
      amountKrw: 0,
    });
  });

  it('bills nothing when overtime is exactly the 20-minute grace', () => {
    // Jeju 9h base, worked 9h20m → 20 min raw OT → all grace → ₩0.
    const r = computeOvertime(9, '09:00', '18:20', { city: 'Jeju' });
    expect(r.rawOvertimeMinutes).toBe(20);
    expect(r.overtimeHours).toBe(0);
    expect(r.amountKrw).toBe(0);
  });

  it('subtracts the grace then bills the remainder — 50 min OT ⇒ 0.5h', () => {
    // Jeju 9h base, worked 9h50m → 50 min raw → 30 billable → 0.5h → ₩15,000.
    const jeju = computeOvertime(9, '09:00', '18:50', { city: 'Jeju' });
    expect(jeju.rawOvertimeMinutes).toBe(50);
    expect(jeju.overtimeHours).toBe(0.5);
    expect(jeju.amountKrw).toBe(15000);

    // Busan 8h base, worked 8h50m → 50 min raw → 30 billable → 0.5h → ₩20,000.
    const busan = computeOvertime(8, '09:00', '17:50', { city: 'Busan' });
    expect(busan.rawOvertimeMinutes).toBe(50);
    expect(busan.overtimeHours).toBe(0.5);
    expect(busan.amountKrw).toBe(20000);
  });

  it('applies the per-city rate to large overtime (Busan ₩40,000/h)', () => {
    // Busan 8h base, worked 11h → 180 min raw → 160 billable → 2.667h → 2.5h → ₩100,000.
    const r = computeOvertime(8, '09:00', '20:00', { city: 'Busan' });
    expect(r.workedMinutes).toBe(660);
    expect(r.rawOvertimeMinutes).toBe(180);
    expect(r.overtimeHours).toBe(2.5);
    expect(r.amountKrw).toBe(100000);
  });

  it('rounds billable half-hours (grace-applied) at the default rate when no city is given', () => {
    // Busan 8h base, worked 10h15m → 135 min raw → 115 billable → 1.917h → 2.0h.
    // Default rate ₩30,000 (no city) → ₩60,000.
    const r = computeOvertime(8, '09:00', '19:15');
    expect(r.workedMinutes).toBe(615);
    expect(r.rawOvertimeMinutes).toBe(135);
    expect(r.overtimeHours).toBe(2.0);
    expect(r.amountKrw).toBe(60000);
  });

  it('returns zero when the times are missing', () => {
    expect(computeOvertime(9, '09:00', null)).toMatchObject({
      workedMinutes: null,
      rawOvertimeMinutes: 0,
      overtimeHours: 0,
      amountKrw: 0,
    });
  });
});

describe('overtimeAmount', () => {
  it('is hours × the given rate, never negative', () => {
    expect(overtimeAmount(1.5)).toBe(45000); // default 30k rate
    expect(overtimeAmount(1.5, 40000)).toBe(60000);
    expect(overtimeAmount(0)).toBe(0);
    expect(overtimeAmount(-2, 40000)).toBe(0);
    expect(OVERTIME_RATE_KRW_PER_HOUR).toBe(30000);
  });
});
