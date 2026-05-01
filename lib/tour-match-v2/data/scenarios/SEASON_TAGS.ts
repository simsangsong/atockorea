/**
 * Single source of truth for "this product is seasonal".
 *
 * Used by the stress-test evaluator to detect leakage:
 *  - if a tour's primary_themes ∪ secondary_themes ∪ slug contains any of these,
 *    AND the scenario expects no seasonal recommendations, it's a failure.
 *
 * Mirrors `lib/tour-match-v2/seasonal-gate.ts:SEASON_THEME_KEYS` but kept
 * separate to keep the test data layer free of code-side imports.
 */

export const SEASON_TAGS: readonly string[] = [
  "cherry_blossom",
  "plum_blossom",
  "canola_flower",
  "hydrangea",
  "hydrangea_festival",
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
];

/** Slug substrings that strongly imply seasonal product. */
export const SEASON_SLUG_HINTS: readonly string[] = [
  "cherry",
  "blossom",
  "hydrangea",
  "tangerine",
  "camellia",
  "snow",
  "winter-seasonal",
  "spring-seasonal",
  "autumn-foliage",
  "plum",
  "canola",
];
