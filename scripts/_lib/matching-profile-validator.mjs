/**
 * Validator for tour JSON `matching_profile` blocks imported into
 * `match_tours.matching_profile`.
 *
 * If zod is available in node_modules we use it; otherwise fall back to a
 * handwritten validator so the generators never block on dep-install races.
 */

export const PRODUCT_TYPES = [
  "small_group",
  "private",
  "bus",
  // v17 batch — fixed-itinerary small group (treated like small_group in scoring)
  "small_group_fixed_itinerary",
];
export const ROUTE_TYPES = [
  "fixed_route",
  "flexible",
  "loop",
  // v17 batch — private custom routing
  "customizable",
  // v17 batch — cruise shore-excursion with paired port-of-call route variants
  "cruise_shore_excursion_pair_route_variants",
  // v17 batch — winter/seasonal southwest full-day
  "winter_southwest_seasonal_full_day",
];
export const REGION_TYPES = [
  // Legacy / Jeju
  "east",
  "southwest",
  "full_island",
  "any",
  "jeju_island_wide",
  "jeju_southwest",
  // Jeju v2
  "jeju_east",
  "jeju_south",
  "jeju_west_south",
  "jeju_all_around",
  "island_full",
  "island_southwest",
  // Busan / Gyeongsang
  "busan_city",
  "gyeongsang_north",
  "gyeongju_from_busan",
  // Seoul / Incheon / Gyeonggi
  "seoul_with_incheon_origin",
  "gyeonggi_pocheon",
  "gyeonggi_paju",
  "gyeonggi_gapyeong",
  "gyeonggi_south",
  "gyeonggi_mixed",
  // Gangwon
  "gangwon_seoraksan",
];
export const PRICE_BANDS = ["budget", "mid", "premium", "mid_to_premium"];

export const KNOWN_AVOID_IF_KEYS = [
  "needs_slow_pace",
  "tight_same_day_departure",
  "strict_same_day_flight_schedule",
  "monday_departure_required",
  "strictly_indoor_preference",
  // Traveler requires step-free / stair-free experience. Enforced in
  // `shouldHardExclude` globally: all products not tagged step-free
  // are excluded when this intent is detected.
  "strict_no_stairs_request",
  "needs_zero_stairs",
];

export const KNOWN_NOT_IDEAL_FOR_KEYS = ["toddlers", "stroller_heavy", "very_low_mobility"];

const REQUIRED_LEVEL_KEYS = [
  "pace_level", "walking_level", "scenic_level", "photo_level", "culture_level", "relax_level",
  "first_time_fit", "family_fit", "senior_fit", "couple_fit", "active_traveler_fit",
  "one_day_fit", "same_day_flight_fit", "rain_fit", "value_for_money_fit",
  "iconic_landmark_fit", "cafe_fit",
  "adult_family_fit", "young_kids_fit", "senior_active_fit", "senior_general_fit",
  "mobility_friendly_fit", "stroller_fit",
  "weather_sensitivity",
  "local_culture_fit", "shopping_fit", "storytelling_fit",
  "comfort_level", "budget_fit", "premium_fit",
  "small_group_fit", "private_fit", "bus_fit",
];

const REQUIRED_STRING_KEYS = ["pickup_base", "return_time_band", "duration_band"];
const REQUIRED_ARRAY_KEYS = ["region_tags", "theme_tags", "poi_tags", "walking_notes", "keywords", "synonym_hints"];

function isInt(n) { return typeof n === "number" && Number.isInteger(n); }

function isValidLevelValue(n) {
  if (typeof n !== "number" || !isFinite(n)) return false;
  return n >= 0 && n <= 1;
}

/**
 * @returns {{ ok: boolean, issues: Array<{ level: 'error'|'warn', path: string, message: string }> }}
 */
export function validateMatchingProfile(raw) {
  /** @type {Array<{ level: 'error'|'warn', path: string, message: string }>} */
  const issues = [];
  const err = (path, message) => issues.push({ level: "error", path, message });
  const warn = (path, message) => issues.push({ level: "warn", path, message });

  if (!raw || typeof raw !== "object") {
    err("(root)", "matching_profile must be an object");
    return { ok: false, issues };
  }

  if (!PRODUCT_TYPES.includes(raw.product_type)) {
    err("product_type", `expected one of ${PRODUCT_TYPES.join(" | ")}, got ${JSON.stringify(raw.product_type)}`);
  }
  if (!ROUTE_TYPES.includes(raw.route_type)) {
    err("route_type", `expected one of ${ROUTE_TYPES.join(" | ")}, got ${JSON.stringify(raw.route_type)}`);
  }
  if (!REGION_TYPES.includes(raw.region_type)) {
    err("region_type", `expected one of ${REGION_TYPES.join(" | ")}, got ${JSON.stringify(raw.region_type)} (historical value "all_around" should be "full_island")`);
  }
  if (!PRICE_BANDS.includes(raw.price_band)) {
    err("price_band", `expected one of ${PRICE_BANDS.join(" | ")}, got ${JSON.stringify(raw.price_band)}`);
  }

  for (const k of REQUIRED_LEVEL_KEYS) {
    const v = raw[k];
    if (!isValidLevelValue(v)) {
      err(k, `expected 0..1 score, got ${JSON.stringify(v)}`);
    }
  }
  {
    const v = raw.indoor_ratio;
    const ok =
      typeof v === "number" &&
      Number.isFinite(v) &&
      v >= 0 &&
      v <= 1;
    if (!ok) {
      err("indoor_ratio", `expected 0..1 ratio, got ${JSON.stringify(v)}`);
    }
  }
  if (!isInt(raw.min_recommended_age) || raw.min_recommended_age < 0 || raw.min_recommended_age > 99) {
    err("min_recommended_age", `expected integer 0..99, got ${JSON.stringify(raw.min_recommended_age)}`);
  }
  if (!isInt(raw.profile_version) || raw.profile_version < 1) {
    err("profile_version", `expected integer >= 1, got ${JSON.stringify(raw.profile_version)}`);
  }
  if (typeof raw.is_active !== "boolean") {
    err("is_active", `expected boolean, got ${JSON.stringify(raw.is_active)}`);
  }

  for (const k of REQUIRED_STRING_KEYS) {
    if (typeof raw[k] !== "string" || raw[k].length === 0) {
      err(k, "expected non-empty string");
    }
  }
  // v17 batch: REQUIRED_ARRAY_KEYS leniency.
  // - walking_notes/keywords/synonym_hints: a stray string is wrapped to [string] downstream;
  //   missing/null is normalized to []. Validator emits a warn rather than blocking.
  // - region_tags/theme_tags/poi_tags: still required arrays (these drive matching).
  const STRICT_ARRAY_KEYS = new Set(["region_tags", "theme_tags", "poi_tags"]);
  for (const k of REQUIRED_ARRAY_KEYS) {
    const v = raw[k];
    if (Array.isArray(v)) continue;
    if (STRICT_ARRAY_KEYS.has(k)) {
      err(k, "expected array of strings");
    } else {
      warn(k, `expected array of strings, got ${JSON.stringify(v)}; will be coerced downstream`);
    }
  }

  const hc = raw.hard_constraints;
  if (!hc || typeof hc !== "object" || Array.isArray(hc)) {
    // v17 batch: missing/malformed hard_constraints downgraded to warn.
    // Generator coerces to { avoidIf: [], notIdealFor: [] } for the JSONB cell.
    warn(
      "hard_constraints",
      `expected object { avoidIf: string[], notIdealFor: string[] }, got ${JSON.stringify(hc)}; defaulting to { avoidIf: [], notIdealFor: [] }`,
    );
  } else {
    const avoidIf = Array.isArray(hc.avoidIf) ? hc.avoidIf : [];
    const notIdealFor = Array.isArray(hc.notIdealFor) ? hc.notIdealFor : [];
    if (!Array.isArray(hc.avoidIf)) warn("hard_constraints.avoidIf", "expected array of strings; defaulting to []");
    if (!Array.isArray(hc.notIdealFor)) warn("hard_constraints.notIdealFor", "expected array of strings; defaulting to []");

    for (const k of avoidIf) {
      if (!KNOWN_AVOID_IF_KEYS.includes(k)) {
        warn(
          "hard_constraints.avoidIf",
          `"${k}" is not a canonical avoidIf key; shouldHardExclude will not enforce it. Known: ${KNOWN_AVOID_IF_KEYS.join(", ")}`,
        );
      }
    }
    for (const k of notIdealFor) {
      const tolerated = KNOWN_NOT_IDEAL_FOR_KEYS.includes(k) || (typeof k === "string" && k.includes("stroller"));
      if (!tolerated) {
        warn(
          "hard_constraints.notIdealFor",
          `"${k}" is not a canonical notIdealFor key. Known: ${KNOWN_NOT_IDEAL_FOR_KEYS.join(", ")}`,
        );
      }
    }
  }

  return { ok: issues.every((i) => i.level !== "error"), issues };
}

/**
 * Validates and prints issues. Exits the process on errors so generator scripts
 * fail loudly in CI. Safe to call with `raw === undefined` (no-op).
 */
export function assertMatchingProfileOrExit(raw, { sourceLabel = "matching_profile" } = {}) {
  if (raw == null) return;
  const { ok, issues } = validateMatchingProfile(raw);
  for (const issue of issues) {
    const tag = issue.level === "error" ? "[ERROR]" : "[warn]";
    console.error(`${tag} ${sourceLabel}.${issue.path}: ${issue.message}`);
  }
  if (!ok) {
    console.error(`\nMatching profile validation failed for ${sourceLabel}. Fix the JSON before importing match_tours.`);
    process.exit(1);
  }
}
