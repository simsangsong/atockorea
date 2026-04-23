import type { MatchWeightsV1 } from "@/lib/tour-product-match/types";

const DEFAULT_WEIGHTS: MatchWeightsV1 = {
  pace: 1.1,
  walking: 1.15,
  scenic: 0.85,
  photo: 0.75,
  culture: 0.8,
  relax: 0.65,
  first_time: 0.9,
  family: 0.85,
  senior: 0.75,
  couple: 0.55,
  active: 0.75,
  one_day: 1.0,
  same_day_flight: 0.45,
  rain: 0.5,
  value: 0.7,
  iconic: 0.85,
  cafe: 0.45,
  region_bonus: 0.35,
  region_mismatch_penalty: 0.12,
};

/** Phase C: alternate emphasis (e.g. stronger region + pace). */
const V1_WEIGHTS: MatchWeightsV1 = {
  ...DEFAULT_WEIGHTS,
  pace: 1.35,
  walking: 1.25,
  region_bonus: 0.5,
  region_mismatch_penalty: 0.18,
  one_day: 1.15,
  iconic: 0.95,
};

export function getMatchWeightsFromEnv(): MatchWeightsV1 {
  const key = (process.env.TOUR_MATCH_WEIGHT_SET ?? "default").trim().toLowerCase();
  if (key === "v1") return V1_WEIGHTS;
  return DEFAULT_WEIGHTS;
}
