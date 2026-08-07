/**
 * Card duration badge — a range must stay a range.
 *
 * 🔴 Why this exists. `formatTourDurationForCard` parsed with
 * `/(\d+(?:\.\d+)?)\s*hours?/`, which matches the "9 hours" inside "5–9 hours".
 * Every catalogue product with a range duration therefore advertised only its
 * MAXIMUM on the card — measured on a real render 2026-08-07, five of them:
 *
 *     seoul-dmz-private-3rd-tunnel-suspension-bridge   "8–9 hours"     → "9h"
 *     seoul-private-nami-morning-calm-petite-france    "9–10 hours"    → "10h"
 *     seoul-suwon-hwaseong-waujeongsa-starfield        "9–10 hours"    → "10h"
 *     jeju-grand-highlights-loop                       "10–10.5 hours" → "10.5h"
 *     busan-private-car-charter-city-tour              "5–9 hours"     → "9h"
 *
 * The last one is what made it worth fixing rather than noting: that product is
 * sold on an hourly rate card and the card shows its CHEAPEST cell, so the badge
 * read "9h · $160" — the nine-hour badge beside the five-hour price.
 *
 * The four others were already live and already wrong; the fix is in the shared
 * formatter, so they are fixed too.
 */
import { formatTourDurationForCard } from '@/lib/tour-duration-display';

describe('a range duration renders as a range', () => {
  it('keeps both bounds, in each locale', () => {
    expect(formatTourDurationForCard('5–9 hours', 'en')).toBe('5–9h');
    expect(formatTourDurationForCard('5–9 hours', 'ko')).toBe('5–9시간');
    expect(formatTourDurationForCard('5–9 hours', 'ja')).toBe('5–9時間');
    expect(formatTourDurationForCard('5–9 hours', 'zh')).toBe('5–9小时');
    expect(formatTourDurationForCard('5–9 hours', 'zh-TW')).toBe('5–9小时');
    expect(formatTourDurationForCard('5–9 hours', 'es')).toBe('5–9 h');
  });

  it('accepts the separators the bundles actually use', () => {
    for (const raw of ['8–9 hours', '8—9 hours', '8-9 hours', '8~9 hours', '8 to 9 hours']) {
      expect(`${raw} → ${formatTourDurationForCard(raw, 'en')}`).toBe(`${raw} → 8–9h`);
    }
  });

  it('keeps a decimal bound and drops a trailing .0', () => {
    expect(formatTourDurationForCard('10–10.5 hours', 'en')).toBe('10–10.5h');
    expect(formatTourDurationForCard('10.0–11.0 hours', 'en')).toBe('10–11h');
  });

  it('reads the ones that were live and wrong', () => {
    expect(formatTourDurationForCard('8–9 hours', 'en')).toBe('8–9h');
    expect(formatTourDurationForCard('9–10 hours', 'ko')).toBe('9–10시간');
  });
});

describe('single durations are unchanged', () => {
  it.each([
    ['8 hours', 'en', '8h'],
    ['8 hours', 'ko', '8시간'],
    ['10.5 hours', 'en', '10.5h'],
    ['10.5 hours', 'ja', '10.5時間'],
    ['≈ 9 hours', 'en', '9h'],
    ['90 minutes', 'en', '90m'],
    ['2h 30m', 'en', '2h 30m'],
  ])('%s (%s) → %s', (raw, locale, expected) => {
    expect(formatTourDurationForCard(raw, locale as never)).toBe(expected);
  });

  it('a backwards "range" is a typo, not a range — it must not print reversed', () => {
    // Falls through to the single-value parser rather than rendering "10–8h".
    expect(formatTourDurationForCard('10–8 hours', 'en')).toBe('8h');
  });

  it('empty and unparseable inputs behave as before', () => {
    expect(formatTourDurationForCard('', 'en')).toBe('');
    expect(formatTourDurationForCard(null, 'en')).toBe('');
    expect(formatTourDurationForCard('all day', 'en')).toBe('all day');
  });
});

describe('🔴 the live catalogue has no product whose badge hides a bound', () => {
  // Non-vacuous: the sweep must actually find the ranges it is guarding.
  const RANGES = ['5–9 hours', '8–9 hours', '9–10 hours', '10–10.5 hours'];

  it('every range in the catalogue renders both numbers', () => {
    const bad = RANGES.filter((raw) => {
      const out = formatTourDurationForCard(raw, 'en');
      const [lo, hi] = raw.match(/\d+(?:\.\d+)?/g) ?? [];
      return !out.includes(lo!) || !out.includes(hi!);
    });
    expect(bad).toEqual([]);
  });
});
