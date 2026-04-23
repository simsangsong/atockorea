import { createServerClient } from "@/lib/supabase";
import { SEED_TOUR_MATCHING_PROFILES } from "@/lib/tour-product-match/seed-profiles";
import type { HardConstraintsJson, TourMatchingProfileRow } from "@/lib/tour-product-match/types";

/**
 * Scoring + keyword boost only — omit heavy JSON not used by `score-tour-products`
 * (`region_tags`, `theme_tags`, `poi_tags`, `walking_notes`).
 */
export const TOUR_MATCHING_PROFILE_COLUMNS = [
  "product_id",
  "product_type",
  "route_type",
  "region_type",
  "pace_level",
  "walking_level",
  "scenic_level",
  "photo_level",
  "culture_level",
  "relax_level",
  "first_time_fit",
  "family_fit",
  "senior_fit",
  "couple_fit",
  "active_traveler_fit",
  "one_day_fit",
  "same_day_flight_fit",
  "rain_fit",
  "value_for_money_fit",
  "iconic_landmark_fit",
  "cafe_fit",
  "adult_family_fit",
  "young_kids_fit",
  "senior_active_fit",
  "senior_general_fit",
  "mobility_friendly_fit",
  "stroller_fit",
  "indoor_ratio",
  "weather_sensitivity",
  "local_culture_fit",
  "shopping_fit",
  "storytelling_fit",
  "comfort_level",
  "budget_fit",
  "premium_fit",
  "small_group_fit",
  "private_fit",
  "bus_fit",
  "price_band",
  "pickup_base",
  "return_time_band",
  "duration_band",
  "min_recommended_age",
  "hard_constraints",
  "keywords",
  "synonym_hints",
  "profile_version",
  "is_active",
].join(",");

function asNum(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapDbRow(r: Record<string, unknown>): TourMatchingProfileRow {
  const hc = r.hard_constraints;
  return {
    product_id: String(r.product_id),
    product_type: String(r.product_type ?? ""),
    route_type: String(r.route_type ?? ""),
    region_type: String(r.region_type ?? ""),
    region_tags: r.region_tags ?? [],
    theme_tags: r.theme_tags ?? [],
    poi_tags: r.poi_tags ?? [],
    pace_level: asNum(r.pace_level, 3),
    walking_level: asNum(r.walking_level, 3),
    scenic_level: asNum(r.scenic_level, 3),
    photo_level: asNum(r.photo_level, 3),
    culture_level: asNum(r.culture_level, 3),
    relax_level: asNum(r.relax_level, 3),
    first_time_fit: asNum(r.first_time_fit, 3),
    family_fit: asNum(r.family_fit, 3),
    senior_fit: asNum(r.senior_fit, 3),
    couple_fit: asNum(r.couple_fit, 3),
    active_traveler_fit: asNum(r.active_traveler_fit, 3),
    one_day_fit: asNum(r.one_day_fit, 3),
    same_day_flight_fit: asNum(r.same_day_flight_fit, 3),
    rain_fit: asNum(r.rain_fit, 3),
    value_for_money_fit: asNum(r.value_for_money_fit, 3),
    iconic_landmark_fit: asNum(r.iconic_landmark_fit, 3),
    cafe_fit: asNum(r.cafe_fit, 3),
    adult_family_fit: asNum(r.adult_family_fit, 3),
    young_kids_fit: asNum(r.young_kids_fit, 3),
    senior_active_fit: asNum(r.senior_active_fit, 3),
    senior_general_fit: asNum(r.senior_general_fit, 3),
    mobility_friendly_fit: asNum(r.mobility_friendly_fit, 3),
    stroller_fit: asNum(r.stroller_fit, 3),
    indoor_ratio: asNum(r.indoor_ratio, 50),
    weather_sensitivity: asNum(r.weather_sensitivity, 3),
    local_culture_fit: asNum(r.local_culture_fit, 3),
    shopping_fit: asNum(r.shopping_fit, 3),
    storytelling_fit: asNum(r.storytelling_fit, 3),
    comfort_level: asNum(r.comfort_level, 3),
    budget_fit: asNum(r.budget_fit, 3),
    premium_fit: asNum(r.premium_fit, 3),
    small_group_fit: asNum(r.small_group_fit, 5),
    private_fit: asNum(r.private_fit, 1),
    bus_fit: asNum(r.bus_fit, 2),
    price_band: typeof r.price_band === "string" && r.price_band.trim() ? r.price_band.trim() : "mid",
    pickup_base: String(r.pickup_base ?? ""),
    return_time_band: String(r.return_time_band ?? ""),
    duration_band: String(r.duration_band ?? ""),
    min_recommended_age: asNum(r.min_recommended_age, 8),
    hard_constraints:
      hc && typeof hc === "object" && !Array.isArray(hc)
        ? (hc as HardConstraintsJson)
        : { avoidIf: [], notIdealFor: [] },
    walking_notes: r.walking_notes ?? [],
    keywords: r.keywords,
    synonym_hints: r.synonym_hints,
    profile_version: asNum(r.profile_version, 1),
    is_active: Boolean(r.is_active),
  };
}

/**
 * Phase B: `auto` tries Supabase then falls back to seed.
 * Phase A: `seed` forces file-based profiles.
 */
export async function loadMatchingProfilesForMatch(): Promise<{
  rows: TourMatchingProfileRow[];
  source: "seed" | "supabase";
}> {
  const mode = (process.env.TOUR_MATCH_PROFILE_SOURCE ?? "auto").trim().toLowerCase();

  if (mode === "seed") {
    return { rows: SEED_TOUR_MATCHING_PROFILES, source: "seed" };
  }

  const tryDb = async (): Promise<TourMatchingProfileRow[] | null> => {
    try {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from("tour_matching_profiles")
        .select(TOUR_MATCHING_PROFILE_COLUMNS)
        .eq("is_active", true);
      if (error || !data?.length) return null;
      return data.map((row) => mapDbRow(row as unknown as Record<string, unknown>));
    } catch {
      return null;
    }
  };

  if (mode === "supabase") {
    const rows = await tryDb();
    if (!rows?.length) {
      throw new Error("TOUR_MATCH_PROFILE_SOURCE=supabase but no rows returned from tour_matching_profiles");
    }
    return { rows, source: "supabase" };
  }

  const fromDb = await tryDb();
  if (fromDb?.length) {
    return { rows: fromDb, source: "supabase" };
  }
  return { rows: SEED_TOUR_MATCHING_PROFILES, source: "seed" };
}
