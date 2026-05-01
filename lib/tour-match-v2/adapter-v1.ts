/**
 * Adapter: v2 (parsed_query / top_matches) → v1 (TravelerIntentV1 / ScoredProduct / matchOutcome / etc.)
 *
 * Existing frontend (`/match` page, `HomeV2MatchProvider`) consumes the v1 shape.
 * This adapter lets the API route serve dual-shape responses without breaking
 * those consumers while v2 fields are also exposed for new code.
 */

import type {
  ResolvedProductTypeIntentSnapshot,
  ScoredProduct,
  TourMatchApiResponse,
  TourMatchOutcome,
  TourMatchNoMatchReason,
  TravelerIntentV1,
} from "@/lib/tour-product-match/types";
import type { MatchResponseV2, ParsedQueryV2, ScoredMatchV2 } from "./types";

function regionToAffinity(regions: string[]): TravelerIntentV1["region_affinity"] {
  if (!regions.length) return null;
  const r = regions[0];
  if (r === "jeju") return "jeju_island_wide";
  // The narrower v1 RegionAffinity covers east/southwest/full_island/any/jeju_*; for non-jeju regions return null.
  return null;
}

function deriveProductType(parsed: ParsedQueryV2): TravelerIntentV1["desired_product_type"] {
  if (parsed.format === "private" || parsed.format === "charter") return "private";
  if (parsed.format === "small_group") return "small_group";
  if (parsed.format === "bus_tour") return "bus";
  return null;
}

export function v2ParsedToTravelerIntent(parsed: ParsedQueryV2): TravelerIntentV1 {
  const desired = deriveProductType(parsed);
  return {
    desired_product_type: desired,
    product_type_intent_strength: desired ? "soft" : null,
    pace_preference: parsed.pace === "relaxed" ? 2 : parsed.pace === "active" ? 4 : null,
    walking_tolerance: parsed.pace === "relaxed" ? 2 : parsed.pace === "active" ? 4 : null,
    scenic_importance: null,
    photo_importance: null,
    culture_importance: null,
    relax_importance: null,
    first_time_jeju: null,
    with_family: parsed.personas.includes("families") || parsed.personas.includes("family_with_young_kids") || parsed.personas.includes("family_with_teens"),
    with_seniors: parsed.personas.includes("senior_couples"),
    with_kids: parsed.personas.includes("family_with_young_kids"),
    one_day_only: parsed.duration_constraint === "day_trip",
    same_day_flight: parsed.hard_constraints.includes("same_day_flight"),
    rain_sensitive: false,
    value_focus: null,
    iconic_importance: null,
    cafe_importance: null,
    region_affinity: regionToAffinity(parsed.regions),
    confidence: parsed.confidence,
    summary_one_line: parsed.parser_notes,
    mobility: parsed.hard_constraints.includes("wheelchair") ? "low" : null,
    toddlers: parsed.personas.includes("family_with_young_kids"),
    stroller_heavy: null,
  };
}

function v2ScoredToScoredProduct(m: ScoredMatchV2): ScoredProduct {
  return {
    product_id: m.slug,
    score: m.total_score,
    breakdown: m.score_components as Record<string, number>,
    excluded: false,
    excludeReason: null,
  };
}

/** When NO_MATCH is reported and the rejected_summary or notes mention a
 *  seasonal contradiction (e.g. "5월 벚꽃"), surface a more specific reason
 *  to legacy v1 consumers. Heuristic — only used when the gate's reason text
 *  is observable in notes. */
function detectSeasonalContradiction(v2: MatchResponseV2): boolean {
  if (v2.match_status !== "NO_MATCH") return false;
  const haystack = (v2.notes ?? []).join(" ").toLowerCase();
  return haystack.includes("contradiction") || haystack.includes("seasonal_contradiction");
}

export function buildV1Response(
  parsed: ParsedQueryV2,
  v2: MatchResponseV2,
  matchExplanation: string | null = null,
  weightSet = "v1.8",
): Pick<
  TourMatchApiResponse,
  | "intent"
  | "winner"
  | "matchedProducts"
  | "ranked"
  | "matchOutcome"
  | "noMatchReason"
  | "resolvedProductTypeIntent"
  | "textParserProductTypeIntent"
  | "fallbackAvailable"
  | "profileSource"
  | "weightSet"
  | "matchExplanation"
> {
  const intent = v2ParsedToTravelerIntent(parsed);
  const top = v2.top_matches.map(v2ScoredToScoredProduct);
  const winner = top[0] ?? null;
  const matched = top.slice(0, 5);
  // STRONG_MATCH / WEAK_MATCH → matched ; NO_MATCH / INSUFFICIENT_INPUT → no_match.
  // Falls back to length check for any caller still on the older response shape.
  const matchOutcome: TourMatchOutcome =
    v2.match_status === "STRONG_MATCH" || v2.match_status === "WEAK_MATCH"
      ? "matched"
      : top.length
        ? "matched"
        : "no_match";
  const noMatchReason: TourMatchNoMatchReason | null =
    matchOutcome === "matched"
      ? null
      : v2.match_status === "INSUFFICIENT_INPUT"
        ? "insufficient_input"
        : detectSeasonalContradiction(v2)
          ? "seasonal_contradiction"
          : "all_products_excluded";

  const productTypeSnap: ResolvedProductTypeIntentSnapshot = {
    desired_product_type: intent.desired_product_type,
    product_type_intent_strength: intent.product_type_intent_strength,
  };

  return {
    intent,
    winner,
    matchedProducts: matched,
    ranked: top,
    matchOutcome,
    noMatchReason,
    resolvedProductTypeIntent: productTypeSnap,
    textParserProductTypeIntent: productTypeSnap,
    fallbackAvailable: matchOutcome === "no_match",
    profileSource: "supabase",
    weightSet,
    matchExplanation,
  };
}
