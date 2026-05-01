/**
 * Seasonal gating — hardcoded rule that decides whether a seasonal product
 * (cherry blossom, hydrangea, tangerine, snow, camellia, autumn foliage, …)
 * may be recommended for a given parsed query.
 *
 * Truth table (seasonal products only; evergreen tours always pass):
 *
 *   user months  | season kw  | months ∩ available | today.month ∈ avail | gate
 *   ─────────────┼────────────┼────────────────────┼─────────────────────┼─────────
 *      ✗         |     ✗      |          —         |          —          | REJECT seasonal_no_signal
 *      ✓         |     ✗      |       non-empty    |          —          | PASS
 *      ✓         |     ✗      |        empty       |          —          | REJECT month_mismatch_explicit
 *      ✗         |     ✓      |    (months=null)   |          ✓          | PASS (today fallback)
 *      ✗         |     ✓      |    (months=null)   |          ✗          | REJECT season_keyword_off_season
 *      ✓         |     ✓      |       non-empty    |          —          | PASS
 *      ✓         |     ✓      |        empty       |          —          | REJECT contradiction_user_month_vs_season
 *
 * The user's explicit month is *authoritative* — season-lock context never
 * overrides it. The "5월 벚꽃" case lands in the last row and is rejected,
 * which is the correct outcome (cherries don't bloom in May).
 */

import type { MatchTourRow, ParsedQueryV2 } from "./types";

/** Seasonal phenomenon theme keys — used both to detect seasonal products
 *  and to recognize when a tour-row carries seasonal intent through themes
 *  even when its `available_months` happens to span the full year. */
export const SEASON_THEME_KEYS: ReadonlySet<string> = new Set([
  "cherry_blossom",
  "plum_blossom",
  "canola_flower",
  "hydrangea",
  "hydrangea_festival",
  "summer_flowers",
  "tangerine",
  "tangerine_picking",
  "snow",
  "snow_camellia",
  "winter_camellia",
  "camellia",
  "autumn_foliage",
  "spring_seasonal",
  "winter_seasonal",
  "summer_seasonal",
  "autumn_seasonal",
  "seasonal",
]);

/**
 * Maps each season_lock canonical key to all theme tokens that count as
 * "the same phenomenon". Used to reject tours that are seasonal but of a
 * DIFFERENT phenomenon than the one the user named — e.g. user says
 * "tangerine picking", a cherry-blossom-themed tour with overlapping months
 * must NOT be recommended.
 */
export const LOCK_TO_THEMES: Readonly<Record<string, readonly string[]>> = {
  cherry_blossom: ["cherry_blossom", "spring_seasonal", "canola_flower"],
  plum_blossom: ["plum_blossom", "spring_seasonal"],
  canola_flower: ["canola_flower", "cherry_blossom", "spring_seasonal"],
  hydrangea: ["hydrangea", "hydrangea_festival", "summer_flowers", "summer_seasonal"],
  tangerine: ["tangerine", "tangerine_picking", "winter_seasonal"],
  snow: ["snow", "snow_camellia", "winter_camellia", "winter_seasonal"],
  snow_camellia: ["snow_camellia", "winter_camellia", "camellia", "snow", "winter_seasonal"],
  camellia: ["camellia", "snow_camellia", "winter_camellia", "winter_seasonal"],
  autumn_foliage: ["autumn_foliage", "autumn_seasonal"],
};

export function isSeasonalProduct(tour: MatchTourRow): boolean {
  if (!tour.available_months || tour.available_months.length < 12) return true;
  const themes = [
    ...(tour.primary_themes ?? []),
    ...(tour.secondary_themes ?? []),
  ];
  return themes.some((t) => SEASON_THEME_KEYS.has(t));
}

export type SeasonalGateResult = { ok: boolean; reason: string | null };

export function passesSeasonalGate(
  tour: MatchTourRow,
  parsed: ParsedQueryV2,
  today: { year: number; month: number },
): SeasonalGateResult {
  if (!isSeasonalProduct(tour)) return { ok: true, reason: null };

  const userMonths = parsed.months ?? [];
  const userHasMonth = userMonths.length > 0;
  const userHasSeasonKeyword = (parsed.season_locks?.length ?? 0) > 0;

  // Wrong-phenomenon guard: when the user names a specific seasonal phenomenon,
  // tours that are clearly themed around a *different* phenomenon must be
  // rejected even if the months happen to overlap. This catches cases like
  // "April hallabong tangerine picking" surfacing cherry blossom tours just
  // because both have April in their available_months.
  if (userHasSeasonKeyword) {
    const tourSeasonalThemes = [
      ...(tour.primary_themes ?? []),
      ...(tour.secondary_themes ?? []),
    ].filter((t) => SEASON_THEME_KEYS.has(t));
    if (tourSeasonalThemes.length > 0) {
      const allowedThemes = new Set<string>();
      for (const lock of parsed.season_locks ?? []) {
        for (const t of LOCK_TO_THEMES[lock] ?? [lock]) allowedThemes.add(t);
      }
      const matchesUserPhenomenon = tourSeasonalThemes.some((t) => allowedThemes.has(t));
      if (!matchesUserPhenomenon) {
        return {
          ok: false,
          reason: `wrong_seasonal_phenomenon (user wants ${JSON.stringify(parsed.season_locks)} → allowed themes ${JSON.stringify([...allowedThemes])}; tour themes ${JSON.stringify(tourSeasonalThemes)})`,
        };
      }
    }
  }

  const avail = new Set(tour.available_months ?? []);
  const monthOverlap = userMonths.some((m) => avail.has(m));

  if (userHasMonth && userHasSeasonKeyword) {
    return monthOverlap
      ? { ok: true, reason: null }
      : {
          ok: false,
          reason: `contradiction_user_month_vs_season (user months=${JSON.stringify(
            userMonths,
          )} ∩ tour months=${JSON.stringify(tour.available_months)} = ∅; season_locks=${JSON.stringify(
            parsed.season_locks,
          )})`,
        };
  }

  if (userHasMonth && !userHasSeasonKeyword) {
    return monthOverlap
      ? { ok: true, reason: null }
      : {
          ok: false,
          reason: `month_mismatch_explicit (tour=${JSON.stringify(
            tour.available_months,
          )}, user_wants=${JSON.stringify(userMonths)})`,
        };
  }

  if (!userHasMonth && userHasSeasonKeyword) {
    const todayInSeason = avail.has(today.month);
    return todayInSeason
      ? { ok: true, reason: null }
      : {
          ok: false,
          reason: `season_keyword_off_season (today.month=${today.month}, tour months=${JSON.stringify(
            tour.available_months,
          )}, season_locks=${JSON.stringify(parsed.season_locks)})`,
        };
  }

  // No month, no season keyword → reject all seasonal products outright.
  return {
    ok: false,
    reason: "seasonal_no_signal (no month/season information in query — seasonal product not eligible)",
  };
}

/** Returns the `{ year, month }` for "now" using UTC. Centralized so callers and tests stay consistent. */
export function todayUtc(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}
