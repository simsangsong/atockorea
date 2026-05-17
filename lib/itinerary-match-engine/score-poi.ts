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
}

export interface PoiScore {
  poi: ScorablePoiRow;
  total: number;
  components: Record<string, number>;
}

function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  return 0;
}

/**
 * Map theme/persona/season_lock tokens to canonical `<token>_fit` keys
 * on the POI matching_profile. Matcher v2 already standardized these.
 */
function fitKey(token: string): string {
  return `${token}_fit`;
}

export function scorePoi(poi: ScorablePoiRow, parsed: ParsedQueryV2): PoiScore {
  const components: Record<string, number> = {};
  const mp = poi.matching_profile ?? {};

  // 1. boost_dimensions — direct multiplier per dim
  let boostSum = 0;
  for (const [dim, weight] of Object.entries(parsed.boost_dimensions || {})) {
    const v = asNumber(mp[dim]);
    if (v > 0) boostSum += v * Math.max(0, weight);
  }
  if (boostSum > 0) components.boost_dimensions = Number(boostSum.toFixed(3));

  // 2. theme overlap — POI dimensions matching user themes
  let themeOverlap = 0;
  for (const t of parsed.themes || []) {
    const v = asNumber(mp[fitKey(t)]);
    if (v > 0) themeOverlap += v;
  }
  // Bonus for raw count of theme matches (matches matcher v2 pattern)
  if (themeOverlap > 0) components.theme_overlap = Number((themeOverlap * 1.5).toFixed(3));

  // 3. persona alignment
  let personaAlign = 0;
  for (const p of parsed.personas || []) {
    const v = asNumber(mp[fitKey(p)]);
    if (v > 0) personaAlign += v * 2;
  }
  if (personaAlign > 0) components.persona_align = Number(personaAlign.toFixed(3));

  // 4. season_lock match (e.g. cherry_blossom, hydrangea)
  let seasonScore = 0;
  for (const s of parsed.season_locks || []) {
    const v = asNumber(mp[fitKey(s)]);
    if (v > 0) seasonScore += v * 2.5;
  }
  if (seasonScore > 0) components.season_lock = Number(seasonScore.toFixed(3));

  // 5. iconic landmark base bonus (rewards canonical "must-see" POIs)
  const iconic = asNumber(mp.iconic_landmark_fit);
  if (iconic > 0.7) components.iconic_landmark_baseline = Number((iconic * 0.5).toFixed(3));

  // 6. anchor_poi mentioned directly by user
  if ((parsed.anchor_pois_mentioned || []).includes(poi.poi_key)) {
    components.anchor_poi_mentioned = 6;
  }

  // 7. negative_signal penalty
  let negPenalty = 0;
  for (const n of parsed.negative_signals || []) {
    const v = asNumber(mp[fitKey(n)]);
    if (v > 0.4) negPenalty -= v * 4;
  }
  if (negPenalty !== 0) components.negative_penalty = Number(negPenalty.toFixed(3));

  // 8. hard_constraint adherence — wheelchair etc.
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
