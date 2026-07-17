/**
 * T0.7 — KST time helpers (fixes live defect R-7: UTC todayYmd hid today's
 * tour between 00:00 and 09:00 KST).
 */
import {
  kstEndOfDayMs,
  kstStartOfDayMs,
  kstToday,
  roomLifecycle,
  roomShouldBeClosed,
} from '@/lib/tour-room/time';

describe('lib/tour-room/time', () => {
  describe('kstToday', () => {
    it('rolls the date at KST midnight, not UTC midnight', () => {
      // 2026-07-13 16:00 UTC == 2026-07-14 01:00 KST → KST already on the 14th.
      const oneAmKst = Date.UTC(2026, 6, 13, 16, 0, 0);
      expect(kstToday(oneAmKst)).toBe('2026-07-14');
      // The regression scenario: 2026-07-14 08:59 KST (23:59 UTC on the 13th).
      const earlyMorningKst = Date.UTC(2026, 6, 13, 23, 59, 0);
      expect(kstToday(earlyMorningKst)).toBe('2026-07-14');
      // And plain midday agreement.
      const middayKst = Date.UTC(2026, 6, 14, 3, 0, 0);
      expect(kstToday(middayKst)).toBe('2026-07-14');
    });
  });

  describe('day bounds', () => {
    it('start/end of day are KST-anchored', () => {
      expect(kstStartOfDayMs('2026-07-14')).toBe(Date.UTC(2026, 6, 13, 15, 0, 0));
      expect(kstEndOfDayMs('2026-07-14')).toBe(Date.UTC(2026, 6, 14, 14, 59, 59, 999));
    });
    it('rejects malformed dates', () => {
      expect(() => kstStartOfDayMs('2026/07/14')).toThrow();
      expect(() => kstStartOfDayMs('')).toThrow();
    });
  });

  describe('roomLifecycle (§O-1 ⑥ — lobby / live / ended, no error state)', () => {
    const tourDate = '2026-07-14';
    it('is lobby before the tour day (KST)', () => {
      expect(roomLifecycle(tourDate, Date.UTC(2026, 6, 13, 14, 59, 59))).toBe('lobby');
    });
    it('is live from KST midnight through tour day + 24h grace', () => {
      expect(roomLifecycle(tourDate, Date.UTC(2026, 6, 13, 15, 0, 0))).toBe('live');
      expect(roomLifecycle(tourDate, Date.UTC(2026, 6, 14, 10, 0, 0))).toBe('live');
      // grace: 2026-07-15 23:59:59.999 KST is the last live moment
      expect(roomLifecycle(tourDate, Date.UTC(2026, 6, 15, 14, 59, 59, 999))).toBe('live');
    });
    it('is ended after the grace window, which also drives auto-close (R-19)', () => {
      const afterGrace = Date.UTC(2026, 6, 15, 15, 0, 0);
      expect(roomLifecycle(tourDate, afterGrace)).toBe('ended');
      expect(roomShouldBeClosed(tourDate, afterGrace)).toBe(true);
      expect(roomShouldBeClosed(tourDate, Date.UTC(2026, 6, 14, 10, 0, 0))).toBe(false);
    });
    it('treats missing tour dates as live (legacy rows)', () => {
      expect(roomLifecycle(null)).toBe('live');
      expect(roomLifecycle(undefined)).toBe('live');
    });
  });
});

describe('inPostTourWindow (P-D12, W4.4)', () => {
  const { inPostTourWindow, kstEndOfDayMs, POST_TOUR_WINDOW_MS } = jest.requireActual('@/lib/tour-room/time');
  const date = '2026-08-10';
  const dayEnd = kstEndOfDayMs(date);

  it('opens after tour-day end and closes at +48h', () => {
    expect(inPostTourWindow(date, dayEnd - 1000)).toBe(false); // still tour day
    expect(inPostTourWindow(date, dayEnd + 1000)).toBe(true); // grace overlap
    expect(inPostTourWindow(date, dayEnd + POST_TOUR_WINDOW_MS - 1000)).toBe(true);
    expect(inPostTourWindow(date, dayEnd + POST_TOUR_WINDOW_MS + 1000)).toBe(false);
  });

  it('is false without a tour date', () => {
    expect(inPostTourWindow(null, dayEnd)).toBe(false);
  });
});
