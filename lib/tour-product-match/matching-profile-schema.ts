/**
 * Author-side validator for `matching_profile` blocks embedded in
 * `components/product-tour-static/<slug>/<slug>-tour-product-full-page.<locale>.json`.
 *
 * The live scoring pipeline reads from the `tour_matching_profiles` Supabase
 * table; this schema is what JSON authors and SQL generator scripts cross-check
 * against so the three surfaces (authoring JSON, seed profiles, SQL upserts)
 * never drift.
 *
 * NOTE: Keep the `RegionType`, `KNOWN_AVOID_IF_KEYS`, `KNOWN_NOT_IDEAL_FOR_KEYS`
 * sets in sync with `lib/tour-product-match/types.ts` and the exclusion
 * branches in `lib/tour-product-match/score-tour-products.ts#shouldHardExclude`.
 */

import { z } from "zod";

import {
  KNOWN_AVOID_IF_KEYS,
  KNOWN_NOT_IDEAL_FOR_KEYS,
  type TourMatchingProfileRow,
} from "@/lib/tour-product-match/types";

const level1to5 = z.number().int().min(1).max(5);
const ratio0to100 = z.number().int().min(0).max(100);

const productTypeSchema = z.enum(["small_group", "private", "bus"]);
const routeTypeSchema = z.enum(["fixed_route", "flexible", "loop"]);
// Matches `RegionAffinity` in types.ts.
const regionTypeSchema = z.enum(["east", "southwest", "full_island", "any"]);
const priceBandSchema = z.enum(["budget", "mid", "premium"]);

/**
 * `shouldHardExclude` only enforces the known keys; any extra string is allowed
 * so authors can document non-enforcing hints, but we emit a warning for them.
 */
const avoidIfKeySchema = z.string().min(1);
const notIdealForKeySchema = z.string().min(1);

export const matchingProfileSchema = z
  .object({
    product_type: productTypeSchema,
    route_type: routeTypeSchema,
    region_type: regionTypeSchema,

    region_tags: z.array(z.string()).default([]),
    theme_tags: z.array(z.string()).default([]),
    poi_tags: z.array(z.string()).default([]),

    pace_level: level1to5,
    walking_level: level1to5,
    scenic_level: level1to5,
    photo_level: level1to5,
    culture_level: level1to5,
    relax_level: level1to5,

    first_time_fit: level1to5,
    family_fit: level1to5,
    senior_fit: level1to5,
    couple_fit: level1to5,
    active_traveler_fit: level1to5,
    one_day_fit: level1to5,
    same_day_flight_fit: level1to5,
    rain_fit: level1to5,
    value_for_money_fit: level1to5,
    iconic_landmark_fit: level1to5,
    cafe_fit: level1to5,

    adult_family_fit: level1to5,
    young_kids_fit: level1to5,
    senior_active_fit: level1to5,
    senior_general_fit: level1to5,
    mobility_friendly_fit: level1to5,
    stroller_fit: level1to5,

    indoor_ratio: ratio0to100,
    weather_sensitivity: level1to5,

    local_culture_fit: level1to5,
    shopping_fit: level1to5,
    storytelling_fit: level1to5,

    comfort_level: level1to5,
    budget_fit: level1to5,
    premium_fit: level1to5,

    small_group_fit: level1to5,
    private_fit: level1to5,
    bus_fit: level1to5,
    price_band: priceBandSchema,

    pickup_base: z.string().min(1),
    return_time_band: z.string().min(1),
    duration_band: z.string().min(1),
    min_recommended_age: z.number().int().min(0).max(99),

    hard_constraints: z.object({
      avoidIf: z.array(avoidIfKeySchema).default([]),
      notIdealFor: z.array(notIdealForKeySchema).default([]),
    }),

    walking_notes: z.array(z.string()).default([]),
    keywords: z.array(z.string()).default([]),
    synonym_hints: z.array(z.string()).default([]),

    profile_version: z.number().int().min(1),
    is_active: z.boolean(),
  })
  .strict();

export type MatchingProfileInput = z.infer<typeof matchingProfileSchema>;

export type MatchingProfileValidationIssue =
  | { level: "error"; path: string; message: string }
  | { level: "warn"; path: string; message: string };

export type MatchingProfileValidationResult = {
  ok: boolean;
  value: MatchingProfileInput | null;
  issues: MatchingProfileValidationIssue[];
};

/**
 * Strict parse + soft warnings for non-canonical hard-constraint keys.
 * Non-canonical keys still reach Supabase (they serialize to the JSONB column)
 * but they will NOT trigger any exclusion branch in `shouldHardExclude`, which
 * is usually a bug.
 */
export function validateMatchingProfile(
  raw: unknown,
): MatchingProfileValidationResult {
  const parsed = matchingProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      value: null,
      issues: parsed.error.issues.map((issue) => ({
        level: "error",
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    };
  }

  const warnings: MatchingProfileValidationIssue[] = [];
  const avoidIfKnown = new Set<string>(KNOWN_AVOID_IF_KEYS);
  const notIdealForKnown = new Set<string>(KNOWN_NOT_IDEAL_FOR_KEYS);

  for (const k of parsed.data.hard_constraints.avoidIf) {
    if (!avoidIfKnown.has(k)) {
      warnings.push({
        level: "warn",
        path: "hard_constraints.avoidIf",
        message: `"${k}" is not a known canonical avoidIf key (no shouldHardExclude branch consumes it). Accepted keys: ${Array.from(avoidIfKnown).join(", ")}`,
      });
    }
  }
  for (const k of parsed.data.hard_constraints.notIdealFor) {
    const tolerated = notIdealForKnown.has(k) || k.includes("stroller");
    if (!tolerated) {
      warnings.push({
        level: "warn",
        path: "hard_constraints.notIdealFor",
        message: `"${k}" is not a known canonical notIdealFor key. Accepted keys: ${Array.from(notIdealForKnown).join(", ")} (or any value containing "stroller")`,
      });
    }
  }

  // Guard against the legacy `"all_around"` literal that used to appear in
  // authoring JSONs — Zod will have already caught it via the enum, but if a
  // future region synonym slips through we want a clear hint.
  return { ok: true, value: parsed.data, issues: warnings };
}

/** Narrowing helper for downstream code that receives a row-shape after validation. */
export function toMatchingProfileRow(
  slug: string,
  profile: MatchingProfileInput,
): Omit<TourMatchingProfileRow, "region_tags" | "theme_tags" | "poi_tags" | "walking_notes" | "keywords" | "synonym_hints"> & {
  region_tags: string[];
  theme_tags: string[];
  poi_tags: string[];
  walking_notes: string[];
  keywords: string[];
  synonym_hints: string[];
} {
  return {
    product_id: slug,
    ...profile,
  };
}
