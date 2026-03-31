import { haversineKm } from '@/lib/geo/haversine';
import type {
  GeminiDraft,
  JejuPoiRow,
  ValidationMeta,
  ValidationRepair,
  ValidationRepairCategory,
} from './types';
import {
  computeRouteFeasibilityMetricsAsync,
  repairRouteForFeasibilityAsync,
  type RouteFeasibilityMetrics,
  type RoutePreferenceReorderContext,
} from './route-feasibility';
import { deriveRoutePreferenceProfileFromSlots } from '@/lib/itinerary/reco/route-preference-profile';
import { estimateLegDepartureAt } from '@/lib/itinerary/reco/planning-context';
import type { RoutePlanningContext } from '@/lib/itinerary/reco/planning-context';
import {
  createEmptyRouteTravelStats,
  resolveEndpointToPoiMinutes,
  resolvePoiToEndpointMinutes,
} from '@/lib/itinerary/reco/route-travel-resolver';
import type { TravelResolutionSource } from '@/lib/itinerary/reco/travel-time';
import { getTravelMinutesBetweenPois } from '@/lib/itinerary/reco/travel-time';
import { dwellMinutesForStop, stopStrength } from './stop-metrics';
import { travelMinutesBetweenRows } from './travel-between-stops';

export { haversineKm } from '@/lib/geo/haversine';
export { dwellMinutesForStop, stopStrength } from './stop-metrics';

async function totalEstimatedMinutesAsync(
  stops: GeminiDraft['stops'],
  byId: Map<string, JejuPoiRow>,
  routePlanning?: RoutePlanningContext | null,
): Promise<{
  total: number;
  firstLegSource?: TravelResolutionSource;
  returnLegSource?: TravelResolutionSource;
}> {
  const stats = createEmptyRouteTravelStats();
  const planning = routePlanning ?? {
    departureAt: null,
    startLocation: null,
    endLocation: null,
    includeReturnToEndLocation: false,
  };
  const dayStart = planning.departureAt;
  let elapsed = 0;
  let total = 0;
  let firstLegSource: TravelResolutionSource | undefined;
  let returnLegSource: TravelResolutionSource | undefined;

  if (planning.startLocation && stops.length > 0) {
    const row0 = byId.get(stops[0].contentId);
    const dep = estimateLegDepartureAt({ dayStartAt: dayStart, elapsedMinutes: elapsed });
    const first = await resolveEndpointToPoiMinutes({
      endpoint: planning.startLocation,
      poiRow: row0,
      departureAt: dep,
      stats,
      fallbackAssumedMinutes: 18,
    });
    firstLegSource = first.source;
    total += first.minutes;
    elapsed += first.minutes;
  }

  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    const row = byId.get(s.contentId);
    const dwell = dwellMinutesForStop(s, row);
    total += dwell;
    elapsed += dwell;

    if (i >= stops.length - 1) break;

    const next = stops[i + 1];
    const rowB = byId.get(next.contentId);
    const depLeg = estimateLegDepartureAt({ dayStartAt: dayStart, elapsedMinutes: elapsed });

    if (row && rowB) {
      try {
        const r = await getTravelMinutesBetweenPois({
          fromPoiId: Number(row.id),
          toPoiId: Number(rowB.id),
          fromRow: row,
          toRow: rowB,
          departureAt: depLeg,
        });
        total += r.minutes;
        elapsed += r.minutes;
      } catch {
        const fb = travelMinutesBetweenRows(row, rowB);
        total += fb;
        elapsed += fb;
      }
    } else {
      const fb = travelMinutesBetweenRows(row, rowB);
      total += fb;
      elapsed += fb;
    }
  }

  if (planning.includeReturnToEndLocation && planning.endLocation && stops.length > 0) {
    const lastRow = byId.get(stops[stops.length - 1].contentId);
    const depRet = estimateLegDepartureAt({ dayStartAt: dayStart, elapsedMinutes: elapsed });
    const ret = await resolvePoiToEndpointMinutes({
      poiRow: lastRow,
      endpoint: planning.endLocation,
      departureAt: depRet,
      stats,
    });
    if (ret != null) {
      returnLegSource = ret.source;
      total += ret.minutes;
    }
  }

  return { total, firstLegSource, returnLegSource };
}

function renumberSortOrder(stops: GeminiDraft['stops']): GeminiDraft['stops'] {
  return stops.map((s, i) => ({ ...s, sortOrder: i + 1 }));
}

function pushRepair(
  repairs: ValidationRepair[],
  category: ValidationRepairCategory,
  message: string,
  contentId?: string,
): void {
  repairs.push(contentId != null ? { category, message, contentId } : { category, message });
}

function routeMetricsToMeta(m: RouteFeasibilityMetrics) {
  return {
    estimatedTotalTravelMinutes: m.estimatedTotalTravelMinutes,
    estimatedTotalVisitMinutes: m.estimatedTotalVisitMinutes,
    estimatedTotalDayMinutes: m.estimatedTotalDayMinutes,
    coordinateLegCount: m.coordinateLegCount,
    totalLegCount: m.totalLegCount,
    totalTravelDistanceKm: m.totalTravelDistanceKm,
  };
}

export type { RoutePreferenceReorderContext };

export type ValidateDraftOptions = {
  availableHoursPerDay: number;
  durationDays: number;
  /** When set, first/last endpoint legs and per-leg departure times use this planning context. */
  routePlanning?: RoutePlanningContext | null;
  /** Parser slots + merged SQL values for route preference / endpoint-aware reorder (Step 9). */
  routePreferenceContext?: RoutePreferenceReorderContext | null;
};

export async function validateDraftAgainstDb(
  draft: GeminiDraft,
  candidatesByContentId: Map<string, JejuPoiRow>,
  options: ValidateDraftOptions,
): Promise<{
  draft: GeminiDraft;
  warnings: string[];
  repairs: ValidationRepair[];
  meta: ValidationMeta;
}> {
  const repairs: ValidationRepair[] = [];

  const hours = Math.min(24, Math.max(1, options.availableHoursPerDay));
  const days = Math.min(14, Math.max(1, options.durationDays));
  const budgetMin = Math.round(days * hours * 60);

  const seen = new Set<string>();
  let stops = draft.stops
    .filter((s) => {
      const key = `${s.contentId}::${s.contentTypeId ?? 12}`;
      if (seen.has(key)) {
        pushRepair(
          repairs,
          'removed_duplicate_poi',
          `Removed duplicate stop: ${s.contentId}`,
          s.contentId,
        );
        return false;
      }
      seen.add(key);
      const row = candidatesByContentId.get(s.contentId);
      if (!row) {
        pushRepair(
          repairs,
          'removed_missing_poi',
          `Removed unknown contentId (not in candidate set): ${s.contentId}`,
          s.contentId,
        );
        return false;
      }
      if (row.manual_hidden === true) {
        pushRepair(
          repairs,
          'removed_hidden_poi',
          `Removed hidden POI (manual_hidden): ${s.contentId}`,
          s.contentId,
        );
        return false;
      }
      return true;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  stops = renumberSortOrder(stops);

  // --- Route feasibility (reorder + trim + warnings) — resolved travel minutes per leg
  const depAt = options.routePlanning?.departureAt ?? null;
  const routeRepair = await repairRouteForFeasibilityAsync(
    stops,
    candidatesByContentId,
    budgetMin,
    days,
    repairs,
    depAt,
    options.routePlanning ?? null,
    options.routePreferenceContext ?? null,
  );
  stops = routeRepair.stops;
  const endpointAwareReorderUsed = routeRepair.endpointAwareReorderUsed;

  // --- Region ping-pong A -> B -> A (minimal repair)
  const pingPongRepair = repairRegionPingPong(stops, candidatesByContentId, repairs);
  stops = pingPongRepair.stops;

  // --- Duration: trim weakest stops, then compress if only 2 left
  stops = await trimAndCompressToBudgetAsync(stops, candidatesByContentId, budgetMin, repairs, options);

  // --- Many regions (informational; long-leg count covered by route feasibility)
  collectRegionTravelNotes(stops, candidatesByContentId, repairs);

  const routeM = await computeRouteFeasibilityMetricsAsync(
    stops,
    candidatesByContentId,
    depAt,
    options.routePlanning ?? null,
  );
  const est = await totalEstimatedMinutesAsync(stops, candidatesByContentId, options.routePlanning ?? null);
  const totalEstimatedMin = est.total;

  const warnings = Array.from(new Set(repairs.map((r) => r.message)));

  const usedRequestedDepartureAt = Boolean(options.routePlanning?.departureAt);

  const profile = deriveRoutePreferenceProfileFromSlots(
    options.routePreferenceContext?.parsedSlots ?? undefined,
    options.routePreferenceContext?.mergedValues ?? undefined,
  );
  const routePreferenceProfileUsed = Boolean(
    options.routePreferenceContext?.parsedSlots ?? options.routePreferenceContext?.mergedValues,
  );
  const longestLegMinutes =
    routeM.legs.length > 0
      ? Math.max(...routeM.legs.map((leg) => leg.estimatedTravelMinutes))
      : undefined;
  const returnLegMeta = routeM.legs.find((leg) => leg.toContentId === '__end__');

  return {
    draft: { ...draft, stops },
    warnings,
    repairs,
    meta: {
      totalEstimatedMin,
      budgetMin,
      ...routeMetricsToMeta(routeM),
      usedRequestedDepartureAt,
      ...(est.firstLegSource != null ? { firstLegResolutionSource: est.firstLegSource } : {}),
      ...(est.returnLegSource != null ? { returnLegResolutionSource: est.returnLegSource } : {}),
      ...(options.routePlanning != null
        ? { includesReturnToEndLocation: options.routePlanning.includeReturnToEndLocation }
        : {}),
      routePreferenceProfileUsed,
      drivePenaltyProfile: profile.mode,
      endpointAwareReorderUsed,
      ...(longestLegMinutes != null ? { longestLegMinutes } : {}),
      totalDriveMinutes: routeM.estimatedTotalTravelMinutes,
      crossRegionJumpCount: routeM.regionJumpLegCount,
      ...(returnLegMeta != null ? { returnLegMinutes: returnLegMeta.estimatedTravelMinutes } : {}),
    },
  };
}

function repairRegionPingPong(
  stops: GeminiDraft['stops'],
  byId: Map<string, JejuPoiRow>,
  repairs: ValidationRepair[],
): { stops: GeminiDraft['stops'] } {
  let out = [...stops];
  let changed = true;
  let guard = 0;
  while (changed && out.length >= 3 && guard < 20) {
    guard++;
    changed = false;
    for (let i = 0; i + 2 < out.length; i++) {
      const a = byId.get(out[i].contentId);
      const b = byId.get(out[i + 1].contentId);
      const c = byId.get(out[i + 2].contentId);
      const ra = (a?.region_group || '').trim();
      const rb = (b?.region_group || '').trim();
      const rc = (c?.region_group || '').trim();
      if (!ra || !rb || !rc) continue;
      if (ra === rc && ra !== rb) {
        const sa = stopStrength(a);
        const sb = stopStrength(b);
        const sc = stopStrength(c);
        const midWeakest = sb <= sa && sb <= sc;
        if (midWeakest) {
          const removed = out[i + 1];
          out = [...out.slice(0, i + 1), ...out.slice(i + 2)];
          out = renumberSortOrder(out);
          pushRepair(
            repairs,
            'region_backtracking_fixed',
            `Adjusted route: removed stop ${removed.contentId} to reduce backtracking (${ra} → ${rb} → ${ra})`,
            removed.contentId,
          );
          changed = true;
          break;
        }
        pushRepair(
          repairs,
          'region_pingpong_warned',
          `Region backtrack ${ra} → ${rb} → ${ra}; middle stop kept (higher priority) — review order if needed`,
        );
      }
    }
  }
  return { stops: out };
}

async function trimAndCompressToBudgetAsync(
  stops: GeminiDraft['stops'],
  byId: Map<string, JejuPoiRow>,
  budgetMin: number,
  repairs: ValidationRepair[],
  options: ValidateDraftOptions,
): Promise<GeminiDraft['stops']> {
  const MIN_DWELL_FOR_COMPRESS = 20;
  const MAX_DWELL_FOR_COMPRESS = 300;

  let out = renumberSortOrder([...stops]);
  let total = (await totalEstimatedMinutesAsync(out, byId, options.routePlanning ?? null)).total;

  while (total > budgetMin && out.length > 2) {
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
    out = out.filter((_, j) => j !== weakestIdx);
    out = renumberSortOrder(out);
    total = (await totalEstimatedMinutesAsync(out, byId, options.routePlanning ?? null)).total;
    pushRepair(
      repairs,
      'over_duration_trimmed',
      `Trimmed stop to fit time budget: ${removed.contentId}`,
      removed.contentId,
    );
  }

  total = (await totalEstimatedMinutesAsync(out, byId, options.routePlanning ?? null)).total;
  if (total > budgetMin && out.length === 2) {
    const s0 = out[0];
    const s1 = out[1];
    const r0 = byId.get(s0.contentId);
    const r1 = byId.get(s1.contentId);
    let travel = travelMinutesBetweenRows(r0, r1);
    if (r0 && r1) {
      try {
        const tr = await getTravelMinutesBetweenPois({
          fromPoiId: Number(r0.id),
          toPoiId: Number(r1.id),
          fromRow: r0,
          toRow: r1,
          departureAt: options.routePlanning?.departureAt ?? null,
        });
        travel = tr.minutes;
      } catch {
        /* keep haversine */
      }
    }
    const dwell0 = dwellMinutesForStop(s0, r0);
    const dwell1 = dwellMinutesForStop(s1, r1);
    const dwellBudget = budgetMin - travel;
    if (dwellBudget > MIN_DWELL_FOR_COMPRESS * 2) {
      const sum = dwell0 + dwell1;
      if (sum > 0) {
        let adjusted0 = Math.max(MIN_DWELL_FOR_COMPRESS, Math.round((dwell0 / sum) * dwellBudget));
        let adjusted1 = Math.max(MIN_DWELL_FOR_COMPRESS, dwellBudget - adjusted0);
        adjusted0 = Math.min(MAX_DWELL_FOR_COMPRESS, adjusted0);
        adjusted1 = Math.min(MAX_DWELL_FOR_COMPRESS, Math.max(MIN_DWELL_FOR_COMPRESS, adjusted1));
        if (adjusted0 + adjusted1 > dwellBudget) {
          adjusted1 = Math.max(MIN_DWELL_FOR_COMPRESS, dwellBudget - adjusted0);
        }
        out = [
          { ...s0, plannedDurationMin: adjusted0 },
          { ...s1, plannedDurationMin: adjusted1 },
        ];
        pushRepair(
          repairs,
          'duration_compressed',
          `Compressed visit times to fit the ${Math.round(budgetMin / 60)}-minute total budget`,
        );
      } else {
        pushRepair(
          repairs,
          'over_duration_trimmed',
          'Could not compress dwell times (invalid dwell sum); consider fewer stops.',
        );
      }
    } else {
      pushRepair(
        repairs,
        'over_duration_trimmed',
        'Estimated time still exceeds the budget; consider fewer stops or spreading across more days.',
      );
    }
  } else if (total > budgetMin && out.length <= 1) {
    pushRepair(
      repairs,
      'over_duration_trimmed',
      'Estimated duration may still exceed the budget for this single stop.',
    );
  }

  return out;
}

function collectRegionTravelNotes(
  stops: GeminiDraft['stops'],
  byId: Map<string, JejuPoiRow>,
  repairs: ValidationRepair[],
): void {
  const regs = new Set(
    stops.map((s) => byId.get(s.contentId)?.region_group).filter((x): x is string => Boolean(x)),
  );
  if (regs.size >= 4) {
    pushRepair(
      repairs,
      'region_jumps_warned',
      'Itinerary spans many regions; travel time between stops may be high.',
    );
  }
}

/** Compact numeric keys for pipeline_events.metadata (counts only). */
export function compactRepairMetrics(repairs: ValidationRepair[]): Record<string, number> {
  const m: Record<string, number> = {
    repairs: repairs.length,
    r_hidden: 0,
    r_miss: 0,
    r_dup: 0,
    r_trim: 0,
    r_compress: 0,
    r_bt_fix: 0,
    r_bt_warn: 0,
    r_jumps: 0,
    r_route_reorder: 0,
    r_route_trim: 0,
    r_route_warn: 0,
  };
  for (const r of repairs) {
    switch (r.category) {
      case 'removed_hidden_poi':
        m.r_hidden++;
        break;
      case 'removed_missing_poi':
        m.r_miss++;
        break;
      case 'removed_duplicate_poi':
        m.r_dup++;
        break;
      case 'over_duration_trimmed':
        m.r_trim++;
        break;
      case 'duration_compressed':
        m.r_compress++;
        break;
      case 'region_backtracking_fixed':
        m.r_bt_fix++;
        break;
      case 'region_pingpong_warned':
        m.r_bt_warn++;
        break;
      case 'region_jumps_warned':
        m.r_jumps++;
        break;
      case 'route_reordered':
        m.r_route_reorder++;
        break;
      case 'route_feasibility_trimmed':
        m.r_route_trim++;
        break;
      case 'route_feasibility_warned':
        m.r_route_warn++;
        break;
      default:
        break;
    }
  }
  return m;
}

/** Legacy helper — thin wrapper around validation messaging for spread scoring */
export function scoreRegionSpread(stops: GeminiDraft['stops'], byId: Map<string, JejuPoiRow>): string[] {
  const regs = new Set(
    stops.map((s) => byId.get(s.contentId)?.region_group).filter((x): x is string => Boolean(x)),
  );
  if (regs.size >= 4) {
    return ['Itinerary spans many regions; travel time between stops may be high.'];
  }
  return [];
}
