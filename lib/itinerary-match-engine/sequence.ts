/**
 * Itinerary sequencer for the AI recommender (Phase 7).
 *
 * Given a list of scored POIs, pick the strongest while respecting:
 *   - diversity (don't return 5 temples)
 *   - geographic feasibility (far-away POIs cost score; round-trip time
 *     stays within budget)
 *   - time budget (sum of stay + drive minutes ≤ max_hours, INCLUDING
 *     the return leg to the region centroid)
 *
 * Phase 7+ tuning (2026-05-18):
 *   - Distance-from-centroid penalty added during candidate ranking so
 *     pickDiverse naturally prefers geographically tight days.
 *   - Greedy nearest-neighbor replaced with brute-force best-of-all-
 *     permutations (N ≤ 7 — at worst 5040 perms × ~8 distance calls =
 *     ~40k arithmetic ops; <1ms).
 *   - DIVERSITY_PENALTY 1.5 → 1.0 so the matcher fills the budget more
 *     generously instead of stopping at 2 POIs.
 *   - After trim-to-budget, "backfill" pass tries to slot more
 *     candidates into any remaining time room — keeps a 6h request from
 *     returning a 3.5h day.
 */

import { driveMinutes, type LatLng } from "@/lib/itinerary-builder/distance";
import { REGION_CENTER, type RegionSlug } from "@/lib/itinerary-builder/regions";
import type { ScorablePoiRow } from "./score-poi";
import { resolveBuilderPoiMeta } from "./poi-taxonomy";

interface SequenceOpts {
  maxPois: number;
  maxHours: number;
  region: RegionSlug;
  origin?: LatLng;
}

const DIVERSITY_PENALTY = 1.0; // subtract from score for each prior POI sharing category

/**
 * Distance-from-centroid penalty. Far POIs (Yeongnam Alps, deep Gyeongju)
 * cost score so pickDiverse naturally favours a tight day. Tunable —
 * larger numbers = stricter geographic clustering.
 */
function distancePenalty(poi: ScorablePoiRow, base: LatLng): number {
  const km = haversineKm(base, { lat: poi.lat, lng: poi.lng });
  if (km < 25) return 0;
  if (km < 45) return 0.8;
  if (km < 70) return 4.5;
  if (km < 100) return 7.0;
  return 10.0;
}

/** Inline haversine (avoid circular import of the public helper). */
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function categoryGroup(p: ScorablePoiRow): string {
  const metaGroup = resolveBuilderPoiMeta(p).categoryGroup;
  if (metaGroup !== "other") return metaGroup;
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
 * Pick top-N with diversity + distance penalties.
 */
export function pickDiverse(
  scored: { poi: ScorablePoiRow; total: number }[],
  limit: number,
  region: RegionSlug,
  origin?: LatLng
): ScorablePoiRow[] {
  const base = origin ?? REGION_CENTER[region];
  const sorted = [...scored].sort((a, b) => b.total - a.total);
  const picked: ScorablePoiRow[] = [];
  const groupCounts = new Map<string, number>();

  const candidates = sorted.slice(0, Math.max(limit * 3, limit + 6));

  while (picked.length < limit && candidates.length > 0) {
    let bestIdx = 0;
    let bestEff = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const g = categoryGroup(c.poi);
      const seenInG = groupCounts.get(g) ?? 0;
      const dist = distancePenalty(c.poi, base);
      const eff = c.total - seenInG * DIVERSITY_PENALTY - dist;
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
 * Brute-force best-permutation tour starting from region centroid and
 * returning to it. Computes total drive time over every permutation and
 * picks the minimum. Safe for N ≤ 7 (5040 perms = ~40k ops).
 */
export function tspRoute(
  pois: ScorablePoiRow[],
  region: RegionSlug,
  origin?: LatLng
): ScorablePoiRow[] {
  if (pois.length <= 1) return pois;
  const center = origin ?? REGION_CENTER[region];
  const centerLL: LatLng = { lat: center.lat, lng: center.lng };

  // Cache pairwise drive minutes (POIs + center as index N).
  const ll: LatLng[] = pois.map((p) => ({ lat: p.lat, lng: p.lng }));
  const all = [...ll, centerLL];
  const N = pois.length;
  const dist: number[][] = Array.from({ length: N + 1 }, () => new Array(N + 1).fill(0));
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      if (i !== j) dist[i][j] = driveMinutes(all[i], all[j]);
    }
  }

  // Generate permutations of [0..N-1]
  const indices = Array.from({ length: N }, (_, i) => i);
  let bestOrder: number[] = indices;
  let bestCost = Infinity;

  const permute = (arr: number[], start: number) => {
    if (start === arr.length - 1) {
      // Tour cost: center → arr[0] → arr[1] → ... → arr[N-1] → center
      let cost = dist[N][arr[0]];
      for (let k = 1; k < arr.length; k++) cost += dist[arr[k - 1]][arr[k]];
      cost += dist[arr[arr.length - 1]][N];
      if (cost < bestCost) {
        bestCost = cost;
        bestOrder = [...arr];
      }
      return;
    }
    for (let i = start; i < arr.length; i++) {
      [arr[start], arr[i]] = [arr[i], arr[start]];
      permute(arr, start + 1);
      [arr[start], arr[i]] = [arr[i], arr[start]];
    }
  };
  permute(indices, 0);

  return bestOrder.map((i) => pois[i]);
}

/**
 * Compute total tour time (drive + stay) INCLUDING the return leg from
 * the last POI back to the region centroid. This is the source-of-truth
 * for budget enforcement — `sequence()` calls it directly.
 */
export function tourDriveMin(
  pois: ScorablePoiRow[],
  region: RegionSlug,
  origin?: LatLng
): number {
  if (pois.length === 0) return 0;
  const center = origin ?? REGION_CENTER[region];
  let drive = 0;
  let cursor: LatLng = { lat: center.lat, lng: center.lng };
  for (const p of pois) {
    drive += driveMinutes(cursor, { lat: p.lat, lng: p.lng });
    cursor = { lat: p.lat, lng: p.lng };
  }
  drive += driveMinutes(cursor, { lat: center.lat, lng: center.lng });
  return drive;
}

export function tourTotalMin(
  pois: ScorablePoiRow[],
  region: RegionSlug,
  origin?: LatLng
): number {
  if (pois.length === 0) return 0;
  const drive = tourDriveMin(pois, region, origin);
  const stay = pois.reduce((s, p) => s + (p.default_stay_minutes ?? 0), 0);
  return drive + stay;
}

/**
 * Trim from tail until the round-trip tour fits within budget.
 */
export function trimToBudget(
  pois: ScorablePoiRow[],
  region: RegionSlug,
  maxHours: number,
  origin?: LatLng
): ScorablePoiRow[] {
  if (pois.length === 0) return pois;
  const budgetMin = maxHours * 60;
  let trimmed = [...pois];
  while (trimmed.length > 0 && tourTotalMin(trimmed, region, origin) > budgetMin) {
    trimmed.pop();
  }
  return trimmed;
}

/**
 * After trim, try slotting more candidates into remaining budget room.
 * Candidates are the scored POIs not already picked, in score order.
 * For each candidate, try inserting at every position and keep the
 * insertion that produces the shortest total tour — provided it still
 * fits the budget.
 */
function backfill(
  picked: ScorablePoiRow[],
  scored: { poi: ScorablePoiRow; total: number }[],
  region: RegionSlug,
  maxHours: number,
  maxPois: number,
  origin?: LatLng
): ScorablePoiRow[] {
  const budgetMin = maxHours * 60;
  const pickedKeys = new Set(picked.map((p) => p.poi_key));
  const remaining = scored
    .filter((s) => !pickedKeys.has(s.poi.poi_key))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12) // bound the search
    .map((s) => s.poi);

  let current = [...picked];
  for (const cand of remaining) {
    if (current.length >= maxPois) break;
    let bestInsertIdx = -1;
    let bestCost = Infinity;
    for (let i = 0; i <= current.length; i++) {
      const trial = [...current.slice(0, i), cand, ...current.slice(i)];
      const cost = tourTotalMin(trial, region, origin);
      if (cost <= budgetMin && cost < bestCost) {
        bestCost = cost;
        bestInsertIdx = i;
      }
    }
    if (bestInsertIdx >= 0) {
      current.splice(bestInsertIdx, 0, cand);
    }
  }
  return current;
}

export function sequence(
  scored: { poi: ScorablePoiRow; total: number }[],
  opts: SequenceOpts
): ScorablePoiRow[] {
  const diverse = pickDiverse(scored, opts.maxPois, opts.region, opts.origin);
  const ordered = tspRoute(diverse, opts.region, opts.origin);
  const trimmed = trimToBudget(ordered, opts.region, opts.maxHours, opts.origin);
  // If there's budget left and we have fewer than maxPois, try to slot
  // more candidates in via insertion search.
  if (trimmed.length < opts.maxPois) {
    const filled = backfill(trimmed, scored, opts.region, opts.maxHours, opts.maxPois, opts.origin);
    // Re-optimize the order after backfill
    return tspRoute(filled, opts.region, opts.origin);
  }
  return trimmed;
}

/** @deprecated — use tspRoute. Kept for older callsites if any. */
export const greedyRoute = tspRoute;
