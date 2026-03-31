/**
 * Bounded meal / cafe insertion from the same scored SQL pool only.
 * Feasibility uses resolved travel minutes when comparing detour vs direct leg.
 */
import type { ParsedRequestSlots } from '@/lib/itinerary/parser/types';
import type { JejuPoiRow } from '@/lib/itinerary/types';
import type { PoiRecoFeaturesRow } from '@/lib/itinerary/reco/fetch-reco-features';
import type { ScoredCandidate } from '@/lib/itinerary/reco/score-candidates';
import type { SelectedStop } from '@/lib/itinerary/reco/assemble-route';
import { resolveLegMinutes, type RouteTravelStats } from '@/lib/itinerary/reco/route-travel-resolver';

/** Max extra driving minutes vs direct leg to accept a flex stop detour. */
const FLEX_MAX_EXTRA_TRAVEL_MIN = 45;

export async function insertFlexStops(params: {
  baseStops: SelectedStop[];
  scored: ScoredCandidate[];
  recoByPoiId: Map<number, PoiRecoFeaturesRow>;
  parsed: ParsedRequestSlots;
  regionFilter: string | null;
  byContentId: Map<string, JejuPoiRow>;
  departureAt?: string | null;
  travelStats: RouteTravelStats;
}): Promise<SelectedStop[]> {
  const used = new Set(params.baseStops.map((s) => s.contentId));
  const inRegion = (c: ScoredCandidate) =>
    !params.regionFilter ||
    params.regionFilter === 'unknown' ||
    c.region === params.regionFilter ||
    c.region == null;

  const stops = [...params.baseStops];
  if (stops.length < 2) return stops;

  const dep = params.departureAt ?? null;

  // Cafe: only when user expressed cafe interest
  if ((params.parsed.cafePriority ?? 0) >= 6) {
    let best: ScoredCandidate | null = null;
    let bestCafe = 0;
    for (const c of params.scored) {
      if (used.has(c.content_id) || !inRegion(c)) continue;
      const rf = params.recoByPoiId.get(c.poi_id);
      const cs = rf?.cafe_score ?? 0;
      if (cs > bestCafe) {
        bestCafe = cs;
        best = c;
      }
    }
    if (best != null && bestCafe >= 0.35) {
      const insertAt = 2;
      if (insertAt <= stops.length) {
        const prev = stops[Math.max(0, insertAt - 1)];
        const next = insertAt < stops.length ? stops[insertAt] : undefined;
        const prevRow = params.byContentId.get(prev.contentId);
        const nextRow = next ? params.byContentId.get(next.contentId) : undefined;
        const mealRow = params.byContentId.get(String(best.content_id));

        let insertOk = true;
        if (mealRow && prevRow) {
          const toCafe = await resolveLegMinutes({
            from: prevRow,
            to: mealRow,
            departureAt: dep,
            stats: params.travelStats,
          });
          if (nextRow) {
            const direct = await resolveLegMinutes({
              from: prevRow,
              to: nextRow,
              departureAt: dep,
              stats: params.travelStats,
            });
            const cafeToNext = await resolveLegMinutes({
              from: mealRow,
              to: nextRow,
              departureAt: dep,
              stats: params.travelStats,
            });
            const addedCost = toCafe.minutes + 35 + cafeToNext.minutes - direct.minutes;
            if (addedCost > FLEX_MAX_EXTRA_TRAVEL_MIN) insertOk = false;
          }
        }

        if (insertOk) {
          stops.splice(insertAt, 0, {
            contentId: String(best.content_id),
            poiId: best.poi_id,
            stopType: 'cafe',
            plannedStayMinutes: 35,
            region: best.region ?? null,
            score: best.score,
          });
          used.add(best.content_id);
        }
      }
    }
  }

  // Light meal / food anchor (lunch) — only when food priority is high
  if ((params.parsed.foodPriority ?? 0) >= 7) {
    let best: ScoredCandidate | null = null;
    let bestFood = 0;
    for (const c of params.scored) {
      if (used.has(c.content_id) || !inRegion(c)) continue;
      const rf = params.recoByPoiId.get(c.poi_id);
      const fs = rf?.food_score ?? 0;
      if (fs > bestFood) {
        bestFood = fs;
        best = c;
      }
    }
    if (best != null && bestFood >= 0.4) {
      const insertAt = Math.min(2, stops.length);
      const prev = insertAt > 0 ? stops[insertAt - 1] : undefined;
      const next = insertAt < stops.length ? stops[insertAt] : undefined;
      const prevRow = prev ? params.byContentId.get(prev.contentId) : undefined;
      const nextRow = next ? params.byContentId.get(next.contentId) : undefined;
      const mealRow = params.byContentId.get(String(best.content_id));

      let insertOk = true;
      if (mealRow && prevRow) {
        const toMeal = await resolveLegMinutes({
          from: prevRow,
          to: mealRow,
          departureAt: dep,
          stats: params.travelStats,
        });
        if (nextRow) {
          const direct = await resolveLegMinutes({
            from: prevRow,
            to: nextRow,
            departureAt: dep,
            stats: params.travelStats,
          });
          const mealToNext = await resolveLegMinutes({
            from: mealRow,
            to: nextRow,
            departureAt: dep,
            stats: params.travelStats,
          });
          const addedCost = toMeal.minutes + 55 + mealToNext.minutes - direct.minutes;
          if (addedCost > FLEX_MAX_EXTRA_TRAVEL_MIN) insertOk = false;
        }
      }

      if (insertOk) {
        stops.splice(insertAt, 0, {
          contentId: String(best.content_id),
          poiId: best.poi_id,
          stopType: 'meal',
          plannedStayMinutes: 55,
          region: best.region ?? null,
          score: best.score,
        });
      }
    }
  }

  return stops;
}
