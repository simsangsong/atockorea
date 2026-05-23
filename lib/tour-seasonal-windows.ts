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
  "jeju-cherry-blossom-tour-east-route": {
    startMonthDay: "03-25",
    endMonthDay: "04-10",
    seasonLabel: "Late-March to early-April Jeju cherry blossom season",
  },
  "jeju-winter-southwest-tangerine-snow-camellia-tour": {
    startMonthDay: "12-01",
    endMonthDay: "02-29",
    seasonLabel: "December to February Jeju winter route",
  },
};

export function getSeasonalOperatingWindow(slug: string | null | undefined): SeasonalOperatingWindow | null {
  if (!slug) return null;
  return SEASONAL_OPERATING_WINDOWS[slug] ?? null;
}

/** Returns true if `dateString` (YYYY-MM-DD) is outside the slug's seasonal window. */
export function isDateOutsideSeasonalWindow(
  slug: string | null | undefined,
  dateString: string,
): boolean {
  const win = getSeasonalOperatingWindow(slug);
  if (!win) return false;
  const md = dateString.slice(5, 10);
  if (md.length !== 5) return false;
  if (win.startMonthDay <= win.endMonthDay) {
    return md < win.startMonthDay || md > win.endMonthDay;
  }
  return md > win.endMonthDay && md < win.startMonthDay;
}
