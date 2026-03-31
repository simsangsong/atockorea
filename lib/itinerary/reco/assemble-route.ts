/**
 * Deterministic route assembly: one primary region by default, time-budget greedy packing.
 * Next-stop choice within a bounded top slice uses resolved travel minutes (cache → live → stale → estimate).
 */
import type { ParsedRequestSlots } from '@/lib/itinerary/parser/types';
import type { JejuPoiRow } from '@/lib/itinerary/types';
import { travelMinutesBetweenRows } from '@/lib/itinerary/travel-between-stops';
import { selectDayRegion } from '@/lib/itinerary/reco/select-day-region';
import type { ScoredCandidate } from '@/lib/itinerary/reco/score-candidates';
import {
  resolveTopCandidateLegs,
  resolveEndpointToPoiMinutes,
  resolvePoiToEndpointMinutes,
  type RouteTravelStats,
} from '@/lib/itinerary/reco/route-travel-resolver';
import {
  createDayPlanningContext,
  estimateLegDepartureAt,
  type RoutePlanningContext,
  type DayPlanningContext,
} from '@/lib/itinerary/reco/planning-context';
import {
  computeIconicDetourCredit,
  deriveRoutePreferenceProfileFromSlots,
  type RoutePreferenceProfile,
} from '@/lib/itinerary/reco/route-preference-profile';
import { computeFullDayRouteCost, type RouteCostSummary } from '@/lib/itinerary/reco/route-cost';

export type SelectedStop = {
  contentId: string;
  poiId: number;
  stopType: 'poi' | 'meal' | 'cafe';
  plannedStayMinutes: number;
  region: string | null;
  score: number;
};

export type AssembleRouteInput = {
  scored: ScoredCandidate[];
  parsed: ParsedRequestSlots;
  parserConfidence: number;
  durationDays: number;
  availableHoursPerDay: number;
  byContentId: Map<string, JejuPoiRow>;
  mergedValues: Record<string, unknown>;
  quickPhotoMode: boolean;
  /** Trip-level planning: departure + optional start/end (Step 8). */
  routePlanning: RoutePlanningContext;
  travelStats: RouteTravelStats;
};

const MEAL_BUFFER_MIN = 50;
const SAFETY_BUFFER_MIN = 35;
const FIRST_LEG_ASSUMED_MIN = 18;
/** Top scored candidates to compare with resolved legs (bounded live/cache work). */
const TOP_SLICE_FOR_NEXT_STOP = 8;
/** Second band: still use endpoint-aware rescoring before falling back to naive estimates. */
const TAIL_TRAVEL_AWARE_SLICE = 8;

function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  return false;
}

function dwellMinutes(c: ScoredCandidate, quick: boolean): number {
  const base =
    c.recommended_stay_minutes && c.recommended_stay_minutes > 0
      ? Math.min(180, c.recommended_stay_minutes)
      : 60;
  if (quick) return Math.max(20, Math.round(base * 0.55));
  return base;
}

function trialRowsAndStays(
  dayStops: SelectedStop[],
  byContentId: Map<string, JejuPoiRow>,
  c: ScoredCandidate,
  stay: number,
): { rows: JejuPoiRow[]; stays: number[] } | null {
  const rows: JejuPoiRow[] = [];
  const stays: number[] = [];
  for (const s of dayStops) {
    const r = byContentId.get(s.contentId);
    if (!r) return null;
    rows.push(r);
    stays.push(s.plannedStayMinutes);
  }
  const nr = byContentId.get(String(c.content_id));
  if (!nr) return null;
  rows.push(nr);
  stays.push(stay);
  return { rows, stays };
}

async function rescoredFirstStopSlice(args: {
  slice: ScoredCandidate[];
  dayPlanning: DayPlanningContext;
  dayStartAt: string | null;
  elapsedMinutes: number;
  byContentId: Map<string, JejuPoiRow>;
  quickPhoto: boolean;
  profile: RoutePreferenceProfile;
  parsed: ParsedRequestSlots;
  travelStats: RouteTravelStats;
}): Promise<
  {
    c: ScoredCandidate;
    row: JejuPoiRow | undefined;
    driveMin: number;
    stay: number;
    finalScore: number;
    routeCost: RouteCostSummary;
  }[]
> {
  const depLeg = estimateLegDepartureAt({
    dayStartAt: args.dayStartAt,
    elapsedMinutes: args.elapsedMinutes,
  });
  const out: {
    c: ScoredCandidate;
    row: JejuPoiRow | undefined;
    driveMin: number;
    stay: number;
    finalScore: number;
    routeCost: RouteCostSummary;
  }[] = [];

  for (const c of args.slice) {
    const row = args.byContentId.get(String(c.content_id));
    const leg = await resolveEndpointToPoiMinutes({
      endpoint: args.dayPlanning.startLocation,
      poiRow: row,
      departureAt: depLeg,
      stats: args.travelStats,
      fallbackAssumedMinutes: FIRST_LEG_ASSUMED_MIN,
    });
    const driveMin = leg.minutes;
    const stay = dwellMinutes(c, args.quickPhoto);
    const trial = trialRowsAndStays([], args.byContentId, c, stay);
    if (!trial) continue;
    const routeCost = await computeFullDayRouteCost({
      rows: trial.rows,
      stayMinutes: trial.stays,
      planning: args.dayPlanning,
      profile: args.profile,
      stats: args.travelStats,
    });
    const finalScore =
      c.score -
      routeCost.totalRoutePenalty +
      computeIconicDetourCredit(c.score, args.parsed, args.profile);
    out.push({ c, row, driveMin, stay, finalScore, routeCost });
  }

  out.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (a.routeCost.totalDriveMinutes !== b.routeCost.totalDriveMinutes) {
      return a.routeCost.totalDriveMinutes - b.routeCost.totalDriveMinutes;
    }
    if ((a.c.region ?? '') !== (b.c.region ?? '')) {
      return String(a.c.region ?? '').localeCompare(String(b.c.region ?? ''));
    }
    return String(a.c.content_id).localeCompare(String(b.c.content_id));
  });

  return out;
}

async function rescoredNextStopSlice(args: {
  slice: ScoredCandidate[];
  dayStops: SelectedStop[];
  prevRow: JejuPoiRow | undefined;
  dayPlanning: DayPlanningContext;
  byContentId: Map<string, JejuPoiRow>;
  quickPhoto: boolean;
  profile: RoutePreferenceProfile;
  parsed: ParsedRequestSlots;
  travelStats: RouteTravelStats;
  legMap: Map<string, { minutes: number }>;
}): Promise<
  {
    c: ScoredCandidate;
    row: JejuPoiRow | undefined;
    driveMin: number;
    stay: number;
    finalScore: number;
    routeCost: RouteCostSummary;
  }[]
> {
  const out: {
    c: ScoredCandidate;
    row: JejuPoiRow | undefined;
    driveMin: number;
    stay: number;
    finalScore: number;
    routeCost: RouteCostSummary;
  }[] = [];

  for (const c of args.slice) {
    const row = args.byContentId.get(String(c.content_id));
    const leg = row ? args.legMap.get(String(row.content_id)) : undefined;
    const driveMin =
      leg != null ? leg.minutes : travelMinutesBetweenRows(args.prevRow, row);
    const stay = dwellMinutes(c, args.quickPhoto);
    const trial = trialRowsAndStays(args.dayStops, args.byContentId, c, stay);
    if (!trial) continue;
    const routeCost = await computeFullDayRouteCost({
      rows: trial.rows,
      stayMinutes: trial.stays,
      planning: args.dayPlanning,
      profile: args.profile,
      stats: args.travelStats,
    });
    const finalScore =
      c.score -
      routeCost.totalRoutePenalty +
      computeIconicDetourCredit(c.score, args.parsed, args.profile);
    out.push({ c, row, driveMin, stay, finalScore, routeCost });
  }

  out.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (a.routeCost.totalDriveMinutes !== b.routeCost.totalDriveMinutes) {
      return a.routeCost.totalDriveMinutes - b.routeCost.totalDriveMinutes;
    }
    if ((a.c.region ?? '') !== (b.c.region ?? '')) {
      return String(a.c.region ?? '').localeCompare(String(b.c.region ?? ''));
    }
    return String(a.c.content_id).localeCompare(String(b.c.content_id));
  });

  return out;
}

type ScoredPick = {
  c: ScoredCandidate;
  row: JejuPoiRow | undefined;
  driveMin: number;
  stay: number;
};

async function returnMinutesAfterVisiting(
  lastRow: JejuPoiRow | undefined,
  planning: ReturnType<typeof createDayPlanningContext>,
  departureAfterLastVisit: string | null,
  stats: RouteTravelStats,
): Promise<number> {
  if (!planning.includeReturnToEndLocation || !planning.endLocation || !lastRow) return 0;
  const r = await resolvePoiToEndpointMinutes({
    poiRow: lastRow,
    endpoint: planning.endLocation,
    departureAt: departureAfterLastVisit,
    stats,
  });
  return r?.minutes ?? 0;
}

/**
 * Greedy pack stops per day within time budget. Multi-day consumes disjoint POIs.
 */
export async function assembleRoute(input: AssembleRouteInput): Promise<SelectedStop[]> {
  const quickPhoto = input.quickPhotoMode || bool(input.mergedValues['quick_photo_mode']);

  const profile = deriveRoutePreferenceProfileFromSlots(input.parsed, input.mergedValues);

  const chosenRegion = selectDayRegion({ scored: input.scored, parsed: input.parsed });
  const allowMixed = input.parserConfidence < 0.5;
  let pool = input.scored.filter(
    (c) =>
      allowMixed ||
      !chosenRegion ||
      chosenRegion === 'unknown' ||
      c.region === chosenRegion ||
      c.region == null,
  );

  const days = Math.max(1, Math.min(14, input.durationDays));
  const hours = Math.min(24, Math.max(1, input.availableHoursPerDay));
  const dayBudgetMin = Math.max(
    120,
    hours * 60 - MEAL_BUFFER_MIN - SAFETY_BUFFER_MIN,
  );

  const maxStopsPerDay = quickPhoto ? 3 : 4;
  const all: SelectedStop[] = [];
  const globallyUsed = new Set<string>();

  for (let d = 0; d < days; d++) {
    const dayPlanning = createDayPlanningContext({
      planning: input.routePlanning,
      dayIndex: d,
    });
    const dayStartAt = dayPlanning.dayStartAt;

    const dayStops: SelectedStop[] = [];
    let remaining = dayBudgetMin;
    let lastContentId: string | null = null;
    /** Minutes from day start through completed stays and drives (before next leg). */
    let elapsedMinutes = 0;

    while (dayStops.length < maxStopsPerDay) {
      const eligible = pool.filter((c) => !globallyUsed.has(c.content_id));
      if (eligible.length === 0) break;

      if (lastContentId == null) {
        const topSlice = eligible.slice(0, TOP_SLICE_FOR_NEXT_STOP);
        let rescored = await rescoredFirstStopSlice({
          slice: topSlice,
          dayPlanning,
          dayStartAt,
          elapsedMinutes,
          byContentId: input.byContentId,
          quickPhoto,
          profile,
          parsed: input.parsed,
          travelStats: input.travelStats,
        });

        if (eligible.length > TOP_SLICE_FOR_NEXT_STOP) {
          const tailSlice = eligible.slice(
            TOP_SLICE_FOR_NEXT_STOP,
            TOP_SLICE_FOR_NEXT_STOP + TAIL_TRAVEL_AWARE_SLICE,
          );
          const tailRescored = await rescoredFirstStopSlice({
            slice: tailSlice,
            dayPlanning,
            dayStartAt,
            elapsedMinutes,
            byContentId: input.byContentId,
            quickPhoto,
            profile,
            parsed: input.parsed,
            travelStats: input.travelStats,
          });
          rescored = [...rescored, ...tailRescored].sort((a, b) => {
            if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
            if (a.routeCost.totalDriveMinutes !== b.routeCost.totalDriveMinutes) {
              return a.routeCost.totalDriveMinutes - b.routeCost.totalDriveMinutes;
            }
            return String(a.c.content_id).localeCompare(String(b.c.content_id));
          });
        }

        let picked: ScoredPick | null = null;
        for (const s of rescored) {
          if (!s.row) continue;
          const depAfterVisit = estimateLegDepartureAt({
            dayStartAt,
            elapsedMinutes: elapsedMinutes + s.driveMin + s.stay,
          });
          const newReturn = await returnMinutesAfterVisiting(
            s.row,
            dayPlanning,
            depAfterVisit,
            input.travelStats,
          );
          const cost = s.driveMin + s.stay + newReturn;
          if (cost <= remaining || dayStops.length === 0) {
            picked = { c: s.c, row: s.row, driveMin: s.driveMin, stay: s.stay };
            break;
          }
        }

        if (picked == null) {
          const depLeg = estimateLegDepartureAt({ dayStartAt, elapsedMinutes });
          for (const c of eligible.slice(TOP_SLICE_FOR_NEXT_STOP + TAIL_TRAVEL_AWARE_SLICE)) {
            const row = input.byContentId.get(String(c.content_id));
            const leg = await resolveEndpointToPoiMinutes({
              endpoint: dayPlanning.startLocation,
              poiRow: row,
              departureAt: depLeg,
              stats: input.travelStats,
              fallbackAssumedMinutes: FIRST_LEG_ASSUMED_MIN,
            });
            const driveMin = leg.minutes;
            const stay = dwellMinutes(c, quickPhoto);
            const depAfterVisit = estimateLegDepartureAt({
              dayStartAt,
              elapsedMinutes: elapsedMinutes + driveMin + stay,
            });
            const newReturn = await returnMinutesAfterVisiting(
              row,
              dayPlanning,
              depAfterVisit,
              input.travelStats,
            );
            const cost = driveMin + stay + newReturn;
            if (cost <= remaining || dayStops.length === 0) {
              picked = { c, row, driveMin, stay };
              break;
            }
          }
        }

        if (picked == null) break;

        const depAfterVisitPicked = estimateLegDepartureAt({
          dayStartAt,
          elapsedMinutes: elapsedMinutes + picked.driveMin + picked.stay,
        });
        const cost =
          picked.driveMin +
          picked.stay +
          (await returnMinutesAfterVisiting(
            picked.row,
            dayPlanning,
            depAfterVisitPicked,
            input.travelStats,
          ));

        if (cost > remaining && dayStops.length === 0) {
          remaining = 0;
        } else {
          remaining -= cost;
        }
        dayStops.push({
          contentId: String(picked.c.content_id),
          poiId: picked.c.poi_id,
          stopType: 'poi',
          plannedStayMinutes: picked.stay,
          region: picked.c.region ?? null,
          score: picked.c.score,
        });
        globallyUsed.add(picked.c.content_id);
        lastContentId = String(picked.c.content_id);
        elapsedMinutes += picked.driveMin + picked.stay;
        continue;
      }

      const prevRow = input.byContentId.get(lastContentId);
      const depLeg = estimateLegDepartureAt({ dayStartAt, elapsedMinutes });
      const prevReturn = await returnMinutesAfterVisiting(
        prevRow,
        dayPlanning,
        depLeg,
        input.travelStats,
      );

      const topSlice = eligible.slice(0, TOP_SLICE_FOR_NEXT_STOP);
      const candidateRows: JejuPoiRow[] = [];
      for (const c of topSlice) {
        const row = input.byContentId.get(String(c.content_id));
        if (row) candidateRows.push(row);
      }

      const legMap = await resolveTopCandidateLegs({
        origin: prevRow,
        candidates: candidateRows,
        departureAt: depLeg,
        maxCandidatesForLive: TOP_SLICE_FOR_NEXT_STOP,
        stats: input.travelStats,
      });

      let rescored = await rescoredNextStopSlice({
        slice: topSlice,
        dayStops,
        prevRow,
        dayPlanning,
        byContentId: input.byContentId,
        quickPhoto,
        profile,
        parsed: input.parsed,
        travelStats: input.travelStats,
        legMap,
      });

      if (eligible.length > TOP_SLICE_FOR_NEXT_STOP) {
        const tailSlice = eligible.slice(
          TOP_SLICE_FOR_NEXT_STOP,
          TOP_SLICE_FOR_NEXT_STOP + TAIL_TRAVEL_AWARE_SLICE,
        );
        const tailRows: JejuPoiRow[] = [];
        for (const c of tailSlice) {
          const row = input.byContentId.get(String(c.content_id));
          if (row) tailRows.push(row);
        }
        const tailLegMap = await resolveTopCandidateLegs({
          origin: prevRow,
          candidates: tailRows,
          departureAt: depLeg,
          maxCandidatesForLive: TAIL_TRAVEL_AWARE_SLICE,
          stats: input.travelStats,
        });
        const tailRescored = await rescoredNextStopSlice({
          slice: tailSlice,
          dayStops,
          prevRow,
          dayPlanning,
          byContentId: input.byContentId,
          quickPhoto,
          profile,
          parsed: input.parsed,
          travelStats: input.travelStats,
          legMap: tailLegMap,
        });
        rescored = [...rescored, ...tailRescored].sort((a, b) => {
          if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
          if (a.routeCost.totalDriveMinutes !== b.routeCost.totalDriveMinutes) {
            return a.routeCost.totalDriveMinutes - b.routeCost.totalDriveMinutes;
          }
          return String(a.c.content_id).localeCompare(String(b.c.content_id));
        });
      }

      let picked: ScoredPick | null = null;
      for (const s of rescored) {
        if (!s.row) continue;
        const depAfterVisit = estimateLegDepartureAt({
          dayStartAt,
          elapsedMinutes: elapsedMinutes + s.driveMin + s.stay,
        });
        const newReturn = await returnMinutesAfterVisiting(
          s.row,
          dayPlanning,
          depAfterVisit,
          input.travelStats,
        );
        const incremental = s.driveMin + s.stay + newReturn - prevReturn;
        if (incremental <= remaining || dayStops.length === 0) {
          picked = { c: s.c, row: s.row, driveMin: s.driveMin, stay: s.stay };
          break;
        }
      }

      if (picked == null) {
        for (const c of eligible.slice(TOP_SLICE_FOR_NEXT_STOP + TAIL_TRAVEL_AWARE_SLICE)) {
          const row = input.byContentId.get(String(c.content_id));
          const driveMin = travelMinutesBetweenRows(prevRow, row);
          const stay = dwellMinutes(c, quickPhoto);
          const depAfterVisit = estimateLegDepartureAt({
            dayStartAt,
            elapsedMinutes: elapsedMinutes + driveMin + stay,
          });
          const newReturn = await returnMinutesAfterVisiting(
            row,
            dayPlanning,
            depAfterVisit,
            input.travelStats,
          );
          const incremental = driveMin + stay + newReturn - prevReturn;
          if (incremental <= remaining || dayStops.length === 0) {
            picked = { c, row, driveMin, stay };
            break;
          }
        }
      }

      if (picked == null) break;

      const depAfterVisitPicked = estimateLegDepartureAt({
        dayStartAt,
        elapsedMinutes: elapsedMinutes + picked.driveMin + picked.stay,
      });
      const newReturn = await returnMinutesAfterVisiting(
        picked.row,
        dayPlanning,
        depAfterVisitPicked,
        input.travelStats,
      );
      const incremental = picked.driveMin + picked.stay + newReturn - prevReturn;

      if (incremental > remaining && dayStops.length === 0) {
        remaining = 0;
      } else {
        remaining -= incremental;
      }

      dayStops.push({
        contentId: String(picked.c.content_id),
        poiId: picked.c.poi_id,
        stopType: 'poi',
        plannedStayMinutes: picked.stay,
        region: picked.c.region ?? null,
        score: picked.c.score,
      });
      globallyUsed.add(picked.c.content_id);
      lastContentId = String(picked.c.content_id);
      elapsedMinutes += picked.driveMin + picked.stay;
    }

    all.push(...dayStops);
    pool = pool.filter((c) => !globallyUsed.has(c.content_id));
    if (pool.length === 0) break;
  }

  return all;
}
