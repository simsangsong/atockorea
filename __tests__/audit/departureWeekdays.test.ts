/**
 * Standing gate — a fixed-schedule departure must be ENFORCED, not just described.
 *
 * 🔴 Why this file exists.
 *
 * The owner's Klook calendar says Pocheon runs Monday / Thursday / Saturday only.
 * That fact was shipped in ten locales as a card badge, a "Departure days"
 * accordion, an FAQ, a `lessIdealFor` line, and
 * `matching_profile.available_days_signature`.
 *
 * Every one of those is prose or recommender input. A grep for consumers of
 * `available_days_signature` in app/, lib/ and components/ returned ZERO. So the
 * booking date picker accepted any date, and a guest who picked a Tuesday met the
 * constraint at checkout, or not at all — which is exactly the failure the copy
 * was written to prevent.
 *
 * This repo's dominant defect is not "building the thing", it is "nothing reads
 * the thing". So the assertions below pin the READ, not the declaration:
 * `departureWeekdays` must survive from bundle → view model → both booking
 * surfaces, and the filter must actually reject a non-departure day.
 *
 * `matching_profile` is deliberately NOT the source. segments.ts marks it
 * FORBIDDEN — recommender input, never translated, absent from the view model —
 * so the guest-facing picker must not couple to it.
 */
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { isDepartureWeekday } from '@/components/product-tour-static/_shared/bookingShared';
import { TOUR_PRODUCT_VIEW_MODEL_KEYS } from '@/components/product-tour-static/_shared/tourProductFullPageJsonTypes';
import { DEPARTURE_SCHEDULE_SLUGS, getDepartureDays } from '@/lib/tour-departure-days';

const POCHEON = 'pocheon-sanjeong-lake-herb-island-art-valley';
const BUNDLE_DIR = path.join(process.cwd(), 'components/product-tour-static', POCHEON);
const SECTIONS = path.join(
  process.cwd(),
  'components/product-tour-static/east-signature-nature-core/tour-detail-sections',
);

/** 2026: Aug 3 Mon, Aug 4 Tue, Aug 6 Thu, Aug 8 Sat, Aug 10 Mon. */
const MON = new Date(2026, 7, 3);
const TUE = new Date(2026, 7, 4);
const WED = new Date(2026, 7, 5);
const THU = new Date(2026, 7, 6);
const SAT = new Date(2026, 7, 8);
const SUN = new Date(2026, 7, 9);
const MTS = ['monday', 'thursday', 'saturday'];

describe('departure-day filter', () => {
  it('accepts the three departure days and rejects the rest', () => {
    for (const d of [MON, THU, SAT]) expect(isDepartureWeekday(d, MTS)).toBe(true);
    for (const d of [TUE, WED, SUN]) expect(isDepartureWeekday(d, MTS)).toBe(false);
  });

  it('treats absent/empty as "runs any day" — every other tour is on-demand daily', () => {
    for (const d of [MON, TUE, WED, THU, SAT, SUN]) {
      expect(isDepartureWeekday(d, undefined)).toBe(true);
      expect(isDepartureWeekday(d, [])).toBe(true);
    }
  });

  it('is not fooled by casing or padding in authored data', () => {
    expect(isDepartureWeekday(THU, [' Thursday '])).toBe(true);
    expect(isDepartureWeekday(TUE, ['Thursday'])).toBe(false);
  });
});

describe('the Pocheon bundles declare it', () => {
  const files = readdirSync(BUNDLE_DIR).filter((f) => f.endsWith('.json'));

  it('scanned all ten locales', () => {
    expect(files.length).toBe(10);
  });

  it.each(readdirSync(BUNDLE_DIR).filter((f) => f.endsWith('.json')))(
    '%s carries the Mon/Thu/Sat keys, untranslated',
    (file) => {
      const doc = JSON.parse(readFileSync(path.join(BUNDLE_DIR, file), 'utf8'));
      expect(doc.departureWeekdays).toEqual(MTS);
    },
  );

  it('agrees with the recommender signature it was derived from', () => {
    const en = JSON.parse(readFileSync(path.join(BUNDLE_DIR, `${POCHEON}.en.json`), 'utf8'));
    expect([...(en.matching_profile?.available_days_signature ?? [])].sort()).toEqual(
      [...MTS].sort(),
    );
  });
});

/**
 * 🔴 Generalised 2026-08-07, when the three Suwon packages were re-opened.
 *
 * Until then this file only knew about Pocheon, and the Suwon three sat in
 * `lib/tour-departure-days.ts` with NO `departureWeekdays` in any of their six
 * bundles. That was survivable only because they were blocked and inactive —
 * the moment they went on sale, their booking calendar would have offered every
 * day of the week and the table would have rejected the choice at submit.
 *
 * A gate that only covers the product someone remembered to add to it is how
 * that happened. So walk the schedule table itself: every slug in it, every
 * bundle it has, must agree. Adding a fourth scheduled product with missing or
 * wrong bundle keys now fails here instead of at a guest's checkout.
 */
describe('every fixed-schedule product declares it in every bundle', () => {
  /** `Date.getDay()` order — the index IS the weekday number in the table. */
  const FULL_NAMES = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const STATIC_ROOT = path.join(process.cwd(), 'components/product-tour-static');

  const cases = DEPARTURE_SCHEDULE_SLUGS.flatMap((slug) =>
    readdirSync(path.join(STATIC_ROOT, slug))
      .filter((f) => f.endsWith('.json'))
      .map((file) => [slug, file] as [string, string]),
  );

  it('the table is non-empty and every slug in it has bundles on disk', () => {
    expect(DEPARTURE_SCHEDULE_SLUGS.length).toBeGreaterThan(0);
    for (const slug of DEPARTURE_SCHEDULE_SLUGS) {
      expect(cases.filter(([s]) => s === slug)).not.toHaveLength(0);
    }
  });

  it.each(cases)('%s / %s matches the schedule table', (slug, file) => {
    const doc = JSON.parse(readFileSync(path.join(STATIC_ROOT, slug, file), 'utf8'));
    const expected = getDepartureDays(slug)!.weekdays.map((n) => FULL_NAMES[n]);
    expect(doc.departureWeekdays).toEqual(expected);
  });
});

describe('something actually reads it', () => {
  // 🔴 The whole point. A declared field with no consumer is the defect.
  it('is a recognised view-model pass-through key', () => {
    expect(TOUR_PRODUCT_VIEW_MODEL_KEYS).toContain('departureWeekdays');
  });

  it('is overlaid onto the view model by the page body', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'app/(marketing)/tour-product/[slug]/tourProductPageBody.tsx'),
      'utf8',
    );
    // Slice to the array's real end, not a guessed character count — the first
    // draft used +400 and failed the moment a comment was added inside it.
    const start = src.indexOf('const extensions');
    expect(start).toBeGreaterThan(-1);
    const extensions = src.slice(start, src.indexOf('];', start));
    expect(extensions).toContain('departureWeekdays');
  });

  it.each(['TourDesktopBookingCard', 'TourStickyBookingBar'])(
    '%s filters its date picker on it',
    (component) => {
      const src = readFileSync(path.join(SECTIONS, `${component}.tsx`), 'utf8');
      expect(src).toContain('isDepartureWeekday');
      // the prop has to reach the filter, not merely be declared
      expect(src).toMatch(/filterDate=\{[\s\S]{0,220}isDepartureWeekday\(date, departureWeekdays\)/);
    },
  );

  it('never sources the picker from the FORBIDDEN recommender block', () => {
    for (const component of ['TourDesktopBookingCard', 'TourStickyBookingBar']) {
      const src = readFileSync(path.join(SECTIONS, `${component}.tsx`), 'utf8');
      expect(src).not.toContain('available_days_signature');
    }
  });
});
