/**
 * Honest seasonality notes for the home "choose travel style" section (reform
 * U8). The scenic Korea seasons mirror the engine's PEAK_RANGES
 * (`lib/quote-engine/pricing-policy.ts`) — pure calendar fact, never fabricated
 * scarcity. AtoC tours are on-demand (availability is effectively unlimited), so
 * "N spots left" urgency is N/A by design; only this calendar-true seasonality
 * cue is shown.
 *
 * `currentSeasonNote` returns the active season (counting down to its end) or,
 * within a 30-day lead window, the next upcoming one — otherwise null (no note).
 */

export type SeasonKey = "cherryBlossom" | "summer" | "autumn";

export type SeasonNote = {
  key: SeasonKey;
  state: "active" | "soon";
  /** Whole days until the season's end (active) or start (soon). */
  days: number;
};

type SeasonRange = { key: SeasonKey; from: [number, number]; to: [number, number] };

/**
 * Scenic subset of PEAK_RANGES (Golden Week + year-end holidays are dropped —
 * they read as price-peak, not a scenic travel season). Month-day, year-agnostic.
 */
const SEASON_RANGES: readonly SeasonRange[] = [
  { key: "cherryBlossom", from: [3, 25], to: [4, 10] },
  { key: "summer", from: [7, 20], to: [8, 20] },
  { key: "autumn", from: [10, 18], to: [11, 5] },
];

/** Show an upcoming season this many days before it starts. */
export const SEASON_LEAD_DAYS = 30;
const MS_PER_DAY = 86_400_000;

function startOfDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function ceilDays(fromMs: number, toMs: number): number {
  return Math.ceil((toMs - fromMs) / MS_PER_DAY);
}

/**
 * The seasonal note to show for `today`, or null. An active season wins;
 * otherwise the soonest season starting within `SEASON_LEAD_DAYS`.
 */
export function currentSeasonNote(today: Date): SeasonNote | null {
  const year = today.getFullYear();
  const todayMs = startOfDayMs(today);

  for (const s of SEASON_RANGES) {
    const start = new Date(year, s.from[0] - 1, s.from[1]).getTime();
    const end = new Date(year, s.to[0] - 1, s.to[1]).getTime();
    if (todayMs >= start && todayMs <= end) {
      return { key: s.key, state: "active", days: Math.max(0, ceilDays(todayMs, end)) };
    }
  }

  let best: SeasonNote | null = null;
  for (const s of SEASON_RANGES) {
    const start = new Date(year, s.from[0] - 1, s.from[1]).getTime();
    if (start > todayMs) {
      const days = ceilDays(todayMs, start);
      if (days <= SEASON_LEAD_DAYS && (best === null || days < best.days)) {
        best = { key: s.key, state: "soon", days };
      }
    }
  }
  return best;
}

/** i18n key (relative to the `home` namespace) for a season's localized name. */
export function seasonNameKey(key: SeasonKey): string {
  switch (key) {
    case "cherryBlossom":
      return "premium.v2.chooseStyle.seasonCherryBlossom";
    case "summer":
      return "premium.v2.chooseStyle.seasonSummer";
    case "autumn":
      return "premium.v2.chooseStyle.seasonAutumn";
  }
}
