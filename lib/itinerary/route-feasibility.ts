import {
  LONG_JUMP_THRESHOLD_MIN,
  ROUTE_EXCESSIVE_LONG_JUMP_COUNT,
  ROUTE_EXCESSIVE_REGION_JUMP_LEGS,
  ROUTE_MAX_FEASIBILITY_TRIMS,
  ROUTE_MAX_TOTAL_TRAVEL_MIN_PER_DAY,
  ROUTE_MAX_TRAVEL_FRACTION_OF_BUDGET,
  ROUTE_REORDER_MAX_PASSES,
  ROUTE_SINGLE_LEG_MAX_KM,
} from '@/lib/geo/jeju-routing-constants';
import { distanceAndTravelBetweenCoords, parseCoord } from '@/lib/geo/haversine';
import type { GeminiDraft, JejuPoiRow, ValidationRepair, ValidationRepairCategory } from './types';
import type { ParsedRequestSlots } from '@/lib/itinerary/parser/types';
import {
  createDayPlanningContext,
  estimateLegDepartureAt,
  type RoutePlanningContext,
} from '@/lib/itinerary/reco/planning-context';
import { computeFullDayRouteCost } from '@/lib/itinerary/reco/route-cost';
import { deriveRoutePreferenceProfileFromSlots } from '@/lib/itinerary/reco/route-preference-profile';
import {
  createEmptyRouteTravelStats,
  resolveEndpointToPoiMinutes,
  resolvePoiToEndpointMinutes,
  type RouteTravelStats,
} from '@/lib/itinerary/reco/route-travel-resolver';
import { getTravelMinutesBetweenPois } from '@/lib/itinerary/reco/travel-time';
import { dwellMinutesForStop, stopStrength } from './stop-metrics';
import { travelMinutesBetweenRows } from './travel-between-stops';

export type RouteLegMeta = {
  fromIndex: number;
  toIndex: number;
  fromContentId: string;
  toContentId: string;
  distanceKm: number | null;
  estimatedTravelMinutes: number;
  hasCoords: boolean;
  regionJump: boolean;
};

export type RouteFeasibilityMetrics = {
  legs: RouteLegMeta[];
  estimatedTotalTravelMinutes: number;
  estimatedTotalVisitMinutes: number;
  estimatedTotalDayMinutes: number;
  coordinateLegCount: number;
  totalLegCount: number;
  totalTravelDistanceKm: number | null;
  longJumpLegCount: number;
  regionJumpLegCount: number;
};

function renumberSortOrder(stops: GeminiDraft['stops']): GeminiDraft['stops'] {
  return stops.map((s, i) => ({ ...s, sortOrder: i + 1 }));
}

function rowCoords(row: JejuPoiRow | undefined): {
  lon: number | null;
  lat: number | null;
} {
  if (!row) return { lon: null, lat: null };
  return { lon: parseCoord(row.mapx), lat: parseCoord(row.mapy) };
}

export function computeRouteFeasibilityMetrics(
  stops: GeminiDraft['stops'],
  byId: Map<string, JejuPoiRow>,
): RouteFeasibilityMetrics {
  const legs: RouteLegMeta[] = [];
  let estimatedTotalTravelMinutes = 0;
  let estimatedTotalVisitMinutes = 0;
  let sumKm = 0;
  let kmLegs = 0;
  let longJumpLegCount = 0;
  let regionJumpLegCount = 0;

  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    const row = byId.get(s.contentId);
    estimatedTotalVisitMinutes += dwellMinutesForStop(s, row);
    if (i >= stops.length - 1) break;
    const next = stops[i + 1];
    const rowB = byId.get(next.contentId);
    const ca = rowCoords(row);
    const cb = rowCoords(rowB);
    const est = distanceAndTravelBetweenCoords(ca.lon, ca.lat, cb.lon, cb.lat, row?.region_group ?? null, rowB?.region_group ?? null);
    const hasCoords =
      ca.lon != null && ca.lat != null && cb.lon != null && cb.lat != null && Number.isFinite(est.distanceKm);
    const distanceKm = hasCoords ? est.distanceKm : null;
    if (hasCoords && distanceKm != null) {
      sumKm += distanceKm;
      kmLegs++;
    }
    const rgA = (row?.region_group ?? '').trim();
    const rgB = (rowB?.region_group ?? '').trim();
    const regionJump = rgA !== '' && rgB !== '' && rgA !== rgB;
    if (regionJump) regionJumpLegCount++;
    if (est.estimatedTravelMinutes >= LONG_JUMP_THRESHOLD_MIN) longJumpLegCount++;

    legs.push({
      fromIndex: i,
      toIndex: i + 1,
      fromContentId: s.contentId,
      toContentId: next.contentId,
      distanceKm,
      estimatedTravelMinutes: est.estimatedTravelMinutes,
      hasCoords,
      regionJump,
    });
    estimatedTotalTravelMinutes += est.estimatedTravelMinutes;
  }

  return {
    legs,
    estimatedTotalTravelMinutes,
    estimatedTotalVisitMinutes,
    estimatedTotalDayMinutes: estimatedTotalTravelMinutes + estimatedTotalVisitMinutes,
    coordinateLegCount: kmLegs,
    totalLegCount: legs.length,
    totalTravelDistanceKm: kmLegs > 0 ? Math.round(sumKm * 10) / 10 : null,
    longJumpLegCount,
    regionJumpLegCount,
  };
}

export type RouteThresholdResult = {
  bad: boolean;
  reasons: string[];
};

export function evaluateRouteThresholds(
  m: RouteFeasibilityMetrics,
  budgetMinTotal: number,
  durationDays: number,
): RouteThresholdResult {
  const reasons: string[] = [];
  const days = Math.max(1, durationDays);
  const maxTravelByBudget = Math.round(budgetMinTotal * ROUTE_MAX_TRAVEL_FRACTION_OF_BUDGET);
  const maxTravelByDayCap = ROUTE_MAX_TOTAL_TRAVEL_MIN_PER_DAY * days;
  const maxTravelMin = Math.min(maxTravelByDayCap, maxTravelByBudget);

  if (m.estimatedTotalTravelMinutes > maxTravelMin) {
    reasons.push(
      `Total estimated driving time (${m.estimatedTotalTravelMinutes} min) exceeds limit (${maxTravelMin} min) for this trip window.`,
    );
  }

  for (const leg of m.legs) {
    if (leg.distanceKm != null && leg.distanceKm > ROUTE_SINGLE_LEG_MAX_KM) {
      reasons.push(
        `Long leg (~${Math.round(leg.distanceKm * 10) / 10} km between stops) may be tiring for a single day.`,
      );
      break;
    }
  }

  if (m.longJumpLegCount >= ROUTE_EXCESSIVE_LONG_JUMP_COUNT) {
    reasons.push('Several long driving legs; the day may feel rushed.');
  }
  if (m.regionJumpLegCount >= ROUTE_EXCESSIVE_REGION_JUMP_LEGS) {
    reasons.push('Many cross-region moves; consider focusing on one area.');
  }

  const bad = reasons.length > 0;
  return { bad, reasons };
}

function totalTravelMinutesForOrder(stops: GeminiDraft['stops'], byId: Map<string, JejuPoiRow>): number {
  let t = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = byId.get(stops[i].contentId);
    const b = byId.get(stops[i + 1].contentId);
    t += travelMinutesBetweenRows(a, b);
  }
  return t;
}

/**
 * Greedy adjacent swaps that reduce total estimated travel time (coordinates + region fallback).
 */
export function tryMinimalTravelReorder(
  stops: GeminiDraft['stops'],
  byId: Map<string, JejuPoiRow>,
): { stops: GeminiDraft['stops']; improved: boolean } {
  let out = [...stops];
  let improvedAny = false;
  for (let pass = 0; pass < ROUTE_REORDER_MAX_PASSES; pass++) {
    let changed = false;
    for (let i = 0; i < out.length - 1; i++) {
      const before = totalTravelMinutesForOrder(out, byId);
      const swapped = [...out];
      [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
      const after = totalTravelMinutesForOrder(swapped, byId);
      if (after + 0.5 < before) {
        out = renumberSortOrder(swapped);
        changed = true;
        improvedAny = true;
      }
    }
    if (!changed) break;
  }
  return { stops: out, improved: improvedAny };
}

function pushRepair(
  repairs: ValidationRepair[],
  category: ValidationRepairCategory,
  message: string,
  contentId?: string,
): void {
  repairs.push(contentId != null ? { category, message, contentId } : { category, message });
}

/**
 * When route thresholds fail: adjacent swaps first, then drop weakest stops (by stopStrength).
 */
export function repairRouteForFeasibility(
  stops: GeminiDraft['stops'],
  byId: Map<string, JejuPoiRow>,
  budgetMinTotal: number,
  durationDays: number,
  repairs: ValidationRepair[],
): GeminiDraft['stops'] {
  let out = renumberSortOrder([...stops]);
  let metrics = computeRouteFeasibilityMetrics(out, byId);
  let evalResult = evaluateRouteThresholds(metrics, budgetMinTotal, durationDays);

  if (!evalResult.bad || out.length <= 2) {
    return out;
  }

  const re = tryMinimalTravelReorder(out, byId);
  if (re.improved) {
    out = re.stops;
    pushRepair(
      repairs,
      'route_reordered',
      'Adjusted stop order to reduce estimated driving time between consecutive stops.',
    );
    metrics = computeRouteFeasibilityMetrics(out, byId);
    evalResult = evaluateRouteThresholds(metrics, budgetMinTotal, durationDays);
  }

  let trims = 0;
  while (evalResult.bad && out.length > 2 && trims < ROUTE_MAX_FEASIBILITY_TRIMS) {
    let weakestIdx = -1;
    let weakestScore = Infinity;
    for (let i = 0; i < out.length; i++) {
      const sc = stopStrength(byId.get(out[i].contentId));
      if (sc < weakestScore) {
        weakestScore = sc;
        weakestIdx = i;
      }
    }
    if (weakestIdx < 0) break;
    const removed = out[weakestIdx];
    out = renumberSortOrder(out.filter((_, j) => j !== weakestIdx));
    trims++;
    pushRepair(
      repairs,
      'route_feasibility_trimmed',
      `Removed stop ${removed.contentId} to improve same-day route feasibility (driving distance/time).`,
      removed.contentId,
    );

    const re2 = tryMinimalTravelReorder(out, byId);
    if (re2.improved) {
      out = re2.stops;
      pushRepair(
        repairs,
        'route_reordered',
        'Reordered stops again after trimming to shorten driving legs.',
      );
    }
    metrics = computeRouteFeasibilityMetrics(out, byId);
    evalResult = evaluateRouteThresholds(metrics, budgetMinTotal, durationDays);
  }

  if (evalResult.bad) {
    for (const msg of evalResult.reasons.slice(0, 4)) {
      pushRepair(repairs, 'route_feasibility_warned', msg);
    }
  }

  return out;
}

/** Same as `computeRouteFeasibilityMetrics` but uses resolved travel minutes per leg when POI rows exist. */
export async function computeRouteFeasibilityMetricsAsync(
  stops: GeminiDraft['stops'],
  byId: Map<string, JejuPoiRow>,
  departureAt?: string | null,
  routePlanning?: RoutePlanningContext | null,
): Promise<RouteFeasibilityMetrics> {
  const legs: RouteLegMeta[] = [];
  let estimatedTotalTravelMinutes = 0;
  let estimatedTotalVisitMinutes = 0;
  let sumKm = 0;
  let kmLegs = 0;
  let longJumpLegCount = 0;
  let regionJumpLegCount = 0;

  const stats = createEmptyRouteTravelStats();
  const dayStart = routePlanning?.departureAt ?? departureAt ?? null;
  let elapsed = 0;

  if (routePlanning?.startLocation && stops.length > 0) {
    const row0 = byId.get(stops[0].contentId);
    const dep = estimateLegDepartureAt({ dayStartAt: dayStart, elapsedMinutes: elapsed });
    const r = await resolveEndpointToPoiMinutes({
      endpoint: routePlanning.startLocation,
      poiRow: row0,
      departureAt: dep,
      stats,
      fallbackAssumedMinutes: 18,
    });
    estimatedTotalTravelMinutes += r.minutes;
    elapsed += r.minutes;
    legs.push({
      fromIndex: -1,
      toIndex: 0,
      fromContentId: '__start__',
      toContentId: stops[0].contentId,
      distanceKm: null,
      estimatedTravelMinutes: r.minutes,
      hasCoords: false,
      regionJump: false,
    });
    if (r.minutes >= LONG_JUMP_THRESHOLD_MIN) longJumpLegCount++;
  }

  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    const row = byId.get(s.contentId);
    const dwell = dwellMinutesForStop(s, row);
    estimatedTotalVisitMinutes += dwell;
    elapsed += dwell;

    if (i >= stops.length - 1) break;

    const next = stops[i + 1];
    const rowB = byId.get(next.contentId);
    const depLeg = estimateLegDepartureAt({ dayStartAt: dayStart, elapsedMinutes: elapsed });

    const ca = rowCoords(row);
    const cb = rowCoords(rowB);
    const est = distanceAndTravelBetweenCoords(
      ca.lon,
      ca.lat,
      cb.lon,
      cb.lat,
      row?.region_group ?? null,
      rowB?.region_group ?? null,
    );
    const hasCoords =
      ca.lon != null && ca.lat != null && cb.lon != null && cb.lat != null && Number.isFinite(est.distanceKm);
    const distanceKm = hasCoords ? est.distanceKm : null;
    if (hasCoords && distanceKm != null) {
      sumKm += distanceKm;
      kmLegs++;
    }
    const rgA = (row?.region_group ?? '').trim();
    const rgB = (rowB?.region_group ?? '').trim();
    const regionJump = rgA !== '' && rgB !== '' && rgA !== rgB;
    if (regionJump) regionJumpLegCount++;

    let legMinutes = est.estimatedTravelMinutes;
    if (row && rowB) {
      try {
        const r = await getTravelMinutesBetweenPois({
          fromPoiId: Number(row.id),
          toPoiId: Number(rowB.id),
          fromRow: row,
          toRow: rowB,
          departureAt: depLeg,
        });
        legMinutes = r.minutes;
      } catch {
        legMinutes = travelMinutesBetweenRows(row, rowB);
      }
    }

    if (legMinutes >= LONG_JUMP_THRESHOLD_MIN) longJumpLegCount++;

    legs.push({
      fromIndex: i,
      toIndex: i + 1,
      fromContentId: s.contentId,
      toContentId: next.contentId,
      distanceKm,
      estimatedTravelMinutes: legMinutes,
      hasCoords,
      regionJump,
    });
    estimatedTotalTravelMinutes += legMinutes;
    elapsed += legMinutes;
  }

  if (routePlanning?.includeReturnToEndLocation && routePlanning.endLocation && stops.length > 0) {
    const last = stops[stops.length - 1];
    const lastRow = byId.get(last.contentId);
    const depRet = estimateLegDepartureAt({ dayStartAt: dayStart, elapsedMinutes: elapsed });
    const ret = await resolvePoiToEndpointMinutes({
      poiRow: lastRow,
      endpoint: routePlanning.endLocation,
      departureAt: depRet,
      stats,
    });
    if (ret != null) {
      estimatedTotalTravelMinutes += ret.minutes;
      legs.push({
        fromIndex: stops.length - 1,
        toIndex: -1,
        fromContentId: last.contentId,
        toContentId: '__end__',
        distanceKm: null,
        estimatedTravelMinutes: ret.minutes,
        hasCoords: false,
        regionJump: false,
      });
      if (ret.minutes >= LONG_JUMP_THRESHOLD_MIN) longJumpLegCount++;
    }
  }

  return {
    legs,
    estimatedTotalTravelMinutes,
    estimatedTotalVisitMinutes,
    estimatedTotalDayMinutes: estimatedTotalTravelMinutes + estimatedTotalVisitMinutes,
    coordinateLegCount: kmLegs,
    totalLegCount: legs.length,
    totalTravelDistanceKm: kmLegs > 0 ? Math.round(sumKm * 10) / 10 : null,
    longJumpLegCount,
    regionJumpLegCount,
  };
}

async function totalTravelMinutesForOrderAsync(
  stops: GeminiDraft['stops'],
  byId: Map<string, JejuPoiRow>,
  departureAt?: string | null,
): Promise<number> {
  let t = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = byId.get(stops[i].contentId);
    const b = byId.get(stops[i + 1].contentId);
    if (a && b) {
      try {
        const r = await getTravelMinutesBetweenPois({
          fromPoiId: Number(a.id),
          toPoiId: Number(b.id),
          fromRow: a,
          toRow: b,
          departureAt: departureAt ?? null,
        });
        t += r.minutes;
      } catch {
        t += travelMinutesBetweenRows(a, b);
      }
    } else {
      t += travelMinutesBetweenRows(a, b);
    }
  }
  return t;
}

function mergeRoutePlanningForReorder(
  routePlanning: RoutePlanningContext | null | undefined,
  departureAt: string | null | undefined,
): RoutePlanningContext {
  const rp = routePlanning ?? {
    departureAt: null,
    startLocation: null,
    endLocation: null,
    includeReturnToEndLocation: false,
  };
  return {
    departureAt: rp.departureAt ?? departureAt ?? null,
    startLocation: rp.startLocation ?? null,
    endLocation: rp.endLocation ?? null,
    includeReturnToEndLocation: Boolean(rp.includeReturnToEndLocation),
  };
}

export function routePlanningHasEndpoints(rp: RoutePlanningContext | null | undefined): boolean {
  if (!rp) return false;
  return (
    rp.startLocation != null ||
    (Boolean(rp.includeReturnToEndLocation) && rp.endLocation != null)
  );
}

async function totalRoutePenaltyForReorderAsync(
  stops: GeminiDraft['stops'],
  byId: Map<string, JejuPoiRow>,
  mergedPlanning: RoutePlanningContext,
  parsed: ParsedRequestSlots | null | undefined,
  mergedValues: Record<string, unknown> | null | undefined,
  stats: RouteTravelStats,
): Promise<number> {
  const rows = stops
    .map((s) => byId.get(s.contentId))
    .filter((r): r is JejuPoiRow => r != null);
  if (rows.length !== stops.length) return Number.POSITIVE_INFINITY;
  const stayMinutes = stops.map((s, i) => dwellMinutesForStop(s, byId.get(stops[i].contentId)));
  const profile = deriveRoutePreferenceProfileFromSlots(parsed ?? undefined, mergedValues ?? undefined);
  const dayPlanning = createDayPlanningContext({ planning: mergedPlanning, dayIndex: 0 });
  const cost = await computeFullDayRouteCost({
    rows,
    stayMinutes,
    planning: dayPlanning,
    profile,
    stats,
  });
  return cost.totalRoutePenalty;
}

export type RoutePreferenceReorderContext = {
  parsedSlots?: ParsedRequestSlots | null;
  mergedValues?: Record<string, unknown> | null;
};

/**
 * Greedy adjacent swaps using resolved travel minutes when available.
 * When route planning includes start/end endpoints, compares shared full-day route penalty (Step 9).
 */
export async function tryMinimalTravelReorderAsync(
  stops: GeminiDraft['stops'],
  byId: Map<string, JejuPoiRow>,
  departureAt?: string | null,
  options?: {
    routePlanning?: RoutePlanningContext | null;
    routePreferenceContext?: RoutePreferenceReorderContext | null;
  },
): Promise<{ stops: GeminiDraft['stops']; improved: boolean; endpointAwareReorderUsed: boolean }> {
  const routePlanning = options?.routePlanning ?? null;
  const mergedPlanning = mergeRoutePlanningForReorder(routePlanning, departureAt ?? null);
  const useEndpointAware =
    routePlanningHasEndpoints(routePlanning) && stops.length >= 2;
  const prefCtx = options?.routePreferenceContext ?? null;

  const compareBeforeAfter = async (
    order: GeminiDraft['stops'],
  ): Promise<number> => {
    if (useEndpointAware) {
      const freshStats = createEmptyRouteTravelStats();
      return totalRoutePenaltyForReorderAsync(
        order,
        byId,
        mergedPlanning,
        prefCtx?.parsedSlots ?? null,
        prefCtx?.mergedValues ?? null,
        freshStats,
      );
    }
    return totalTravelMinutesForOrderAsync(order, byId, mergedPlanning.departureAt ?? departureAt ?? null);
  };

  let out = [...stops];
  let improvedAny = false;
  for (let pass = 0; pass < ROUTE_REORDER_MAX_PASSES; pass++) {
    let changed = false;
    for (let i = 0; i < out.length - 1; i++) {
      const before = await compareBeforeAfter(out);
      const swapped = [...out];
      [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
      const after = await compareBeforeAfter(swapped);
      const improved = useEndpointAware ? after + 1e-6 < before : after + 0.5 < before;
      if (improved) {
        out = renumberSortOrder(swapped);
        changed = true;
        improvedAny = true;
      }
    }
    if (!changed) break;
  }
  return {
    stops: out,
    improved: improvedAny,
    endpointAwareReorderUsed: useEndpointAware,
  };
}

/**
 * Bounded endpoint-aware polish (adjacent swaps) for feasible routes — does not require repair failure.
 */
export async function runEndpointAwarePolishPass(args: {
  stops: GeminiDraft['stops'];
  byId: Map<string, JejuPoiRow>;
  departureAt?: string | null;
  routePlanning?: RoutePlanningContext | null;
  routePreferenceContext?: RoutePreferenceReorderContext | null;
}): Promise<{ stops: GeminiDraft['stops']; improved: boolean; endpointAwarePolishUsed: boolean }> {
  const rp = args.routePlanning ?? null;
  if (!routePlanningHasEndpoints(rp) || args.stops.length < 2) {
    return { stops: args.stops, improved: false, endpointAwarePolishUsed: false };
  }
  const re = await tryMinimalTravelReorderAsync(args.stops, args.byId, args.departureAt, {
    routePlanning: rp,
    routePreferenceContext: args.routePreferenceContext ?? null,
  });
  return {
    stops: re.stops,
    improved: re.improved,
    endpointAwarePolishUsed: re.endpointAwareReorderUsed,
  };
}

/**
 * When route thresholds fail: adjacent swaps first, then drop weakest stops — travel from resolver.
 */
export async function repairRouteForFeasibilityAsync(
  stops: GeminiDraft['stops'],
  byId: Map<string, JejuPoiRow>,
  budgetMinTotal: number,
  durationDays: number,
  repairs: ValidationRepair[],
  departureAt?: string | null,
  routePlanning?: RoutePlanningContext | null,
  routePreferenceContext?: RoutePreferenceReorderContext | null,
): Promise<{ stops: GeminiDraft['stops']; endpointAwareReorderUsed: boolean }> {
  const reorderOpts = {
    routePlanning: routePlanning ?? null,
    routePreferenceContext: routePreferenceContext ?? null,
  };

  let out = renumberSortOrder([...stops]);
  let metrics = await computeRouteFeasibilityMetricsAsync(out, byId, departureAt, routePlanning);
  let evalResult = evaluateRouteThresholds(metrics, budgetMinTotal, durationDays);

  if (!evalResult.bad || out.length <= 2) {
    return { stops: out, endpointAwareReorderUsed: false };
  }

  let endpointAwareReorderUsed = false;
  const re = await tryMinimalTravelReorderAsync(out, byId, departureAt, reorderOpts);
  endpointAwareReorderUsed = endpointAwareReorderUsed || re.endpointAwareReorderUsed;
  if (re.improved) {
    out = re.stops;
    pushRepair(
      repairs,
      'route_reordered',
      'Adjusted stop order to reduce estimated driving time between consecutive stops.',
    );
    metrics = await computeRouteFeasibilityMetricsAsync(out, byId, departureAt, routePlanning);
    evalResult = evaluateRouteThresholds(metrics, budgetMinTotal, durationDays);
  }

  let trims = 0;
  while (evalResult.bad && out.length > 2 && trims < ROUTE_MAX_FEASIBILITY_TRIMS) {
    let weakestIdx = -1;
    let weakestScore = Infinity;
    for (let i = 0; i < out.length; i++) {
      const sc = stopStrength(byId.get(out[i].contentId));
      if (sc < weakestScore) {
        weakestScore = sc;
        weakestIdx = i;
      }
    }
    if (weakestIdx < 0) break;
    const removed = out[weakestIdx];
    out = renumberSortOrder(out.filter((_, j) => j !== weakestIdx));
    trims++;
    pushRepair(
      repairs,
      'route_feasibility_trimmed',
      `Removed stop ${removed.contentId} to improve same-day route feasibility (driving distance/time).`,
      removed.contentId,
    );

    const re2 = await tryMinimalTravelReorderAsync(out, byId, departureAt, reorderOpts);
    endpointAwareReorderUsed = endpointAwareReorderUsed || re2.endpointAwareReorderUsed;
    if (re2.improved) {
      out = re2.stops;
      pushRepair(
        repairs,
        'route_reordered',
        'Reordered stops again after trimming to shorten driving legs.',
      );
    }
    metrics = await computeRouteFeasibilityMetricsAsync(out, byId, departureAt, routePlanning);
    evalResult = evaluateRouteThresholds(metrics, budgetMinTotal, durationDays);
  }

  if (evalResult.bad) {
    for (const msg of evalResult.reasons.slice(0, 4)) {
      pushRepair(repairs, 'route_feasibility_warned', msg);
    }
  }

  return { stops: out, endpointAwareReorderUsed };
}
