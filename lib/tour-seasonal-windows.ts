/**
 * Seasonal operating windows for season-locked tour products.
 *
 * Used by `app/api/tours/[id]/availability/route.ts` to block booking dates
 * that fall outside a product's recurring annual operating window.
 *
 * Windows are MM-DD only — they recur every year. If a tour's window shifts
 * (e.g. climate-shifted bloom), update the literal here; no DB change needed.
 */

type MonthDay = `${string}-${string}`; // "MM-DD"

export type SeasonalOperatingWindow = {
  /** Inclusive start in "MM-DD" form. */
  startMonthDay: MonthDay;
  /** Inclusive end in "MM-DD" form. */
  endMonthDay: MonthDay;
  /** Short human label for error/UI ("Spring bloom"). */
  seasonLabel: string;
};

const SEASONAL_OPERATING_WINDOWS: Record<string, SeasonalOperatingWindow> = {
  "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju": {
    startMonthDay: "02-25",
    endMonthDay: "04-10",
    seasonLabel: "Late-February to early-April plum & cherry season",
  },
  "busan-spring-cherry-blossom-gyeongju-highlights-day-tour": {
    startMonthDay: "03-28",
    endMonthDay: "04-10",
    seasonLabel: "Late-March to early-April cherry blossom season",
  },
  // Jeju cherry blossom typically peaks ~1 week earlier than mainland Korea
  // (late March), with bloom variation by elevation. Conservative window
  // covers the East-Jeju Jeonnong-ro / Noksan-ro cherry corridors.
  "jeju-cherry-blossom-tour-east-route": {
    startMonthDay: "03-15",
    endMonthDay: "04-15",
    seasonLabel: "Mid-March to mid-April Jeju cherry blossom season",
  },
  // Wraps year-end: winter season runs Nov–Mar. Covers Jeju tangerine harvest
  // (Nov–Feb), winter camellia (Dec–Feb), and Hallasan snow viewing windows.
  "jeju-winter-southwest-tangerine-snow-camellia-tour": {
    startMonthDay: "11-15",
    endMonthDay: "03-15",
    seasonLabel: "Winter (Nov–Mar): tangerine harvest, camellia, and Hallasan snow",
  },
  // Wraps year-end. Dates from the operator's own listing, whose title is
  // literally "[Winter Special: Dec/20~Feb/28]" (owner screenshots 2026-08-07,
  // showing Dec 2026 and Feb 2027 calendars for the 2026-27 season).
  //
  // Distinct from the ice wall's build season: the Gail 2-ri village sprays the
  // wall from roughly late December and the 2025-26 viewing season ran 20 Dec –
  // 19 Feb. The listing sells to 28 Feb, so that is the window enforced here —
  // if the village confirms a shorter season for 2026-27, shorten this literal
  // rather than relying on the departure-weekday table to hide the tail.
  "seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour": {
    startMonthDay: "12-20",
    endMonthDay: "02-28",
    seasonLabel: "Winter special (20 Dec – 28 Feb): Seoraksan, Nami and the Eobi ice wall",
  },
};

/**
 * One guest-facing sentence for a date outside the window, so every surface
 * says the same thing.
 *
 * 🔴 It used to be built inline in `availability/route.ts`, which was the only
 * consumer — see the note on `isDateOutsideSeasonalWindow` below for why that
 * mattered.
 */
export function seasonalWindowReason(slug: string | null | undefined): string | null {
  const win = getSeasonalOperatingWindow(slug);
  if (!win) return null;
  return (
    `This is a season-locked tour (${win.seasonLabel}, ` +
    `${win.startMonthDay} – ${win.endMonthDay}). ` +
    `The selected date is outside the operating window.`
  );
}

export function getSeasonalOperatingWindow(slug: string | null | undefined): SeasonalOperatingWindow | null {
  if (!slug) return null;
  return SEASONAL_OPERATING_WINDOWS[slug] ?? null;
}

/**
 * Returns true if `dateString` (YYYY-MM-DD) is outside the slug's seasonal window.
 *
 * 🔴 Read by four surfaces, and that took a fix. Until 2026-08-07 the only
 * caller was `app/api/tours/[id]/availability/route.ts` — the single-date
 * check. The calendar is painted by `availability/range`, and bookings are
 * created by `app/api/bookings`, and neither consulted this file, so an
 * out-of-season date rendered as bookable and the create route accepted it.
 * It never surfaced because all four season-locked products were inactive at
 * the time. Compare `isDateOffDepartureDay`, which had all four callers from
 * the start; this is the same rule and needs the same reach. If you add a
 * fifth surface that decides whether a date is bookable, it reads this too.
 */
export function isDateOutsideSeasonalWindow(
  slug: string | null | undefined,
  dateString: string,
): boolean {
  const win = getSeasonalOperatingWindow(slug);
  if (!win) return false;
  const md = dateString.slice(5, 10);
  if (md.length !== 5) return false;
  // Wrap-around windows (e.g., 11-15 → 03-15): start > end means the window
  // spans year-end. A date is INSIDE if it's >= start (end-of-year tail) OR
  // <= end (start-of-year head). So OUTSIDE iff md < start AND md > end.
  if (win.startMonthDay > win.endMonthDay) {
    return md < win.startMonthDay && md > win.endMonthDay;
  }
  // Standard same-year window: outside iff md is before start or after end.
  return md < win.startMonthDay || md > win.endMonthDay;
}
