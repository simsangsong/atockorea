import { mergeDeterministicIntentBoost } from "@/lib/tour-product-match/deterministic-boost";
import { SEED_TOUR_MATCHING_PROFILES } from "@/lib/tour-product-match/seed-profiles";
import {
  FIT_DIMENSION_KEYS,
  norm1to5,
  normIndoorRatioPercent,
  parseProductTypeIntent,
  resolveProductTypeIntent,
  scoreIntentAgainstProfiles,
  shouldHardExclude,
  TOUR_MATCH_CHANNEL_WEIGHTS,
} from "@/lib/tour-product-match/score-tour-products";
import type { TourMatchingProfileRow, TravelerIntentV1 } from "@/lib/tour-product-match/types";
import { getMatchWeightsFromEnv } from "@/lib/tour-product-match/weights";

const baseIntent = (): TravelerIntentV1 => ({
  desired_product_type: null,
  product_type_intent_strength: null,
  pace_preference: 3,
  walking_tolerance: 3,
  scenic_importance: 3,
  photo_importance: 3,
  culture_importance: 3,
  relax_importance: 3,
  first_time_jeju: null,
  with_family: null,
  with_seniors: null,
  with_kids: null,
  one_day_only: null,
  same_day_flight: null,
  rain_sensitive: null,
  value_focus: 3,
  iconic_importance: 3,
  cafe_importance: 3,
  region_affinity: "any",
  confidence: 0.85,
  summary_one_line: null,
  mobility: "moderate",
  toddlers: null,
  stroller_heavy: null,
});

/** Synthetic second product for exclusion tests (not in live SEED). */
const mockGrandLoopProfile: TourMatchingProfileRow = {
  product_id: "jeju-grand-highlights-loop",
  product_type: "small_group",
  route_type: "fixed_route",
  region_type: "full_island",
  region_tags: ["jeju_all_around"],
  theme_tags: ["hallasan", "fast_paced"],
  poi_tags: ["hallasan", "seongsan"],
  pace_level: 5,
  walking_level: 4,
  scenic_level: 5,
  photo_level: 5,
  culture_level: 2,
  relax_level: 2,
  first_time_fit: 4,
  family_fit: 2,
  senior_fit: 2,
  couple_fit: 4,
  active_traveler_fit: 5,
  one_day_fit: 5,
  same_day_flight_fit: 1,
  rain_fit: 4,
  value_for_money_fit: 3,
  iconic_landmark_fit: 4,
  cafe_fit: 2,
  adult_family_fit: 3,
  young_kids_fit: 2,
  senior_active_fit: 3,
  senior_general_fit: 2,
  mobility_friendly_fit: 2,
  stroller_fit: 2,
  indoor_ratio: 28,
  weather_sensitivity: 4,
  local_culture_fit: 2,
  shopping_fit: 2,
  storytelling_fit: 3,
  comfort_level: 2,
  budget_fit: 3,
  premium_fit: 3,
  small_group_fit: 5,
  private_fit: 1,
  bus_fit: 2,
  price_band: "mid",
  pickup_base: "jeju_city",
  return_time_band: "17:40-18:15",
  duration_band: "9.5h",
  min_recommended_age: 10,
  hard_constraints: {
    avoidIf: ["needs_slow_pace", "tight_same_day_departure", "strict_same_day_flight_schedule"],
    notIdealFor: ["stroller_heavy", "very_low_mobility", "toddlers", "cafe_relax_focused_day"],
  },
  walking_notes: ["uphill at Hallasan", "steps at Jeongbang", "optional Seongsan summit"],
  keywords: ["jeju one day", "fast paced jeju"],
  synonym_hints: ["full island loop"],
  profile_version: 3,
  is_active: true,
};

describe("tour match scoring v2", () => {
  it("exports channel weights that sum to 1", () => {
    const s =
      TOUR_MATCH_CHANNEL_WEIGHTS.typeScore +
      TOUR_MATCH_CHANNEL_WEIGHTS.fitScore +
      TOUR_MATCH_CHANNEL_WEIGHTS.indoorWeatherScore +
      TOUR_MATCH_CHANNEL_WEIGHTS.keywordBoost;
    expect(s).toBeCloseTo(1, 5);
  });

  it("normalizes indoor_ratio separately from 1–5 dimensions", () => {
    const p = SEED_TOUR_MATCHING_PROFILES.find((x) => x.product_id === "east-signature-nature-core")!;
    expect(normIndoorRatioPercent(p.indoor_ratio)).toBeCloseTo(0.42, 5);
    expect(norm1to5(5)).toBe(1);
    expect(FIT_DIMENSION_KEYS).not.toContain("indoor_ratio" as never);
  });

  it("excludes grand loop profile when same-day flight is required (strict schedule)", () => {
    const intent = baseIntent();
    intent.same_day_flight = true;
    expect(shouldHardExclude(intent, mockGrandLoopProfile, "evening flight")).toBe("tight_same_day_departure");
  });

  it("excludes east when user insists on strictly indoor experience", () => {
    const east = SEED_TOUR_MATCHING_PROFILES.find((x) => x.product_id === "east-signature-nature-core")!;
    const intent = baseIntent();
    expect(shouldHardExclude(intent, east, "I want a strictly indoor day only")).toBe("strictly_indoor_preference");
  });

  it("excludes every seeded profile when user requires strict no-stairs / step-free access", () => {
    const weights = getMatchWeightsFromEnv();
    const intent = baseIntent();
    const rawText = "Please only step-free tours, strictly no stairs for my wheelchair";

    for (const profile of SEED_TOUR_MATCHING_PROFILES) {
      expect(shouldHardExclude(intent, profile, rawText)).toBe("strict_no_stairs_request");
    }

    const ranked = scoreIntentAgainstProfiles(rawText, intent, SEED_TOUR_MATCHING_PROFILES, weights);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((r) => r.excluded)).toBe(true);
    expect(ranked.every((r) => r.excludeReason === "strict_no_stairs_request")).toBe(true);
  });

  it("still matches when a profile opts-in as step-free via theme_tags", () => {
    const east = SEED_TOUR_MATCHING_PROFILES.find((x) => x.product_id === "east-signature-nature-core")!;
    const stepFreeProfile: TourMatchingProfileRow = {
      ...east,
      product_id: "step-free-demo-product",
      theme_tags: [...(east.theme_tags as string[]), "step_free"],
    };
    const intent = baseIntent();
    expect(shouldHardExclude(intent, stepFreeProfile, "step-free tours only please")).toBeNull();
  });

  it("does not hard-exclude for incidental mentions of stairs", () => {
    const east = SEED_TOUR_MATCHING_PROFILES.find((x) => x.product_id === "east-signature-nature-core")!;
    const intent = baseIntent();
    expect(
      shouldHardExclude(
        intent,
        east,
        "The stairs up Seongsan Ilchulbong sound amazing, looking forward to the view",
      ),
    ).toBeNull();
  });

  it("ranks small-group tours lower when user explicitly asks for a private tour (soft intent)", () => {
    const weights = getMatchWeightsFromEnv();
    const intent = baseIntent();
    const ranked = scoreIntentAgainstProfiles(
      "We need a private tour for two, not a shared van",
      intent,
      SEED_TOUR_MATCHING_PROFILES,
      weights,
    );
    const east = ranked.find((r) => r.product_id === "east-signature-nature-core");
    expect(east?.score ?? 0).toBeLessThan(0.25);
  });

  it("hard requirement: only private excludes all small_group rows", () => {
    const weights = getMatchWeightsFromEnv();
    const intent = baseIntent();
    expect(parseProductTypeIntent("I only want private, no shared tour").strength).toBe("hard");
    const ranked = scoreIntentAgainstProfiles("I only want private, no shared tour", intent, SEED_TOUR_MATCHING_PROFILES, weights);
    expect(ranked.every((r) => r.excluded)).toBe(true);
    expect(ranked[0].excludeReason).toBe("product_type_private_only");
  });

  it("hard requirement: only bus excludes non-bus products", () => {
    const weights = getMatchWeightsFromEnv();
    const intent = baseIntent();
    expect(parseProductTypeIntent("must be a bus tour only").desired).toBe("bus");
    const ranked = scoreIntentAgainstProfiles("must be a bus tour only", intent, SEED_TOUR_MATCHING_PROFILES, weights);
    expect(ranked.every((r) => r.excluded)).toBe(true);
  });

  it("explicit small group phrase sets soft small_group intent", () => {
    const p = parseProductTypeIntent("small-group day tour, join tour is ok");
    expect(p.desired).toBe("small_group");
    expect(p.strength).toBe("soft");
  });

  it("structured intent from Gemini wins over vague text (hard private excludes all)", () => {
    const weights = getMatchWeightsFromEnv();
    const intent: TravelerIntentV1 = {
      ...baseIntent(),
      desired_product_type: "private",
      product_type_intent_strength: "hard",
    };
    expect(resolveProductTypeIntent(intent, "nice day in Jeju")).toEqual({
      desired: "private",
      strength: "hard",
    });
    const ranked = scoreIntentAgainstProfiles("nice day in Jeju", intent, SEED_TOUR_MATCHING_PROFILES, weights);
    expect(ranked.every((r) => r.excluded)).toBe(true);
  });

  it("structured intent soft small_group does not exclude catalog small_group rows", () => {
    const weights = getMatchWeightsFromEnv();
    const intent: TravelerIntentV1 = {
      ...baseIntent(),
      desired_product_type: "small_group",
      product_type_intent_strength: "soft",
    };
    const ranked = scoreIntentAgainstProfiles("anything", intent, SEED_TOUR_MATCHING_PROFILES, weights);
    expect(ranked.some((r) => !r.excluded)).toBe(true);
  });

  it("rain-sensitive intent uses indoor_ratio only via indoorWeather channel (not raw 0–100 in fit)", () => {
    const weights = getMatchWeightsFromEnv();
    const intent = baseIntent();
    intent.rain_sensitive = true;
    const ranked = scoreIntentAgainstProfiles("worried about rain", intent, SEED_TOUR_MATCHING_PROFILES, weights);
    const east = ranked.find((r) => r.product_id === "east-signature-nature-core");
    expect(east?.breakdown.indoor_ratio_norm).toBeCloseTo(0.42, 2);
    expect(east?.breakdown.fitScore).toBeGreaterThan(0);
    expect(east?.breakdown.fitScore).toBeLessThanOrEqual(1);
  });

  it("high indoor_ratio does not fully offset high weather_sensitivity for rain users", () => {
    const weights = getMatchWeightsFromEnv();
    const intent = baseIntent();
    intent.rain_sensitive = true;
    const eastBase = SEED_TOUR_MATCHING_PROFILES.find((x) => x.product_id === "east-signature-nature-core")!;
    const fakeHighIndoorHighExposure: TourMatchingProfileRow = {
      ...eastBase,
      indoor_ratio: 85,
      weather_sensitivity: 5,
    };
    const ranked = scoreIntentAgainstProfiles("rain safe please", intent, [fakeHighIndoorHighExposure], weights);
    const row = ranked[0];
    expect(row.breakdown.indoorWeatherScore).toBeLessThan(0.92);
  });

  it("single-token cafe query: top match is flagship when it is the only catalog product", () => {
    const weights = getMatchWeightsFromEnv();
    const intent = baseIntent();
    intent.cafe_importance = 5;
    const ranked = scoreIntentAgainstProfiles("cafe", intent, SEED_TOUR_MATCHING_PROFILES, weights);
    const valid = ranked.filter((r) => !r.excluded);
    expect(valid[0]?.product_id).toBe("east-signature-nature-core");
  });

  it("cafe tour text: deterministic boost still yields a ranked east winner in single-SKU catalog", () => {
    const weights = getMatchWeightsFromEnv();
    const intent = mergeDeterministicIntentBoost("cafe tour", baseIntent());
    expect(intent.region_affinity).toBe("southwest");
    expect(intent.cafe_importance).toBe(5);
    const ranked = scoreIntentAgainstProfiles("cafe tour", intent, SEED_TOUR_MATCHING_PROFILES, weights);
    expect(ranked[0].product_id).toBe("east-signature-nature-core");
  });

  it("logs example ranking + weighting map (stdout)", () => {
    const weights = getMatchWeightsFromEnv();
    // eslint-disable-next-line no-console
    console.log("TOUR_MATCH_CHANNEL_WEIGHTS", TOUR_MATCH_CHANNEL_WEIGHTS);
    const scenarios: { label: string; text: string; intent: TravelerIntentV1 }[] = [
      {
        label: "fast iconic full-island",
        text: "one day jeju highlights hallasan seongsan fast paced",
        intent: { ...baseIntent(), one_day_only: true, pace_preference: 5, region_affinity: "full_island" },
      },
      {
        label: "relaxed southwest style",
        text: "balanced tea coast southwest jeju osulloc",
        intent: { ...baseIntent(), pace_preference: 3, region_affinity: "southwest" },
      },
      {
        label: "first time east coast",
        text: "first time jeju seongsan east jeju",
        intent: { ...baseIntent(), first_time_jeju: true, region_affinity: "east" },
      },
    ];
    for (const s of scenarios) {
      const ranked = scoreIntentAgainstProfiles(s.text, s.intent, SEED_TOUR_MATCHING_PROFILES, weights);
      // eslint-disable-next-line no-console
      console.log(
        s.label,
        ranked.map((r) => ({ id: r.product_id, score: r.score.toFixed(4), ex: r.excluded })),
      );
    }
    expect(true).toBe(true);
  });
});
