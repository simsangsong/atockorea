/**
 * Opening hours (§5.7 R-4 openNowPenalty).
 *
 * The three failure modes worth pinning: an overnight period read from the
 * "next day" side, a 24 h place, and — most important — UNKNOWN staying null
 * instead of collapsing into "closed" (which would rank every un-matched Kakao
 * row off the card) or "open" (which would send a guest to a shut door).
 */

import { evaluateHours, kstWeekMinutes, normalizePeriods, servingHours, UNKNOWN_HOURS } from '@/lib/ops/dining/hours';

// KST = UTC+9. 2026-07-26 is a Sunday (Google day 0).
const SUN_1200 = Date.parse('2026-07-26T03:00:00Z');
const SUN_0030 = Date.parse('2026-07-25T15:30:00Z');
const SUN_2200 = Date.parse('2026-07-26T13:00:00Z');
const MON_1200 = Date.parse('2026-07-27T03:00:00Z');

const sundayLunch = { periods: [{ open: { day: 0, hour: 11, minute: 0 }, close: { day: 0, hour: 21, minute: 0 } }] };
const mondayOnly = { periods: [{ open: { day: 1, hour: 11, minute: 0 }, close: { day: 1, hour: 21, minute: 0 } }] };
const overnight = { periods: [{ open: { day: 6, hour: 18, minute: 0 }, close: { day: 0, hour: 2, minute: 0 } }] };
const allDay = { periods: [{ open: { day: 0, hour: 0, minute: 0 } }] };
const splitService = {
  periods: [
    { open: { day: 0, hour: 11, minute: 0 }, close: { day: 0, hour: 15, minute: 0 } },
    { open: { day: 0, hour: 17, minute: 0 }, close: { day: 0, hour: 21, minute: 30 } },
  ],
};

describe('kstWeekMinutes', () => {
  it('reads KST regardless of the host timezone', () => {
    expect(kstWeekMinutes(SUN_1200)).toEqual({ weekday: 0, minuteOfDay: 12 * 60 });
    expect(kstWeekMinutes(SUN_0030)).toEqual({ weekday: 0, minuteOfDay: 30 });
    expect(kstWeekMinutes(MON_1200)).toEqual({ weekday: 1, minuteOfDay: 12 * 60 });
  });
});

describe('normalizePeriods', () => {
  it('flags a close-less period as 24 h', () => {
    expect(normalizePeriods(allDay)).toBe('always');
  });

  it('returns null when there is nothing usable', () => {
    expect(normalizePeriods(null)).toBeNull();
    expect(normalizePeriods({ periods: [] })).toBeNull();
    expect(normalizePeriods({ periods: [{ open: { day: 9, hour: 3, minute: 0 } }] })).toBeNull();
  });

  it('unwraps an overnight period into a non-wrapping interval', () => {
    const periods = normalizePeriods(overnight);
    expect(Array.isArray(periods)).toBe(true);
    const [period] = periods as Array<{ start: number; end: number }>;
    expect(period.end).toBeGreaterThan(period.start);
  });
});

describe('evaluateHours', () => {
  it('reports the closing time while open', () => {
    expect(evaluateHours(sundayLunch, SUN_1200)).toEqual({
      openToday: true,
      closesAt: '21:00',
      closedAllDay: false,
      open24h: false,
    });
  });

  it('reads an overnight period from the next-day side', () => {
    // Saturday 18:00 → Sunday 02:00, evaluated at Sunday 00:30.
    expect(evaluateHours(overnight, SUN_0030)).toMatchObject({ openToday: true, closesAt: '02:00' });
  });

  it('handles a 24 h place', () => {
    expect(evaluateHours(allDay, SUN_1200)).toEqual({
      openToday: true,
      closesAt: null,
      closedAllDay: false,
      open24h: true,
    });
  });

  it('🔴 unknown stays null — never guessed either way', () => {
    expect(evaluateHours(null, SUN_1200)).toEqual(UNKNOWN_HOURS);
    expect(evaluateHours(undefined, SUN_1200)).toEqual(UNKNOWN_HOURS);
    expect(evaluateHours({}, SUN_1200)).toEqual(UNKNOWN_HOURS);
    expect(evaluateHours({ periods: [] }, SUN_1200).openToday).toBeNull();
  });

  it('reports closed when the day is not covered at all', () => {
    const result = evaluateHours(mondayOnly, SUN_1200);
    expect(result.openToday).toBe(false);
    expect(result.closesAt).toBeNull();
    expect(result.closedAllDay).toBe(true);
  });

  it('reports closed-right-now but not closed-all-day between two services', () => {
    const between = Date.parse('2026-07-26T07:00:00Z'); // 16:00 KST
    const result = evaluateHours(splitService, between);
    expect(result.openToday).toBe(false);
    expect(result.closedAllDay).toBe(false);
    // …and open again with the later closing time during the dinner service.
    expect(evaluateHours(splitService, Date.parse('2026-07-26T09:00:00Z')).closesAt).toBe('21:30');
  });

  it('is closed after the last service of the day', () => {
    expect(evaluateHours(sundayLunch, SUN_2200).openToday).toBe(false);
  });
});

describe('servingHours', () => {
  it('projects the card meta pair', () => {
    expect(servingHours(sundayLunch, SUN_1200)).toEqual({ open_today: true, closes_at: '21:00' });
    expect(servingHours(null, SUN_1200)).toEqual({ open_today: null, closes_at: null });
  });
});
