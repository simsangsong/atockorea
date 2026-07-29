/**
 * N2 — the day's arc.
 *
 * §N-5's diagnosis was that morning, midday, dusk and ended are "the same
 * screen". The now card says WHAT; this makes the surface say WHEN.
 *
 * The tests that matter here are the boundaries and the override, because both
 * are the kind of thing that looks right in the one hour you happen to test it.
 */
import { dayPhase, kstHour } from '@/lib/tour-room/dayPhase';

/** A UTC instant for a given KST hour on a fixed day. */
const atKst = (hour: number) => Date.UTC(2026, 7, 4, hour - 9, 0, 0);

describe('kstHour', () => {
  it('shifts UTC by nine with no DST to worry about', () => {
    expect(kstHour(Date.UTC(2026, 7, 4, 0, 0, 0))).toBe(9);
    expect(kstHour(Date.UTC(2026, 7, 4, 20, 0, 0))).toBe(5);
    expect(kstHour(Date.UTC(2026, 0, 15, 0, 0, 0))).toBe(9);
  });
});

describe('dayPhase', () => {
  it('walks the operating day', () => {
    const seen = [5, 7, 9, 10, 13, 15, 16, 18, 21, 23, 2, 4].map((h) => [
      h,
      dayPhase({ nowMs: atKst(h) }),
    ]);
    expect(seen).toEqual([
      [5, 'morning'],
      [7, 'morning'],
      [9, 'morning'],
      [10, 'day'],
      [13, 'day'],
      [15, 'day'],
      [16, 'dusk'],
      [18, 'dusk'],
      [21, 'dusk'],
      [23, 'dusk'],
      [2, 'dusk'],
      [4, 'dusk'],
    ]);
  });

  it('🔴 ended comes from the lifecycle, never from the clock', () => {
    // A tour that finished early is over at 2pm. A card that stayed bright
    // until sunset would be telling the guest the day is still running.
    for (const h of [5, 11, 14, 18, 23]) {
      expect({ h, phase: dayPhase({ lifecycle: 'ended', nowMs: atKst(h) }) }).toEqual({
        h,
        phase: 'ended',
      });
    }
  });

  it('leaves lobby and live to the clock', () => {
    expect(dayPhase({ lifecycle: 'lobby', nowMs: atKst(7) })).toBe('morning');
    expect(dayPhase({ lifecycle: 'live', nowMs: atKst(17) })).toBe('dusk');
  });

  it('has a neutral phase, and it is a real one', () => {
    // If every hour were tinted, none of the tints would mean anything. The
    // middle of a tour is deliberately not decorated.
    expect(dayPhase({ nowMs: atKst(12) })).toBe('day');
  });

  it('returns one of exactly four values, always', () => {
    const seen = new Set<string>();
    for (let h = 0; h < 24; h += 1) seen.add(dayPhase({ nowMs: atKst(h) }));
    seen.add(dayPhase({ lifecycle: 'ended' }));
    expect([...seen].sort()).toEqual(['day', 'dusk', 'ended', 'morning']);
  });
});
