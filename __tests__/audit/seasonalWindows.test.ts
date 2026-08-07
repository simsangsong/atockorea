/**
 * Standing gate — a season-locked tour must be refused everywhere, not in one route.
 *
 * 🔴 Why this file exists.
 *
 * `lib/tour-seasonal-windows.ts` shipped with exactly one caller:
 * `app/api/tours/[id]/availability/route.ts`, the single-date check. The
 * calendar is painted by `availability/range`, and a booking row is written by
 * `app/api/bookings`, and the chatbot answers from `lib/agent/availability.ts`
 * — none of those read it. So an out-of-season date rendered as bookable, the
 * create route accepted it, and the chatbot quoted it.
 *
 * Nothing caught this because all four season-locked products happened to be
 * inactive. Compare `isDateOffDepartureDay`, which had all four callers from
 * the start and is the same kind of rule. This is the repo's dominant defect
 * shape — the thing exists, and not enough code reads it — so the assertions
 * below pin the READ.
 */
import { readFileSync } from 'fs';
import path from 'path';
import {
  getSeasonalOperatingWindow,
  isDateOutsideSeasonalWindow,
  seasonalWindowReason,
} from '@/lib/tour-seasonal-windows';

const WINTER = 'seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour';

/** Every surface that decides whether a date can be booked. */
const CONSUMERS = [
  'app/api/tours/[id]/availability/route.ts',
  'app/api/tours/[id]/availability/range/route.ts',
  'app/api/bookings/route.ts',
  'lib/agent/availability.ts',
];

describe('every booking-decision surface reads the seasonal window', () => {
  it.each(CONSUMERS)('%s calls isDateOutsideSeasonalWindow', (rel) => {
    const src = readFileSync(path.join(process.cwd(), rel), 'utf8');
    expect(src).toContain('isDateOutsideSeasonalWindow');
    // Imported AND called — an unused import would satisfy a bare `toContain`.
    expect(src).toMatch(/isDateOutsideSeasonalWindow\s*\(/);
  });

  it('the same four read the departure-weekday rule, which is the precedent', () => {
    for (const rel of CONSUMERS) {
      const src = readFileSync(path.join(process.cwd(), rel), 'utf8');
      expect(src).toMatch(/isDateOffDepartureDay\s*\(/);
    }
  });
});

describe('the winter Eobi window', () => {
  // Listing title: "[Winter Special: Dec/20~Feb/28]" (owner screenshots
  // 2026-08-07, Dec 2026 + Feb 2027 calendars).
  it('is 12-20 → 02-28 and wraps the year end', () => {
    const win = getSeasonalOperatingWindow(WINTER);
    expect(win).not.toBeNull();
    expect(win!.startMonthDay).toBe('12-20');
    expect(win!.endMonthDay).toBe('02-28');
    expect(win!.startMonthDay > win!.endMonthDay).toBe(true); // wrap-around
  });

  it.each([
    ['2026-12-20', false], // first day, inclusive
    ['2026-12-25', false],
    ['2026-12-30', false],
    ['2027-01-15', false], // deep in the wrapped tail
    ['2027-02-26', false],
    ['2027-02-28', false], // last day, inclusive
    ['2026-12-19', true], // day before opening
    ['2027-03-01', true], // day after closing
    ['2026-07-15', true], // high summer
    ['2026-11-30', true], // November — the season has NOT opened yet
  ])('%s outside=%s', (date, expected) => {
    expect(isDateOutsideSeasonalWindow(WINTER, date)).toBe(expected);
  });

  it('states the window in the guest-facing reason', () => {
    const reason = seasonalWindowReason(WINTER);
    expect(reason).toContain('12-20');
    expect(reason).toContain('02-28');
  });

  it('leaves unlisted slugs alone — absence means "runs all year"', () => {
    expect(getSeasonalOperatingWindow('seoul-gapyeong-nami-morning-calm-petite-france-day-tour')).toBeNull();
    expect(isDateOutsideSeasonalWindow('seoul-gapyeong-nami-morning-calm-petite-france-day-tour', '2026-07-15')).toBe(false);
    expect(seasonalWindowReason('seoul-gapyeong-nami-morning-calm-petite-france-day-tour')).toBeNull();
  });
});
