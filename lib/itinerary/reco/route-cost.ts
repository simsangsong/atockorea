/**
 * Shared endpoint-aware route cost for assembly, reorder, and diagnostics.
 * Mirrors feasibility leg inclusion: first leg only when startLocation is set; return when enabled.
 */
import type { ParsedRequestSlots } from '@/lib/itinerary/parser/types';
import type { GeminiDraft, JejuPoiRow } from '@/lib/itinerary/types';
import { dwellMinutesForStop } from '@/lib/itinerary/stop-metrics';
import {
  createEmptyRouteTravelStats,
  resolveEndpointToPoiMinutes,
  resolveLegMinutes,
  resolvePoiToEndpointMinutes,
  type RouteTravelStats,
} from '@/lib/itinerary/reco/route-travel-resolver';
import {
  createDayPlanningContext,
  estimateLegDepartureAt,
  type DayPlanningContext,
  type RoutePlanningContext,
} from '@/lib/itinerary/reco/planning-context';
import {
  deriveRoutePreferenceProfileFromSlots,
  type RoutePreferenceProfile,
} from '@/lib/itinerary/reco/route-preference-profile';

export type RouteCostSummary = {
  totalDriveMinutes: number;
  longestLegMinutes: number;
  crossRegionJumpCount: number;
  returnLegMinutes: number;
  totalRoutePenalty: number;
};

export async function computeFullDayRouteCost(args: {
  rows: JejuPoiRow[];
  stayMinutes: number[];
  planning: DayPlanningContext;
  profile: RoutePreferenceProfile;
  stats: RouteTravelStats;
}): Promise<RouteCostSummary> {
  const { rows, stayMinutes, planning, profile, stats } = args;

  if (!rows.length || rows.length !== stayMinutes.length) {
    return {
      totalDriveMinutes: 0,
      longestLegMinutes: 0,
      crossRegionJumpCount: 0,
      returnLegMinutes: 0,
      totalRoutePenalty: 0,
    };
  }

  const dayStartAt = planning.dayStartAt;

  let elapsed = 0;
  let totalDriveMinutes = 0;
  let longestLegMinutes = 0;
  let crossRegionJumpCount = 0;
  let returnLegMinutes = 0;

  if (planning.startLocation) {
    const firstDepartureAt = estimateLegDepartureAt({
      dayStartAt,
      elapsedMinutes: 0,
    });

    const firstLeg = await resolveEndpointToPoiMinutes({
      endpoint: planning.startLocation,
      poiRow: rows[0],
      departureAt: firstDepartureAt,
      stats,
      fallbackAssumedMinutes: 18,
    });

    totalDriveMinutes += firstLeg.minutes;
    longestLegMinutes = Math.max(longestLegMinutes, firstLeg.minutes);
    elapsed += firstLeg.minutes + (stayMinutes[0] ?? 0);
  } else {
    elapsed += stayMinutes[0] ?? 0;
  }

  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1];
    const curr = rows[i];

    const pr = prev?.region_group != null ? String(prev.region_group).trim() : '';
    const cr = curr?.region_group != null ? String(curr.region_group).trim() : '';
    if (pr !== '' && cr !== '' && pr !== cr) {
      crossRegionJumpCount += 1;
    }

    const departureAt = estimateLegDepartureAt({
      dayStartAt,
      elapsedMinutes: elapsed,
    });

    const leg = await resolveLegMinutes({
      from: prev,
      to: curr,
      departureAt,
      stats,
    });

    totalDriveMinutes += leg.minutes;
    longestLegMinutes = Math.max(longestLegMinutes, leg.minutes);
    elapsed += leg.minutes + (stayMinutes[i] ?? 0);
  }

  if (planning.includeReturnToEndLocation && planning.endLocation) {
    const departureAt = estimateLegDepartureAt({
      dayStartAt,
      elapsedMinutes: elapsed,
    });

    const ret = await resolvePoiToEndpointMinutes({
      poiRow: rows[rows.length - 1],
      endpoint: planning.endLocation,
      departureAt,
      stats,
    });

    if (ret) {
      returnLegMinutes = ret.minutes;
      totalDriveMinutes += ret.minutes;
      longestLegMinutes = Math.max(longestLegMinutes, ret.minutes);
    }
  }

  const overLongLegPenalty = Math.max(0, longestLegMinutes - profile.softMaxSingleLegMinutes);

  const overDayDrivePenalty = Math.max(0, totalDriveMinutes - profile.softMaxDayDriveMinutes);

  const returnWeight =
    profile.endpointDistanceWeight *
    (planning.includeReturnToEndLocation ? profile.compactnessBias : 1);

  const totalRoutePenalty =
    totalDriveMinutes * profile.drivePenaltyPerMinute +
    crossRegionJumpCount * profile.crossRegionPenalty +
    overLongLegPenalty * 0.35 +
    overDayDrivePenalty * 0.12 +
    returnLegMinutes * 0.02 * returnWeight;

  return {
    totalDriveMinutes,
    longestLegMinutes,
    crossRegionJumpCount,
    returnLegMinutes,
    totalRoutePenalty,
  };
}

/**
 * Resolver stats for the final chosen route only (meta / assembly debug).
 * Does not include exploratory trial rescoring from assemble-route.
 */
export async function computeFinalTravelStatsForDraftStops(args: {
  stops: GeminiDraft['stops'];
  byId: Map<string, JejuPoiRow>;
  routePlanning: RoutePlanningContext;
  parsedSlots: ParsedRequestSlots;
  mergedValues: Record<string, unknown>;
}): Promise<RouteTravelStats> {
  const stats = createEmptyRouteTravelStats();
  const rows = args.stops
    .map((s) => args.byId.get(s.contentId))
    .filter((r): r is JejuPoiRow => r != null);
  if (rows.length !== args.stops.length) return stats;
  const stayMinutes = args.stops.map((s, i) =>
    dwellMinutesForStop(s, args.byId.get(args.stops[i].contentId)),
  );
  const profile = deriveRoutePreferenceProfileFromSlots(args.parsedSlots, args.mergedValues);
  const planning = createDayPlanningContext({ planning: args.routePlanning, dayIndex: 0 });
  await computeFullDayRouteCost({
    rows,
    stayMinutes,
    planning,
    profile,
    stats,
  });
  return stats;
}
