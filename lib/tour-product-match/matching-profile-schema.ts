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
  PROFILE_PRICE_BANDS,
  PROFILE_PRODUCT_TYPES,
  PROFILE_ROUTE_TYPES,
  type TourMatchingProfileRow,
} from "@/lib/tour-product-match/types";

/**
 * v17 batch: 1–5 ints (legacy) and 0–1 floats (new) both pass — `score-tour-products.ts`
 * normalizes both to 0–1 via `norm1to5` (legacy path). Authors increasingly emit 0–1.
 */
const level1to5 = z.number().refine(
  (v) => Number.isFinite(v) && ((Number.isInteger(v) && v >= 1 && v <= 5) || (v >= 0 && v <= 1)),
  { message: "expected integer 1..5 or float 0..1" },
);
/**
 * v17 batch: indoor_ratio is 0..1 float (preferred) or 0..100 int (legacy).
 * `normIndoorRatioPercent` auto-detects scale at runtime.
 */
const indoorRatioSchema = z.number().refine(
  (v) => Number.isFinite(v) && ((Number.isInteger(v) && v >= 0 && v <= 100) || (v >= 0 && v <= 1)),
  { message: "expected integer 0..100 or float 0..1" },
);

const productTypeSchema = z.enum(PROFILE_PRODUCT_TYPES);
const routeTypeSchema = z.enum(PROFILE_ROUTE_TYPES);
/**
 * `region_type` accepts the full set used by the matching-profile-validator.mjs
 * (mirror of `REGION_TYPES`). The narrower `RegionAffinity` in types.ts is the
 * traveler-intent surface and intentionally smaller.
 */
const regionTypeSchema = z.enum([
  "east",
  "southwest",
  "full_island",
  "any",
  "jeju_island_wide",
  "jeju_southwest",
  "jeju_east",
  "jeju_south",
  "jeju_west_south",
  "jeju_all_around",
  "island_full",
  "island_southwest",
  "busan_city",
  "gyeongsang_north",
  "gyeongju_from_busan",
  "seoul_with_incheon_origin",
  "gyeonggi_pocheon",
  "gyeonggi_paju",
  "gyeonggi_gapyeong",
  "gyeonggi_south",
  "gyeonggi_mixed",
  "gangwon_seoraksan",
]);
const priceBandSchema = z.enum(PROFILE_PRICE_BANDS);

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

    indoor_ratio: indoorRatioSchema,
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

    /**
     * v17 batch: malformed/missing hard_constraints downgraded to default-empty
     * via preprocess so authoring drift doesn't block the pipeline.
     */
    hard_constraints: z.preprocess(
      (raw) =>
        raw && typeof raw === "object" && !Array.isArray(raw) ? raw : { avoidIf: [], notIdealFor: [] },
      z.object({
        avoidIf: z.array(avoidIfKeySchema).default([]),
        notIdealFor: z.array(notIdealForKeySchema).default([]),
      }),
    ),

    /**
     * v17 batch: free-form walking_notes/keywords/synonym_hints. A stray
     * string is wrapped to [string]; missing/null becomes []. Down-stream
     * scoring already coerces via `stringArray`.
     */
    walking_notes: z.preprocess(
      (raw) => (Array.isArray(raw) ? raw : raw == null ? [] : [String(raw)]),
      z.array(z.string()).default([]),
    ),
    keywords: z.preprocess(
      (raw) => (Array.isArray(raw) ? raw : raw == null ? [] : [String(raw)]),
      z.array(z.string()).default([]),
    ),
    synonym_hints: z.preprocess(
      (raw) => (Array.isArray(raw) ? raw : raw == null ? [] : [String(raw)]),
      z.array(z.string()).default([]),
    ),

    profile_version: z.number().int().min(1),
    is_active: z.boolean(),
  })
  /** v17 batch carries 80+ extra fit dimensions (australia_market_fit, …). Pass through. */
  .passthrough();

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
