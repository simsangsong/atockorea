/**
 * Tour product recommendation — traveler intent (Gemini + deterministic boost) vs
 * `tour_matching_profiles` rows.
 */

export type RegionAffinity =
  | "east"
  | "southwest"
  | "full_island"
  | "any"
  | "jeju_island_wide"
  | "jeju_southwest";

/**
 * Product format the traveler's intent can request.
 *
 * The DB column `tour_matching_profiles.product_type` accepts a wider set of
 * authoring labels (e.g. `small_group_fixed_itinerary` from the v17 batch);
 * those map back to the three traveler-facing intents through
 * `productTypeFamily()` in `score-tour-products.ts`.
 */
export type DesiredProductType = "small_group" | "private" | "bus";

/**
 * Authoring labels seen in `tour_matching_profiles.product_type`. Superset of
 * `DesiredProductType` — the v17 batch introduced `small_group_fixed_itinerary`.
 * Use `productTypeFamily()` to collapse to the traveler-facing 3-way category.
 */
export const PROFILE_PRODUCT_TYPES = [
  "small_group",
  "private",
  "bus",
  "small_group_fixed_itinerary",
] as const;
export type ProfileProductType = (typeof PROFILE_PRODUCT_TYPES)[number];

/** Authoring `route_type` values accepted by `tour_matching_profiles`. */
export const PROFILE_ROUTE_TYPES = [
  "fixed_route",
  "flexible",
  "loop",
  "customizable",
  "cruise_shore_excursion_pair_route_variants",
  "winter_southwest_seasonal_full_day",
] as const;
export type ProfileRouteType = (typeof PROFILE_ROUTE_TYPES)[number];

/** Authoring `price_band` values accepted by `tour_matching_profiles`. */
export const PROFILE_PRICE_BANDS = ["budget", "mid", "premium", "mid_to_premium"] as const;
export type ProfilePriceBand = (typeof PROFILE_PRICE_BANDS)[number];

/** How strongly the user requires a product format; `hard` triggers hard exclusions on mismatch. */
export type ProductTypeIntentStrength = "soft" | "hard";

/** Normalized 1–5 Gemini output + boosts; nulls treated as neutral mid. */
export type TravelerIntentV1 = {
  /**
   * Structured product-type intent from Gemini when available.
   * When non-null, scoring uses this (plus `product_type_intent_strength`) instead of regex-only text parsing.
   */
  desired_product_type: DesiredProductType | null;
  /** `null` with `desired_product_type` set is treated as `"soft"`. */
  product_type_intent_strength: ProductTypeIntentStrength | null;
  pace_preference: number | null;
  walking_tolerance: number | null;
  scenic_importance: number | null;
  photo_importance: number | null;
  culture_importance: number | null;
  relax_importance: number | null;
  first_time_jeju: boolean | null;
  with_family: boolean | null;
  with_seniors: boolean | null;
  with_kids: boolean | null;
  one_day_only: boolean | null;
  same_day_flight: boolean | null;
  rain_sensitive: boolean | null;
  value_focus: number | null;
  iconic_importance: number | null;
  cafe_importance: number | null;
  region_affinity: RegionAffinity | null;
  /** Self-reported 0–1 */
  confidence: number | null;
  summary_one_line: string | null;
  mobility: "low" | "moderate" | "high" | null;
  toddlers: boolean | null;
  stroller_heavy: boolean | null;
};

/**
 * Canonical hard-constraint keys enforced by `shouldHardExclude`.
 * Adding a new key here is the only supported way to extend the exclusion
 * surface — authors and the matching-profile Zod schema both reference these.
 */
export const KNOWN_AVOID_IF_KEYS = [
  "needs_slow_pace",
  "tight_same_day_departure",
  "strict_same_day_flight_schedule",
  "monday_departure_required",
  "strictly_indoor_preference",
  /**
   * Traveler explicitly requires a step-free / stair-free experience.
   * Enforcement in `shouldHardExclude` is inverted relative to the other
   * keys: products are excluded by default when this intent is detected,
   * unless their profile explicitly opts-in as step-free (e.g. via
   * `theme_tags.includes("step_free")`). Authors may still list it in a
   * product's `avoidIf` for author-side documentation, but the runtime
   * does not require the opt-in to enforce exclusion.
   */
  "strict_no_stairs_request",
  "needs_zero_stairs",
] as const;

export type KnownAvoidIfKey = (typeof KNOWN_AVOID_IF_KEYS)[number];

export const KNOWN_NOT_IDEAL_FOR_KEYS = [
  "toddlers",
  "stroller_heavy",
  "very_low_mobility",
] as const;

export type KnownNotIdealForKey = (typeof KNOWN_NOT_IDEAL_FOR_KEYS)[number];

export type HardConstraintsJson = {
  avoidIf?: (KnownAvoidIfKey | (string & {}))[];
  notIdealFor?: (KnownNotIdealForKey | (string & {}))[];
};

export type TourMatchingProfileRow = {
  product_id: string;
  product_type: string;
  route_type: string;
  region_type: string;
  region_tags: unknown;
  theme_tags: unknown;
  poi_tags: unknown;
  pace_level: number;
  walking_level: number;
  scenic_level: number;
  photo_level: number;
  culture_level: number;
  relax_level: number;
  first_time_fit: number;
  family_fit: number;
  senior_fit: number;
  couple_fit: number;
  active_traveler_fit: number;
  one_day_fit: number;
  same_day_flight_fit: number;
  rain_fit: number;
  value_for_money_fit: number;
  iconic_landmark_fit: number;
  cafe_fit: number;
  /** 1–5 extended dimensions (migrations `20260415180000`, `20260415210000`). */
  adult_family_fit: number;
  young_kids_fit: number;
  senior_active_fit: number;
  senior_general_fit: number;
  mobility_friendly_fit: number;
  stroller_fit: number;
  /** 0–100 approximate indoor / sheltered share. */
  indoor_ratio: number;
  /** 1–5 higher = route more weather-exposed. */
  weather_sensitivity: number;
  local_culture_fit: number;
  shopping_fit: number;
  storytelling_fit: number;
  comfort_level: number;
  budget_fit: number;
  premium_fit: number;
  small_group_fit: number;
  private_fit: number;
  bus_fit: number;
  /** Coarse commercial band, e.g. budget | mid | premium. */
  price_band: string;
  pickup_base: string;
  return_time_band: string;
  duration_band: string;
  min_recommended_age: number;
  hard_constraints: HardConstraintsJson;
  walking_notes: unknown;
  keywords: unknown;
  synonym_hints: unknown;
  profile_version: number;
  is_active: boolean;
};

export type MatchWeightsV1 = {
  pace: number;
  walking: number;
  scenic: number;
  photo: number;
  culture: number;
  relax: number;
  first_time: number;
  family: number;
  senior: number;
  couple: number;
  active: number;
  one_day: number;
  same_day_flight: number;
  rain: number;
  value: number;
  iconic: number;
  cafe: number;
  region_bonus: number;
  region_mismatch_penalty: number;
};

export type ScoredProduct = {
  product_id: string;
  score: number;
  breakdown: Record<string, number>;
  excluded: boolean;
  excludeReason: string | null;
};

/** Final product-type intent used for gating (same semantics as `resolveProductTypeIntent`). */
export type ResolvedProductTypeIntentSnapshot = {
  desired_product_type: DesiredProductType | null;
  product_type_intent_strength: ProductTypeIntentStrength | null;
};

export type TourMatchOutcome = "matched" | "no_match";

/** Why `matchedProducts` is empty (only when `matchOutcome` is `no_match`). */
export type TourMatchNoMatchReason =
  | "no_exact_type_match"
  | "no_step_free_products"
  | "all_products_excluded";

export type TourMatchApiResponse = {
  intent: TravelerIntentV1;
  /** First non-excluded row, or `null` when the catalog has no eligible product. */
  winner: ScoredProduct | null;
  /** Non-excluded scored rows (same order as relative ranks among valid). */
  matchedProducts: ScoredProduct[];
  ranked: ScoredProduct[];
  matchOutcome: TourMatchOutcome;
  noMatchReason: TourMatchNoMatchReason | null;
  resolvedProductTypeIntent: ResolvedProductTypeIntentSnapshot;
  /** Regex-only parse of raw user text (for debugging; superseded when structured intent is set). */
  textParserProductTypeIntent: ResolvedProductTypeIntentSnapshot;
  /**
   * When `noMatchReason` is `no_exact_type_match`, callers may offer private / custom / browse fallbacks.
   */
  fallbackAvailable: boolean;
  profileSource: "seed" | "supabase";
  weightSet: string;
  /** After deterministic winner: second LLM pass; omitted when there is no eligible winner. */
  matchExplanation: string | null;
};
