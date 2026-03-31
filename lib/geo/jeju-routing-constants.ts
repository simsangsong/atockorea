/**
 * Centralized assumptions for Jeju island tourism routing (private car / mixed roads).
 * Tuned conservative: traffic, parking, photo stops not modeled explicitly.
 */

/** Average driving speed used for time-from-distance (km/h). */
export const JEJU_TOURISM_AVG_KMH = 35;

export const EARTH_RADIUS_KM = 6371;

/** Clamp estimated driving time per leg (minutes) — avoids absurdly short/long single-leg estimates. */
export const MIN_TRAVEL_LEG_MIN = 5;
export const MAX_TRAVEL_LEG_MIN_ESTIMATE = 95;

/** When coordinates are missing, same region_group short hop (minutes). */
export const SAME_REGION_TRAVEL_MIN = 12;

/** When coordinates are missing, cross-region fallback (minutes). */
export const CROSS_REGION_FALLBACK_MIN = 32;

/** Leg travel at or above this (minutes, after clamp) counts as a “long jump” for warnings. */
export const LONG_JUMP_THRESHOLD_MIN = 48;

// --- Route feasibility thresholds (whole-day / multi-stop) ---

/** Straight-line leg longer than this is treated as excessive (single-leg check). */
export const ROUTE_SINGLE_LEG_MAX_KM = 38;

/** Total driving time must not exceed this fraction of the trip time budget (single-day window). */
export const ROUTE_MAX_TRAVEL_FRACTION_OF_BUDGET = 0.42;

/** Hard cap on total estimated travel minutes per calendar day (even if budget is huge). */
export const ROUTE_MAX_TOTAL_TRAVEL_MIN_PER_DAY = 220;

/** Legs crossing different non-empty region_group values — warn if many. */
export const ROUTE_EXCESSIVE_REGION_JUMP_LEGS = 5;

/** Long-jump legs (see LONG_JUMP_THRESHOLD_MIN) — warn if count is high. */
export const ROUTE_EXCESSIVE_LONG_JUMP_COUNT = 3;

/** Adjacent-swap improvement passes (lightweight, not TSP). */
export const ROUTE_REORDER_MAX_PASSES = 8;

/** After reorder, weakest-stop removals for route repair. */
export const ROUTE_MAX_FEASIBILITY_TRIMS = 6;
