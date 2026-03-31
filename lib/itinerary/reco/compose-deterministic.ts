/**
 * Parser-first deterministic composition: score → assemble → flex → draft.
 * Optional Gemini pass rewrites title/summary only.
 */
import type { FixedCandidatePoolResult } from '@/lib/itinerary/reco/build-fixed-candidate-pool';
import { fetchRecoFeaturesForPoiIds } from '@/lib/itinerary/reco/fetch-reco-features';
import { scoreCandidates } from '@/lib/itinerary/reco/score-candidates';
import { assembleRoute } from '@/lib/itinerary/reco/assemble-route';
import { insertFlexStops } from '@/lib/itinerary/reco/insert-flex-stops';
import {
  createEmptyRouteTravelStats,
  type RouteTravelStats,
} from '@/lib/itinerary/reco/route-travel-resolver';
import { computeFinalTravelStatsForDraftStops } from '@/lib/itinerary/reco/route-cost';
import { selectDayRegion } from '@/lib/itinerary/reco/select-day-region';
import { buildDeterministicDraft } from '@/lib/itinerary/reco/deterministic-draft';
import { generateGeminiTourCopyOnly } from '@/lib/itinerary/gemini-tour-copy';
import type { GeminiDraft } from '@/lib/itinerary/types';
import type { ItineraryUserInput } from '@/lib/itinerary/types';
import type { JejuPoiRow } from '@/lib/itinerary/types';
import type { RoutePreferenceReorderContext } from '@/lib/itinerary/route-feasibility';

export type DeterministicComposeResult = {
  draft: GeminiDraft;
  geminiModel: string;
  geminiRaw: unknown;
  usedGeminiCopy: boolean;
  /** Resolver stats for the final chosen route only (exploratory trial stats are discarded). */
  assemblyTravelStats: RouteTravelStats;
};

export async function composeDeterministicItinerary(params: {
  fixedPool: FixedCandidatePoolResult;
  input: ItineraryUserInput;
  /** Legacy rows restricted to the SQL pool — used for travel + hydration. */
  poolRows: JejuPoiRow[];
  /** Normalized preference context (assembly + validation + meta alignment). */
  routePreferenceContext: RoutePreferenceReorderContext;
}): Promise<DeterministicComposeResult> {
  const { fixedPool, input, poolRows, routePreferenceContext } = params;
  const byContentId = new Map(poolRows.map((r) => [String(r.content_id), r]));

  const mergedValues =
    routePreferenceContext.mergedValues ?? fixedPool.mergedParserResult.values;
  const parsedSlots = routePreferenceContext.parsedSlots ?? fixedPool.parsed.slots;

  const recoByPoiId = await fetchRecoFeaturesForPoiIds(fixedPool.candidatePoiIds);

  const scored = scoreCandidates({
    candidates: fixedPool.candidates,
    recoByPoiId,
    parsed: parsedSlots,
    parserConfidence: fixedPool.parsed.parserConfidence,
    durationDays: input.durationDays,
    mergedValues,
    input,
  });

  const chosenRegion = selectDayRegion({ scored, parsed: parsedSlots });

  const exploratoryTravelStats = createEmptyRouteTravelStats();

  const routePlanning = {
    departureAt: input.departureAt ?? null,
    startLocation: input.startLocation ?? null,
    endLocation: input.endLocation ?? null,
    includeReturnToEndLocation: input.includeReturnToEndLocation ?? false,
  };

  const baseStops = await assembleRoute({
    scored,
    parsed: parsedSlots,
    parserConfidence: fixedPool.parsed.parserConfidence,
    durationDays: input.durationDays,
    availableHoursPerDay: input.availableHours ?? 8,
    byContentId,
    mergedValues,
    quickPhotoMode: input.quickPhotoMode === true,
    routePlanning,
    travelStats: exploratoryTravelStats,
  });

  const withFlex = await insertFlexStops({
    baseStops,
    scored,
    recoByPoiId,
    parsed: parsedSlots,
    regionFilter: chosenRegion,
    byContentId,
    departureAt: input.departureAt ?? null,
    travelStats: exploratoryTravelStats,
  });

  let draft = buildDeterministicDraft(withFlex, input, byContentId);

  const assemblyTravelStats = await computeFinalTravelStatsForDraftStops({
    stops: draft.stops,
    byId: byContentId,
    routePlanning,
    parsedSlots,
    mergedValues,
  });

  let geminiModel = 'deterministic';
  let geminiRaw: unknown = null;
  let usedGeminiCopy = false;

  if (process.env.GEMINI_API_KEY?.trim()) {
    try {
      const copy = await generateGeminiTourCopyOnly(draft, input);
      draft = {
        ...draft,
        tourTitle: copy.tourTitle,
        tourSummary: copy.tourSummary,
      };
      geminiModel = copy.model;
      geminiRaw = copy.rawText;
      usedGeminiCopy = true;
    } catch (e) {
      geminiRaw = e instanceof Error ? e.message : String(e);
    }
  }

  return { draft, geminiModel, geminiRaw, usedGeminiCopy, assemblyTravelStats };
}
