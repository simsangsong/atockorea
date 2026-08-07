/**
 * Departure weekdays for products that only run on fixed days of the week.
 *
 * Several Seoul-area day tours share one vehicle and guide by splitting the
 * week between them, so each package departs on three fixed weekdays. A date
 * off those weekdays is not "sold out" — the tour does not run at all.
 *
 * 🔴 This lives in code, not in `product_inventory`, and that is deliberate.
 * `product_inventory.merchant_id` is NOT NULL with a foreign key to
 * `merchants`, and `merchants` has zero rows — so no inventory row can be
 * inserted for any tour today. The seeding script
 * (`scripts/tours/set-departure-days.ts`) is kept for the day merchants exist,
 * but it cannot be what enforces a schedule now. Populating inventory would
 * also cut against the standing decision that AtoC tours are on-demand and
 * `product_inventory` stays empty.
 *
 * Same shape and same reasoning as `lib/tour-seasonal-windows.ts`: a recurring
 * calendar rule that belongs to the product, edited as a literal here, read by
 * every surface that decides whether a date is bookable. All three must read
 * it — greying a date in the calendar while the booking route still accepts it
 * is worse than not greying it at all.
 */

export type DepartureDays = {
  /** Weekdays the tour departs, 0=Sun … 6=Sat. */
  weekdays: number[];
  /** Short human label for the API `reason` field ("Tue, Thu, Sat"). */
  label: string;
};

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Source: the operator's own Klook calendars, read 2026-08-04 and recorded in
 * `docs/NEXT-SESSION-VIDEO-GUIDE-JEJU-2026-08-04.md` §11 / §12.
 */
const TOUR_DEPARTURE_DAYS: Record<string, DepartureDays> = {
  // The three Suwon packages rotate one vehicle across the week.
  //
  // 🔴 Before opening any of these: their bundles carry no `departureWeekdays`,
  // so the booking calendar will NOT grey the dead dates — only this table will
  // reject them, at submit. Verified 2026-08-07: all three are is_active=false
  // with zero published locales, which is the only reason that is not a live
  // defect today. Pocheon has the field in all ten bundles; copy that shape
  // across before flipping these on, or a guest picks Wednesday, fills the
  // form, and learns at the last step that the tour never runs.
  'seoul-suwon-hwaseong-waujeongsa-starfield': {
    weekdays: [2, 4, 6],
    label: 'Tue, Thu, Sat',
  },
  'seoul-suwon-hwaseong-folk-village-starfield-library': {
    weekdays: [1, 4, 6],
    label: 'Mon, Thu, Sat',
  },
  'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library': {
    weekdays: [0, 3, 5],
    label: 'Sun, Wed, Fri',
  },
  // Pocheon/Yeoncheon Hantangang geopark day trip — the Jaein Falls product.
  // The slug still says herb-island because it is the live Klook SKU; the
  // 2026-08-04 re-course swapped the stop, not the URL.
  'pocheon-sanjeong-lake-herb-island-art-valley': {
    weekdays: [1, 4, 6],
    label: 'Mon, Thu, Sat',
  },
};

export function getDepartureDays(slug: string | null | undefined): DepartureDays | null {
  if (!slug) return null;
  return TOUR_DEPARTURE_DAYS[slug] ?? null;
}

/**
 * Weekday of a "YYYY-MM-DD" string, 0=Sun … 6=Sat, or null if unparseable.
 *
 * Derived from the string rather than a local `Date`, because the callers sit
 * on a server whose timezone is not the guest's and not Seoul's. Appending an
 * explicit `T00:00:00Z` pins the instant so the same date string always yields
 * the same weekday wherever this runs.
 */
export function weekdayOfDateString(dateString: string | null | undefined): number | null {
  if (!dateString || dateString.length < 10) return null;
  const ymd = dateString.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const day = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return Number.isNaN(day) ? null : day;
}

/** True when the slug has a departure schedule and `dateString` is not one of its days. */
export function isDateOffDepartureDay(
  slug: string | null | undefined,
  dateString: string | null | undefined,
): boolean {
  const schedule = getDepartureDays(slug);
  if (!schedule) return false;
  const weekday = weekdayOfDateString(dateString);
  // An unparseable date is not evidence that the tour does not run; leave that
  // to the caller's own date validation rather than closing the day here.
  if (weekday == null) return false;
  return !schedule.weekdays.includes(weekday);
}

/** The guest-facing sentence for a date the tour does not depart on. */
export function departureDayReason(slug: string | null | undefined): string | null {
  const schedule = getDepartureDays(slug);
  if (!schedule) return null;
  return `This tour departs on ${schedule.label} only.`;
}

export { WEEKDAY_NAMES };
