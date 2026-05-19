/**
 * POI-level scoring for the AI itinerary recommender (Phase 7).
 *
 * Adapts the matcher v2 dimension scoring to operate on a single POI's
 * `matching_profile` (instead of a full tour). The user intent (parsed via
 * Haiku parser) supplies `boost_dimensions`, `themes`, `personas`,
 * `season_locks`, and `negative_signals` — we score each POI by how well
 * its profile satisfies those signals.
 */

import type { ParsedQueryV2 } from "@/lib/tour-match-v2/types";
import {
  CURATED_POI_PROFILE_SOURCE,
  mergeCuratedPoiProfile,
} from "./poi-profile-overrides";

export interface ScorablePoiRow {
  poi_key: string;
  name_en: string;
  region: string;
  category: string | null;
  default_image_url: string | null;
  default_stay_minutes: number | null;
  lat: number;
  lng: number;
  matching_profile: Record<string, unknown> | null;
  poi_meta?: Record<string, unknown> | null;
  stop_role?: string | null;
  is_attraction?: boolean | null;
  is_operational?: boolean | null;
  builder_profile_source?: string | null;
  builder_profile_version?: number | null;
}

export interface PoiScore {
  poi: ScorablePoiRow;
  total: number;
  components: Record<string, number>;
}

function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/**
 * Map theme/persona/season_lock tokens to canonical `<token>_fit` keys
 * on the POI matching_profile. Matcher v2 already standardized these.
 */
function fitKey(token: string): string {
  return `${token}_fit`;
}

const THEME_DIM_ALIASES: Record<string, string[]> = {
  beach: ["beach_fit", "coastal_fit"],
  cafe: ["cafe_fit"],
  first_time_highlights: ["first_time_fit", "iconic_landmark_fit"],
  food_market: ["food_market_fit", "market_fit", "street_food_fit", "seafood_market_fit"],
  unesco_world_heritage: [
    "unesco_fit",
    "unesco_world_heritage_fit",
    "world_natural_heritage_fit",
  ],
  buddhist_temple: ["buddhist_temple_fit"],
  lava_tube_cave: ["cave_fit", "rain_fit", "indoor_ratio"],
  tea_culture: ["tea_culture_fit", "cafe_fit"],
  haenyeo_culture: ["haenyeo_culture_fit", "museum_fit", "history_culture_fit"],
  scenic_drive: ["scenic_level", "nature_fit", "photo_fit"],
  k_drama_filming: ["k_drama_filming_fit", "photo_fit"],
  shopping: ["shopping_fit", "market_fit"],
  library_modern_architecture: ["modern_architecture_fit", "museum_fit"],
};

const PERSONA_DIM_ALIASES: Record<string, string[]> = {
  families: ["family_fit", "kid_friendly_fit"],
  family_with_young_kids: [
    "young_kids_fit",
    "kid_friendly_fit",
    "stroller_friendly_fit",
    "family_fit",
  ],
  family_with_teens: ["family_fit", "photo_fit", "active_level"],
  senior_couples: ["senior_fit", "mobility_friendly_fit", "relaxed_pace_fit"],
  history_lovers: ["history_culture_fit", "culture_level", "museum_fit"],
  culture_lovers: ["history_culture_fit", "culture_level"],
  couples: ["couple_fit", "photo_fit", "relaxed_pace_fit"],
  honeymooners: ["honeymoon_fit", "photo_fit", "cafe_fit", "relaxed_pace_fit"],
  photographers: ["photo_fit", "photo_level", "scenic_level"],
  k_drama_fans: ["k_drama_filming_fit", "photo_fit"],
  cruise_passengers: ["cruise_logistics_fit"],
};

const NEGATIVE_SIGNAL_DIMS: Record<string, string[]> = {
  active_traveler: ["active_level", "walking_difficulty", "active_traveler_fit"],
  museum: ["museum_fit", "indoor_ratio"],
  indoor: ["indoor_ratio", "rain_fit"],
  shopping: ["shopping_fit", "market_fit", "food_market_fit", "street_food_fit"],
  cafe: ["cafe_fit"],
  beach: ["beach_fit", "coastal_fit", "coastal_cliff_fit"],
  no_seasonal: [
    "cherry_blossom_fit",
    "canola_flower_fit",
    "hydrangea_fit",
    "summer_flowers_hydrangea_fit",
    "winter_camellia_bloom_fit",
    "tangerine_fit",
    "tangerine_picking_winter_fit",
  ],
};

function maxDim(mp: Record<string, unknown>, dims: string[]): number {
  let best = 0;
  for (const dim of dims) best = Math.max(best, asNumber(mp[dim]));
  return best;
}

function addComponent(components: Record<string, number>, key: string, value: number): void {
  if (value === 0) return;
  components[key] = Number(((components[key] ?? 0) + value).toFixed(3));
}

export function scorePoi(poi: ScorablePoiRow, parsed: ParsedQueryV2): PoiScore {
  const components: Record<string, number> = {};
  const mp = resolvePoiMatchingProfile(poi);

  // 1. boost_dimensions — direct multiplier per dim.
  //    Per-dim floor 0.4: tiny tag values (e.g. matching_profile says
  //    beach_fit=0.2 on a temple) don't accumulate into noise. Strong
  //    matches are 0.7+; the 0.4 floor preserves "moderate" matches
  //    without letting weak-noise polish a wrong category to relevance.
  //    Defends against the matching_profile data-pollution pattern we
  //    found in busan (UN Memorial Cemetery scoring on beach + cafe).
  let boostSum = 0;
  for (const [dim, weight] of Object.entries(parsed.boost_dimensions || {})) {
    const candidates = dim === "walking_level"
      ? ["active_level", "walking_difficulty", "active_traveler_fit"]
      : dim === "relax_level" || dim === "pace_level"
        ? [dim, "relaxed_pace_fit"]
        : [dim];
    const v = maxDim(mp, candidates);
    if (v >= 0.35) boostSum += v * Math.max(0, weight);
  }
  if (boostSum > 0) components.boost_dimensions = Number(boostSum.toFixed(3));

  // 2. theme overlap — POI dimensions matching user themes.
  // Use max-alias scoring so one beach POI does not double-count both
  // `beach_fit` and `coastal_fit` as separate "themes".
  let themeOverlap = 0;
  for (const t of parsed.themes || []) {
    const dims = THEME_DIM_ALIASES[t] ?? [fitKey(t)];
    const v = maxDim(mp, dims);
    if (v > 0) themeOverlap += v;
  }
  if (themeOverlap > 0) components.theme_overlap = Number((themeOverlap * 1.8).toFixed(3));

  // 3. persona alignment. Persona is strong but should not rescue a bad
  // category match by itself, so it is weighted below direct theme boosts.
  let personaAlign = 0;
  for (const p of parsed.personas || []) {
    const dims = PERSONA_DIM_ALIASES[p] ?? [fitKey(p)];
    const v = maxDim(mp, dims);
    if (v > 0) personaAlign += v * 1.4;
  }
  if (personaAlign > 0) components.persona_align = Number(personaAlign.toFixed(3));

  // 4. season_lock match (e.g. cherry_blossom, hydrangea)
  let seasonScore = 0;
  for (const s of parsed.season_locks || []) {
    const v = maxDim(mp, [fitKey(s), s]);
    if (v > 0) seasonScore += v * 4.0;
  }
  if (seasonScore > 0) components.season_lock = Number(seasonScore.toFixed(3));

  // 5. Multi-theme composition. If the user asks for "beach + cafe", a pure
  // coastal viewpoint should not crowd out actual cafe/beach pairs.
  if ((parsed.themes ?? []).includes("cafe") && (parsed.themes ?? []).includes("beach")) {
    const cafe = maxDim(mp, ["cafe_fit"]);
    const water = maxDim(mp, ["beach_fit", "coastal_fit"]);
    addComponent(components, "beach_cafe_combo", Math.min(cafe, water) * 2.2);
    if (cafe < 0.25) addComponent(components, "missing_cafe_penalty", -1.1);
  }

  // 6. First-time / must-see intent is common in presets but is not a
  // classic matcher v2 theme. Let it rank iconic stops without forcing every
  // iconic stop into every query.
  const firstTimeIntent = Math.max(
    asNumber(parsed.boost_dimensions?.first_time_fit),
    asNumber(parsed.boost_dimensions?.must_see_fit),
    parsed.themes?.includes("first_time_highlights") ? 1 : 0
  );
  if (firstTimeIntent > 0) {
    const firstTimeScore = maxDim(mp, ["first_time_fit", "iconic_landmark_fit"]);
    if (firstTimeScore > 0) {
      addComponent(components, "first_time_fit", firstTimeScore * firstTimeIntent * 1.4);
    }
  }

  // 7. Easy-walking intent: parser expresses this as boost dimensions and a
  // negative active signal. Reward accessible stops and separately penalize
  // high walking difficulty below.
  const easyIntent = Math.max(
    asNumber(parsed.boost_dimensions?.mobility_friendly_fit),
    asNumber(parsed.boost_dimensions?.stroller_friendly_fit),
    asNumber(parsed.boost_dimensions?.easy_walking_fit)
  );
  if (easyIntent > 0) {
    const easyScore = maxDim(mp, [
      "mobility_friendly_fit",
      "stroller_friendly_fit",
      "senior_fit",
      "relaxed_pace_fit",
    ]);
    addComponent(components, "easy_walking_match", easyScore * easyIntent * 1.6);
  }

  // 8. iconic landmark base bonus — gated by relevance.
  //    The earlier version handed every famous POI a free 0.5, which
  //    meant any iconic POI surfaced in any query — even when nothing
  //    in the parsed intent actually fit it. Now we require at least
  //    one real relevance signal (theme overlap, persona, season, or
  //    a meaningful boost_sum) before the baseline fires.
  const iconic = asNumber(mp.iconic_landmark_fit);
  const hasRelevance =
    (components.theme_overlap ?? 0) > 0 ||
    (components.persona_align ?? 0) > 0 ||
    (components.season_lock ?? 0) > 0 ||
    boostSum >= 0.8;
  if (iconic > 0.7 && hasRelevance) {
    components.iconic_landmark_baseline = Number((iconic * 0.5).toFixed(3));
  }

  // 9. anchor_poi mentioned directly by user
  if ((parsed.anchor_pois_mentioned || []).includes(poi.poi_key)) {
    components.anchor_poi_mentioned = 6;
  }

  // 10. negative_signal penalty
  let negPenalty = 0;
  for (const n of parsed.negative_signals || []) {
    const dims = NEGATIVE_SIGNAL_DIMS[n] ?? [fitKey(n)];
    const v = maxDim(mp, dims);
    if (v > 0.35) negPenalty -= v * 4.5;
  }
  if (negPenalty !== 0) components.negative_penalty = Number(negPenalty.toFixed(3));

  // 11. hard_constraint adherence — wheelchair etc.
  const hc = new Set(parsed.hard_constraints || []);
  if (hc.has("wheelchair")) {
    const wa = asNumber(mp.wheelchair_accessible_anchor_fit);
    const mob = asNumber(mp.mobility_friendly_fit);
    if (wa >= 0.5 || mob >= 0.7) components.wheelchair_match = 2;
    else components.wheelchair_match = -8; // strong penalty if inaccessible
  }

  const total = Object.values(components).reduce((a, b) => a + b, 0);
  return { poi, total: Number(total.toFixed(3)), components };
}

function resolvePoiMatchingProfile(poi: ScorablePoiRow): Record<string, unknown> {
  if (poi.builder_profile_source === CURATED_POI_PROFILE_SOURCE) {
    return poi.matching_profile ?? {};
  }
  return mergeCuratedPoiProfile(poi.poi_key, poi.matching_profile);
}
