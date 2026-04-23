import { mergeDeterministicIntentBoost } from "@/lib/tour-product-match/deterministic-boost";
import { computeTourMatchOutcomeMeta } from "@/lib/tour-product-match/match-outcome";
import { normalizeTravelerIntent } from "@/lib/tour-product-match/normalize-intent";
import { SEED_TOUR_MATCHING_PROFILES } from "@/lib/tour-product-match/seed-profiles";
import {
  parseProductTypeIntent,
  resolveProductTypeIntent,
  scoreIntentAgainstProfiles,
} from "@/lib/tour-product-match/score-tour-products";
import type { TravelerIntentV1 } from "@/lib/tour-product-match/types";
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

/**
 * End-to-end: normalize (Gemini-shaped) → deterministic boost → resolve → score.
 * Structured product-type must beat contradictory wording in raw text.
 */
describe("tour match contract (Gemini → normalize → boost → resolve → score)", () => {
  it("structured hard private wins over small-group phrasing in raw text", () => {
    const rawText = "We want a small group join tour, shared day tour is ok";
    expect(parseProductTypeIntent(rawText).desired).toBe("small_group");

    const intent = mergeDeterministicIntentBoost(
      rawText,
      normalizeTravelerIntent({
        ...baseIntent(),
        desired_product_type: "private",
        product_type_intent_strength: "hard",
      }),
    );

    expect(intent.desired_product_type).toBe("private");
    expect(intent.product_type_intent_strength).toBe("hard");

    const resolved = resolveProductTypeIntent(intent, rawText);
    expect(resolved.desired).toBe("private");
    expect(resolved.strength).toBe("hard");

    const weights = getMatchWeightsFromEnv();
    const ranked = scoreIntentAgainstProfiles(rawText, intent, SEED_TOUR_MATCHING_PROFILES, weights);
    const matched = ranked.filter((r) => !r.excluded);
    expect(matched.length).toBe(0);
    expect(ranked.every((r) => r.excludeReason === "product_type_private_only")).toBe(true);

    const meta = computeTourMatchOutcomeMeta(ranked, matched);
    expect(meta.matchOutcome).toBe("no_match");
    expect(meta.noMatchReason).toBe("no_exact_type_match");
    expect(meta.fallbackAvailable).toBe(true);
  });

  it("strict no-stairs request excludes the entire catalog and reports no_step_free_products", () => {
    const rawText = "We need strictly step-free, no stairs at all please";

    const intent = mergeDeterministicIntentBoost(rawText, normalizeTravelerIntent(baseIntent()));

    const weights = getMatchWeightsFromEnv();
    const ranked = scoreIntentAgainstProfiles(rawText, intent, SEED_TOUR_MATCHING_PROFILES, weights);
    const matched = ranked.filter((r) => !r.excluded);
    expect(matched.length).toBe(0);
    expect(ranked.every((r) => r.excludeReason === "strict_no_stairs_request")).toBe(true);

    const meta = computeTourMatchOutcomeMeta(ranked, matched);
    expect(meta.matchOutcome).toBe("no_match");
    expect(meta.noMatchReason).toBe("no_step_free_products");
    expect(meta.fallbackAvailable).toBe(false);
  });
});
