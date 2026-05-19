import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { parseQuery } from "@/lib/tour-match-v2/parser";
import { ruleParse } from "@/lib/tour-match-v2/parser-rule";
import type { ParsedQueryV2 } from "@/lib/tour-match-v2/types";
import { REGION_CENTER, REGION_CLUSTER, isRegionSlug, type RegionSlug } from "@/lib/itinerary-builder/regions";
import { driveMinutes } from "@/lib/itinerary-builder/distance";
import { scorePoi, type ScorablePoiRow } from "@/lib/itinerary-match-engine/score-poi";
import { sequence, tourDriveMin } from "@/lib/itinerary-match-engine/sequence";
import {
  buildPoiRationale,
  isBuilderAttraction,
  metadataScoreAdjustment,
  resolveBuilderOrigin,
} from "@/lib/itinerary-match-engine/poi-taxonomy";

/**
 * POST /api/itinerary/match — Phase 7 AI recommendation engine.
 *
 * Pipeline:
 *   1. parseQuery(intent) via Gemini Haiku → ParsedQueryV2 (regions, themes,
 *      personas, season_locks, anchor_pois, boost_dimensions, etc.)
 *   2. Fetch match_pois in the region's cluster with matching_profile
 *      populated (from Phase 6 derivation).
 *   3. score each POI against the parsed intent.
 *   4. pickDiverse → greedyRoute (TSP) → trimToBudget.
 *   5. Return ordered poi_keys + per-POI score breakdown + total drive
 *      minutes. Optional explainer rationale deferred to client (cheaper
 *      to render from the breakdown).
 *
 * Body shape:
 *   { intent: string, region: 'busan' | 'jeju', locale?: string,
 *     max_pois?: number = 7, max_hours?: number = 8 }
 */

interface MatchBody {
  intent?: unknown;
  region?: unknown;
  locale?: unknown;
  max_pois?: unknown;
  max_hours?: unknown;
  track?: unknown;
  origin?: unknown;
}

const DEFAULT_MAX_POIS = 7;
const DEFAULT_MAX_HOURS = 8;

export async function POST(request: Request) {
  let body: MatchBody;
  try {
    body = (await request.json()) as MatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const intent = typeof body.intent === "string" ? body.intent.trim() : "";
  if (!intent || intent.length < 2) {
    return NextResponse.json({ ok: false, error: "intent_required" }, { status: 400 });
  }

  const region = typeof body.region === "string" ? body.region : "";
  if (!isRegionSlug(region)) {
    return NextResponse.json({ ok: false, error: "region_invalid" }, { status: 400 });
  }

  const maxPois = clampInt(body.max_pois, DEFAULT_MAX_POIS, 1, 10);
  const maxHours = clampInt(body.max_hours, DEFAULT_MAX_HOURS, 2, 14);
  const track = typeof body.track === "string" ? body.track : null;
  const originKey = typeof body.origin === "string" ? body.origin : null;

  const supabase = createServerClient();

  // 1. Parse intent via Haiku (falls back to rule parser if API fails)
  let parsed: ParsedQueryV2;
  try {
    parsed = mergeBuilderParserHints(await parseQuery(intent, "auto"), ruleParse(intent), {
      region: region as RegionSlug,
      track,
      originKey,
    });
  } catch (e) {
    console.error("[/api/itinerary/match] parser error:", e);
    return NextResponse.json(
      { ok: false, error: "parser_failed", message: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }

  // 2. Fetch POIs in region cluster
  const cluster = REGION_CLUSTER[region as RegionSlug];
  const { data: poiRows, error: poiErr } = await supabase
    .from("match_pois")
    .select("poi_key, name_en, region, category, default_image_url, default_stay_minutes, lat, lng, matching_profile, poi_meta, stop_role, is_attraction, is_operational, builder_profile_source, builder_profile_version")
    .in("region", cluster as unknown as string[])
    .not("name_en", "is", null)
    .not("lat", "is", null);

  if (poiErr) {
    console.error("[/api/itinerary/match] POI fetch error:", poiErr);
    return NextResponse.json({ ok: false, error: "poi_fetch_failed" }, { status: 500 });
  }

  const pois = ((poiRows ?? []) as ScorablePoiRow[]).filter((p) =>
    p.is_attraction === true || (p.is_attraction == null && isBuilderAttraction(p.poi_key))
  );
  if (pois.length === 0) {
    return NextResponse.json({ ok: false, error: "no_pois_in_region" }, { status: 404 });
  }

  // 3. Score each POI
  const origin = resolveBuilderOrigin(region as RegionSlug, track, originKey);
  const scoringOrigin = origin ?? REGION_CENTER[region as RegionSlug];
  const rawScored = pois
    .map((poi) => applyComfortAdjustment(applyMetadataAdjustment(scorePoi(poi, parsed), parsed), parsed, scoringOrigin))
    .filter((s) => s.total > 0); // drop zero/negative-score POIs
  const scored = applyScoreFloor(rawScored);

  if (scored.length === 0) {
    return NextResponse.json({
      ok: true,
      region,
      recommended_pois: [],
      total_drive_min: 0,
      total_stay_min: 0,
      message: "No POIs match the requested intent strongly enough; try broader interests or a different region.",
      parser_notes: parsed.parser_notes,
    });
  }

  // 4. Diversity → sequence → budget
  const ordered = sequence(scored, { maxPois, maxHours, region: region as RegionSlug, origin });

  // 5. Compute drive + stay totals
  const driveMin = tourDriveMin(ordered, region as RegionSlug, origin);
  const stayMin = ordered.reduce((s, p) => s + (p.default_stay_minutes ?? 0), 0);

  // 6. Build per-POI breakdown for client
  const scoreByKey = new Map(scored.map((s) => [s.poi.poi_key, s]));
  const breakdown = ordered.map((p) => {
    const s = scoreByKey.get(p.poi_key)!;
    return {
      poi_key: p.poi_key,
      name_en: p.name_en,
      total: s.total,
      components: s.components,
      rationale: buildPoiRationale(p, s.components, parsed),
    };
  });

  return NextResponse.json({
    ok: true,
    region,
    recommended_pois: ordered.map((p) => p.poi_key),
    per_poi_score: breakdown,
    total_drive_min: driveMin,
    total_stay_min: stayMin,
    total_minutes: driveMin + stayMin,
    parsed: {
      themes: parsed.themes,
      personas: parsed.personas,
      season_locks: parsed.season_locks,
      anchor_pois_mentioned: parsed.anchor_pois_mentioned,
      boost_dimensions: parsed.boost_dimensions,
      negative_signals: parsed.negative_signals,
      confidence: parsed.confidence,
      sub_regions: parsed.sub_regions,
      wants_cruise: parsed.wants_cruise,
    },
    diagnostics: {
      candidates_before_filter: rawScored.length,
      candidates_after_floor: scored.length,
      score_floor: scoreFloor(rawScored),
      origin: originKey || (track === "cruise" ? `${region}_cruise_port` : `${region}_center`),
    },
  });
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function applyScoreFloor<T extends { total: number }>(scored: T[]): T[] {
  if (scored.length === 0) return scored;
  const floor = scoreFloor(scored);
  return scored.filter((s) => s.total >= floor);
}

function scoreFloor(scored: { total: number }[]): number {
  if (scored.length === 0) return 0;
  const top = Math.max(...scored.map((s) => s.total));
  return Number(Math.max(0.9, top * 0.42).toFixed(3));
}

function applyMetadataAdjustment<T extends { poi: ScorablePoiRow; total: number; components: Record<string, number> }>(
  score: T,
  parsed: Awaited<ReturnType<typeof parseQuery>>
): T {
  const adjustment = metadataScoreAdjustment(score.poi, parsed);
  if (adjustment === 0) return score;
  const componentKey = adjustment > 0 ? "sub_region_match" : "sub_region_mismatch";
  return {
    ...score,
    total: Number((score.total + adjustment).toFixed(3)),
    components: {
      ...score.components,
      [componentKey]: adjustment,
    },
  };
}

function mergeBuilderParserHints(
  parsed: ParsedQueryV2,
  ruleParsed: ParsedQueryV2,
  context: { region: RegionSlug; track: string | null; originKey: string | null }
): ParsedQueryV2 {
  const subRegions = unique([
    ...(parsed.sub_regions ?? []),
    ...(ruleParsed.sub_regions ?? []),
    ...defaultSubRegionsForOrigin(context.region, context.track, context.originKey),
  ]);
  const themes = unique([...(parsed.themes ?? []), ...(ruleParsed.themes ?? [])]);
  const personas = unique([...(parsed.personas ?? []), ...(ruleParsed.personas ?? [])]);
  const anchorPois = unique([
    ...(parsed.anchor_pois_mentioned ?? []),
    ...(ruleParsed.anchor_pois_mentioned ?? []),
  ]);
  const negativeSignals = unique([
    ...(parsed.negative_signals ?? []),
    ...(ruleParsed.negative_signals ?? []),
  ]);
  const boostDimensions: Record<string, number> = { ...(parsed.boost_dimensions ?? {}) };
  for (const [dim, weight] of Object.entries(ruleParsed.boost_dimensions ?? {})) {
    boostDimensions[dim] = Math.max(boostDimensions[dim] ?? 0, weight);
  }
  if (!/\bcliffs?\b/i.test(parsed.raw_query ?? ruleParsed.raw_query ?? "")) {
    delete boostDimensions.coastal_cliff_fit;
  }

  return {
    ...parsed,
    sub_regions: subRegions,
    themes,
    personas,
    anchor_pois_mentioned: anchorPois,
    negative_signals: negativeSignals,
    boost_dimensions: boostDimensions,
  };
}

function defaultSubRegionsForOrigin(
  region: RegionSlug,
  track: string | null,
  originKey: string | null
): string[] {
  if (track !== "cruise") return [];
  if (region === "busan") return ["busan_core"];
  if (originKey === "gangjeong_cruise_port") return ["jeju_southern"];
  return ["jeju_north", "jeju_east"];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function applyComfortAdjustment<T extends { poi: ScorablePoiRow; total: number; components: Record<string, number> }>(
  score: T,
  parsed: ParsedQueryV2,
  origin?: { lat: number; lng: number }
): T {
  const comfortIntent = Math.max(
    Number(parsed.boost_dimensions?.easy_walking_fit ?? 0),
    Number(parsed.boost_dimensions?.mobility_friendly_fit ?? 0),
    parsed.personas?.includes("senior_couples") ? 1 : 0,
    parsed.negative_signals?.includes("active_traveler") ? 0.8 : 0
  );
  if (comfortIntent <= 0 || !origin) return score;
  if ((score.components.sub_region_match ?? 0) > 0) return score;

  const oneWay = driveMinutes(origin, { lat: score.poi.lat, lng: score.poi.lng });
  const penalty = oneWay > 95 ? -4.0 : oneWay > 75 ? -2.5 : oneWay > 60 ? -1.2 : 0;
  if (penalty === 0) return score;

  const weightedPenalty = Number((penalty * Math.min(1.4, comfortIntent)).toFixed(3));
  return {
    ...score,
    total: Number((score.total + weightedPenalty).toFixed(3)),
    components: {
      ...score.components,
      drive_comfort_penalty: weightedPenalty,
    },
  };
}
