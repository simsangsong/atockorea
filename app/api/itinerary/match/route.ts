import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { parseQuery } from "@/lib/tour-match-v2/parser";
import { REGION_CLUSTER, isRegionSlug, type RegionSlug } from "@/lib/itinerary-builder/regions";
import { scorePoi, type ScorablePoiRow } from "@/lib/itinerary-match-engine/score-poi";
import { sequence } from "@/lib/itinerary-match-engine/sequence";
import { totalDriveMinutes } from "@/lib/itinerary-builder/distance";

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

  const supabase = createServerClient();

  // 1. Parse intent via Haiku (falls back to rule parser if API fails)
  let parsed;
  try {
    parsed = await parseQuery(intent, "auto");
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
    .select("poi_key, name_en, region, category, default_image_url, default_stay_minutes, lat, lng, matching_profile")
    .in("region", cluster as unknown as string[])
    .not("name_en", "is", null)
    .not("lat", "is", null);

  if (poiErr) {
    console.error("[/api/itinerary/match] POI fetch error:", poiErr);
    return NextResponse.json({ ok: false, error: "poi_fetch_failed" }, { status: 500 });
  }

  const pois = (poiRows ?? []) as ScorablePoiRow[];
  if (pois.length === 0) {
    return NextResponse.json({ ok: false, error: "no_pois_in_region" }, { status: 404 });
  }

  // 3. Score each POI
  const scored = pois
    .map((poi) => scorePoi(poi, parsed))
    .filter((s) => s.total > 0); // drop zero/negative-score POIs

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
  const ordered = sequence(scored, { maxPois, maxHours, region: region as RegionSlug });

  // 5. Compute drive + stay totals
  const driveMin = totalDriveMinutes(ordered.map((p) => ({ lat: p.lat, lng: p.lng })));
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
    },
  });
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
