/**
 * Itinerary sequencer for the AI recommender (Phase 7).
 *
 * Given a list of scored POIs, pick the strongest while respecting:
 *   - diversity (don't return 5 temples)
 *   - geographic flow (greedy nearest-neighbor from region centroid)
 *   - time budget (sum of stay + drive minutes ≤ max_hours)
 */

import { driveMinutes, type LatLng } from "@/lib/itinerary-builder/distance";
import { REGION_CENTER, type RegionSlug } from "@/lib/itinerary-builder/regions";
import type { ScorablePoiRow } from "./score-poi";

interface SequenceOpts {
  maxPois: number;
  maxHours: number;
  region: RegionSlug;
}

const DIVERSITY_PENALTY = 1.5; // subtract from score for each prior POI sharing category

function categoryGroup(p: ScorablePoiRow): string {
  const c = (p.category || "").toLowerCase();
  if (c.includes("temple") || c.includes("buddhist")) return "temple";
  if (c.includes("market") || c.includes("food")) return "market";
  if (c.includes("beach") || c.includes("coastal")) return "coastal";
  if (c.includes("park") || c.includes("nature") || c.includes("garden")) return "nature";
  if (c.includes("unesco") || c.includes("heritage") || c.includes("hanok") || c.includes("palace"))
    return "heritage";
  if (c.includes("museum") || c.includes("library")) return "indoor_culture";
  if (c.includes("village") || c.includes("culture")) return "village";
  if (c.includes("cave") || c.includes("tunnel")) return "underground";
  return c.split(/[\s/]+/)[0] || "other";
}

/**
 * Pick top-N with a diversity-aware re-ranker. Each POI after the first
 * loses DIVERSITY_PENALTY × (number of already-picked POIs in same category).
 */
export function pickDiverse(
  scored: { poi: ScorablePoiRow; total: number }[],
  limit: number
): ScorablePoiRow[] {
  const sorted = [...scored].sort((a, b) => b.total - a.total);
  const picked: ScorablePoiRow[] = [];
  const groupCounts = new Map<string, number>();

  const candidates = sorted.slice(0, Math.max(limit * 3, limit + 3));

  while (picked.length < limit && candidates.length > 0) {
    let bestIdx = 0;
    let bestEff = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const g = categoryGroup(c.poi);
      const seenInG = groupCounts.get(g) ?? 0;
      const eff = c.total - seenInG * DIVERSITY_PENALTY;
      if (eff > bestEff) {
        bestEff = eff;
        bestIdx = i;
      }
    }
    const chosen = candidates.splice(bestIdx, 1)[0];
    picked.push(chosen.poi);
    const g = categoryGroup(chosen.poi);
    groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1);
  }

  return picked;
}

/**
 * Greedy nearest-neighbor sequencing starting from region centroid.
 * Returns POIs in visit order.
 */
export function greedyRoute(pois: ScorablePoiRow[], region: RegionSlug): ScorablePoiRow[] {
  if (pois.length <= 1) return pois;
  const center = REGION_CENTER[region];
  const remaining = [...pois];
  const ordered: ScorablePoiRow[] = [];

  let cursor: LatLng = { lat: center.lat, lng: center.lng };
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestMin = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = driveMinutes(cursor, { lat: remaining[i].lat, lng: remaining[i].lng });
      if (d < bestMin) {
        bestMin = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    cursor = { lat: next.lat, lng: next.lng };
  }
  return ordered;
}

/**
 * Trim from tail until total time (sum of stay + drive) ≤ max_hours×60.
 */
export function trimToBudget(
  pois: ScorablePoiRow[],
  region: RegionSlug,
  maxHours: number
): ScorablePoiRow[] {
  if (pois.length === 0) return pois;
  const center = REGION_CENTER[region];
  const budgetMin = maxHours * 60;

  let trimmed = [...pois];
  while (trimmed.length > 0) {
    let drive = 0;
    let cursor: LatLng = { lat: center.lat, lng: center.lng };
    for (const p of trimmed) {
      drive += driveMinutes(cursor, { lat: p.lat, lng: p.lng });
      cursor = { lat: p.lat, lng: p.lng };
    }
    // Include the return leg from the last POI back to the region centroid.
    // Without this, the matcher cheerfully greenlit one-way journeys to far
    // POIs (Yeongnam Alps in Miryang, Bulguksa in Gyeongju) and the user
    // would have run out of daylight returning to their hotel/cruise.
    drive += driveMinutes(cursor, { lat: center.lat, lng: center.lng });
    const stay = trimmed.reduce((s, p) => s + (p.default_stay_minutes ?? 0), 0);
    if (drive + stay <= budgetMin) return trimmed;
    trimmed.pop();
  }
  return trimmed;
}

export function sequence(
  scored: { poi: ScorablePoiRow; total: number }[],
  opts: SequenceOpts
): ScorablePoiRow[] {
  const diverse = pickDiverse(scored, opts.maxPois);
  const ordered = greedyRoute(diverse, opts.region);
  return trimToBudget(ordered, opts.region, opts.maxHours);
}
