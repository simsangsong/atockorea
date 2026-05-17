export type RegionAffinity =
  | "east"
  | "southwest"
  | "full_island"
  | "any"
  | "jeju_island_wide"
  | "jeju_southwest";

export type DesiredProductType = "small_group" | "private" | "bus";

export type ProductTypeIntentStrength = "soft" | "hard";

export type TravelerIntentV1 = {
  desired_product_type: DesiredProductType | null;
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
  confidence: number | null;
  summary_one_line: string | null;
  mobility: "low" | "moderate" | "high" | null;
  toddlers: boolean | null;
  stroller_heavy: boolean | null;
};

export type ScoredProduct = {
  product_id: string;
  score: number;
  breakdown: Record<string, number>;
  excluded: boolean;
  excludeReason: string | null;
};

export type ResolvedProductTypeIntentSnapshot = {
  desired_product_type: DesiredProductType | null;
  product_type_intent_strength: ProductTypeIntentStrength | null;
};

export type TourMatchOutcome = "matched" | "no_match";

export type TourMatchNoMatchReason =
  | "no_exact_type_match"
  | "no_step_free_products"
  | "all_products_excluded"
  | "insufficient_input"
  | "seasonal_contradiction";

export type TourMatchApiResponse = {
  intent: TravelerIntentV1;
  winner: ScoredProduct | null;
  matchedProducts: ScoredProduct[];
  ranked: ScoredProduct[];
  matchOutcome: TourMatchOutcome;
  noMatchReason: TourMatchNoMatchReason | null;
  resolvedProductTypeIntent: ResolvedProductTypeIntentSnapshot;
  textParserProductTypeIntent: ResolvedProductTypeIntentSnapshot;
  fallbackAvailable: boolean;
  profileSource: "match_tours";
  weightSet: string;
  matchExplanation: string | null;
};
