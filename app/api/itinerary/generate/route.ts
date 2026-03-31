import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { fetchJejuPoiCandidates, candidatesToPromptSlice } from '@/lib/itinerary/candidate-query';
import { generateGeminiDraft } from '@/lib/itinerary/gemini-generate';
import { reviewWithClaude } from '@/lib/itinerary/claude-review';
import { compactRepairMetrics, validateDraftAgainstDb } from '@/lib/itinerary/validation';
import { hydrateStops } from '@/lib/itinerary/merge-poi-details';
import { buildRuleBasedDraft } from '@/lib/itinerary/rule-based-fallback';
import {
  appendPipelineEvent,
  defaultProviderStatus,
  insertItineraryPipelineLog,
  updateItineraryPipelineLog,
  type PipelineEventRecord,
  type ProviderStatusMap,
} from '@/lib/itinerary/pipeline-log';
import { getItineraryPromptVersionsRecord } from '@/lib/itinerary/prompt-versions';
import { sanitizeItineraryForPipelineLog } from '@/lib/itinerary/log-sanitize';
import {
  itineraryUserInputSchema,
  type GeneratedItineraryResponse,
  type ItineraryReviewSummary,
  type JejuPoiRow,
  type RouteMetrics,
  type ValidationMeta,
  type ValidationRepair,
} from '@/lib/itinerary/types';
// ── parser-first + SQL-first imports (Step 3) ─────────────────
import { extractParserInputFromInput } from '@/lib/itinerary/reco/extract-parser-input';
import {
  buildFixedCandidatePool,
  assertContentIdsWithinPool,
} from '@/lib/itinerary/reco/build-fixed-candidate-pool';
import { composeDeterministicItinerary } from '@/lib/itinerary/reco/compose-deterministic';
import { normalizeRoutePreferenceContext } from '@/lib/itinerary/reco/normalize-route-preference-context';
import { persistItineraryRun } from '@/lib/itinerary/reco/persist-itinerary-run';
import { computeFinalTravelStatsForDraftStops } from '@/lib/itinerary/reco/route-cost';
import { enrichValidationMetaWithTravelTimeResolution } from '@/lib/itinerary/reco/travel-time';
import type { RouteTravelStats } from '@/lib/itinerary/reco/route-travel-resolver';
import { buildReusableRequestSignature } from '@/lib/itinerary/reuse/request-signature';
import { stripDevOnlyFields } from '@/lib/itinerary/reuse/strip-dev-only-fields';
import { findReusableItinerary } from '@/lib/itinerary/reuse/find-reusable-itinerary';
import { buildDraftFromReuseSequence } from '@/lib/itinerary/reuse/build-draft-from-reuse';
import { routePlanningHasEndpoints, runEndpointAwarePolishPass } from '@/lib/itinerary/route-feasibility';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function buildUserInputSlice(input: {
  destination: string;
  durationDays: number;
  travelStyle?: string;
  indoorOutdoor: string;
}) {
  return {
    destination: input.destination,
    durationDays: input.durationDays,
    travelStyle: input.travelStyle,
    indoorOutdoor: input.indoorOutdoor,
  };
}

export async function POST(req: Request) {
  const events: PipelineEventRecord[] = [];
  let providerStatus: ProviderStatusMap = defaultProviderStatus();
  let fallbackReason: string | null = null;
  let logId: number | null = null;
  let userInputSliceForLog: Record<string, unknown> = {};
  let supabaseRef: ReturnType<typeof createServerClient> | null = null;

  const syncPipelineLog = async (extra?: Record<string, unknown>) => {
    if (logId == null || supabaseRef == null) return;
    const last = events[events.length - 1];
    await updateItineraryPipelineLog(supabaseRef, logId, {
      pipeline_stage: last?.stage ?? 'failed',
      pipeline_events: events,
      provider_status: providerStatus,
      fallback_reason: fallbackReason,
      ...extra,
    });
  };

  try {
    const body = await req.json().catch(() => ({}));
    const input = itineraryUserInputSchema.parse(body);
    /** Excludes dev-only flags so reuse signatures match production for the same trip intent. */
    const bodyForReuseSignature = stripDevOnlyFields(input as unknown as Record<string, unknown>);
    userInputSliceForLog = buildUserInputSlice(input);
    supabaseRef = createServerClient();

    appendPipelineEvent(events, 'request_received', true, {
      durationDays: input.durationDays,
    });

    logId = await insertItineraryPipelineLog(supabaseRef, {
      userInputSlice: userInputSliceForLog,
      events: [...events],
      providerStatus,
    });

    // ── Step 3: parser-first + SQL-first candidate pool ───────
    // Runs before any LLM call. Establishes the hard POI boundary.
    // Non-fatal: if the SQL pool is empty we fall through to the legacy path
    // and log a warning, preserving backward compatibility.
    const parserInput = extractParserInputFromInput(input);
    let fixedPool: Awaited<ReturnType<typeof buildFixedCandidatePool>> | null = null;
    let usedParserFirstPath = false;

    try {
      fixedPool = await buildFixedCandidatePool(parserInput, 55, true);
      usedParserFirstPath = fixedPool.candidatePoiIds.length > 0;

      if (fixedPool.persistenceError) {
        console.warn('[itinerary] parser persistence error (non-fatal):', fixedPool.persistenceError);
      }

      appendPipelineEvent(events, 'candidate_fetched', true, {
        candidates: fixedPool.candidates.length,
        parserSource: 1,
        parseSource: fixedPool.parsed.parseSource === 'empty' ? 0 : 1,
        parserConfidence: Math.round((fixedPool.parsed.parserConfidence ?? 0) * 100),
      });
      await syncPipelineLog({
        candidate_ids: fixedPool.candidateContentIds,
      });
    } catch (parserErr) {
      console.warn('[itinerary] parser-first path failed, falling back to legacy candidate query:', parserErr);
      appendPipelineEvent(events, 'candidate_fetched', false, { parserFallback: 1 });
    }

    // ── Legacy candidate fetch (fallback or supplement) ───────
    // Always runs to populate JejuPoiRow objects needed by downstream helpers
    // (validateDraftAgainstDb, hydrateStops, buildRuleBasedDraft all require JejuPoiRow).
    // When the SQL pool succeeded, we filter the legacy rows to the fixed pool boundary.
    const allLegacyCandidates = await fetchJejuPoiCandidates(supabaseRef, input, 55);

    // Build the working candidate list:
    // - If SQL pool succeeded: filter legacy rows to only those in the fixed pool
    //   (preserves JejuPoiRow shape needed by downstream; enforces SQL boundary)
    // - If SQL pool failed/empty: use all legacy candidates (backward-compatible fallback)
    let candidates: JejuPoiRow[];
    if (usedParserFirstPath && fixedPool != null) {
      const allowedSet = new Set(fixedPool.candidateContentIds);
      const filtered = allLegacyCandidates.filter((r) => allowedSet.has(String(r.content_id)));
      // If filtering removed everything (e.g. bootstrap not yet run), fall back gracefully
      candidates = filtered.length > 0 ? filtered : allLegacyCandidates;
      if (filtered.length === 0) {
        console.warn('[itinerary] SQL pool filter yielded 0 legacy rows — using unfiltered legacy candidates. Run bootstrap to populate poi_search_profile.');
        fallbackReason = fallbackReason ?? 'sql_pool_filter_empty';
      }
    } else {
      candidates = allLegacyCandidates;
      fallbackReason = fallbackReason ?? 'parser_path_failed';
    }

    if (candidates.length === 0) {
      appendPipelineEvent(events, 'failed', false, { candidates: 0 });
      await syncPipelineLog();
      return NextResponse.json(
        { error: 'No Jeju POI candidates found. Import/score data first.' },
        { status: 400 },
      );
    }

    const byId = new Map<string, JejuPoiRow>(candidates.map((r) => [String(r.content_id), r]));
    const candidatesJson = candidatesToPromptSlice(candidates);
    const candidateIds = candidates.map((c) => String(c.content_id));

    const routePreferenceContext = normalizeRoutePreferenceContext({ fixedPool, input });
    const routePlanningCtx = {
      departureAt: input.departureAt ?? null,
      startLocation: input.startLocation ?? null,
      endLocation: input.endLocation ?? null,
      includeReturnToEndLocation: input.includeReturnToEndLocation ?? false,
    };

    let draft = buildRuleBasedDraft(candidates, input);
    let geminiModel = 'fallback';
    let claudeModel = 'skipped';
    let geminiRaw: unknown = null;
    let claudeRaw: unknown = null;
    let usedFallback = true;
    let claudeReviewSummary: ItineraryReviewSummary | undefined;
    let deterministicCompositionUsed = false;
    let assemblyTravelStats: RouteTravelStats | null = null;
    let reuseSource: 'fresh' | 'run' | 'template' = 'fresh';
    let reusedRunId: string | undefined;
    let reusedTemplateId: string | undefined;
    let reuseSimilarityScore: number | undefined;

    if (usedParserFirstPath && fixedPool != null && candidates.length > 0) {
      let reuseAccepted = false;
      const skipReuseForDebug =
        process.env.NODE_ENV === 'development' && input.debugNoReuse === true;
      if (!skipReuseForDebug) {
        try {
          const signature = buildReusableRequestSignature({
            parsedSlots: routePreferenceContext.parsedSlots ?? null,
            mergedValues: routePreferenceContext.mergedValues ?? null,
            body: bodyForReuseSignature,
            durationDays: input.durationDays,
            routePlanning: routePlanningCtx,
          });
          const reuse = await findReusableItinerary({
            supabase: supabaseRef,
            signature,
            candidateContentIds: fixedPool.candidateContentIds,
            parsedSlots: routePreferenceContext.parsedSlots ?? fixedPool.parsed.slots,
            byId,
          });
          if (reuse.accepted && reuse.contentIdSequence.length > 0) {
            draft = buildDraftFromReuseSequence(reuse.contentIdSequence, input, byId);
            assemblyTravelStats = await computeFinalTravelStatsForDraftStops({
              stops: draft.stops,
              byId,
              routePlanning: routePlanningCtx,
              parsedSlots: routePreferenceContext.parsedSlots ?? fixedPool.parsed.slots,
              mergedValues: routePreferenceContext.mergedValues ?? {},
            });
            reuseSource = reuse.source === 'template' ? 'template' : 'run';
            reusedRunId = reuse.runId;
            reusedTemplateId = reuse.templateId;
            reuseSimilarityScore = reuse.similarityScore;
            reuseAccepted = true;
            usedFallback = false;
            deterministicCompositionUsed = true;
            geminiModel = 'deterministic_reuse';
            appendPipelineEvent(events, 'gemini_generated', true, {
              deterministic: 1,
              reuse: 1,
              stops: draft.stops.length,
            });
            providerStatus = { ...providerStatus, gemini: 'skipped' };
          }
        } catch (reuseErr) {
          console.warn('[itinerary] reuse lookup failed', reuseErr);
        }
      }

      if (!reuseAccepted) {
        try {
          const comp = await composeDeterministicItinerary({
            fixedPool,
            input,
            poolRows: candidates,
            routePreferenceContext,
          });
          draft = comp.draft;
          geminiModel = comp.geminiModel;
          geminiRaw = comp.geminiRaw;
          assemblyTravelStats = comp.assemblyTravelStats;
          usedFallback = false;
          deterministicCompositionUsed = true;
          providerStatus = {
            ...providerStatus,
            gemini: comp.usedGeminiCopy ? 'success' : 'skipped',
          };
          appendPipelineEvent(events, 'gemini_generated', true, {
            deterministic: 1,
            copyOnly: comp.usedGeminiCopy ? 1 : 0,
            stops: draft.stops.length,
          });
        } catch (detErr) {
          console.warn(
            '[itinerary] deterministic composition failed, falling back to legacy draft path:',
            detErr,
          );
          draft = buildRuleBasedDraft(candidates, input);
          deterministicCompositionUsed = false;
          fallbackReason = fallbackReason ?? 'deterministic_compose_failed';
        }
      }
    }

    if (!deterministicCompositionUsed && process.env.GEMINI_API_KEY?.trim()) {
      try {
        const g = await generateGeminiDraft(candidatesJson, input);
        // Guard: reject any POI the LLM chose outside the fixed SQL pool
        if (usedParserFirstPath && fixedPool != null) {
          try {
            assertContentIdsWithinPool(
              g.draft.stops.map((s) => s.contentId),
              fixedPool.candidateContentIds,
            );
          } catch (guardErr) {
            // Log the violation but don't crash — filter to valid stops instead
            console.warn('[itinerary] Gemini pool guard triggered:', guardErr instanceof Error ? guardErr.message : guardErr);
            g.draft.stops = g.draft.stops.filter((s) =>
              new Set(fixedPool!.candidateContentIds).has(s.contentId),
            );
            fallbackReason = fallbackReason ?? 'gemini_pool_violation_filtered';
          }
        }
        draft = g.draft;
        geminiModel = g.model;
        geminiRaw = g.rawText;
        usedFallback = false;
        appendPipelineEvent(events, 'gemini_generated', true, {
          stops: g.draft.stops.length,
        });
        providerStatus = { ...providerStatus, gemini: 'success' };
      } catch (e) {
        console.warn('[itinerary] Gemini failed, using rule-based draft', e);
        draft = buildRuleBasedDraft(candidates, input);
        geminiRaw = e instanceof Error ? e.message : String(e);
        usedFallback = true;
        appendPipelineEvent(events, 'gemini_generated', false, { error: 1 });
        appendPipelineEvent(events, 'fallback_used', true, { geminiFail: 1 });
        providerStatus = { ...providerStatus, gemini: 'failed' };
        fallbackReason = 'gemini_failed';
      }
    } else if (!deterministicCompositionUsed) {
      appendPipelineEvent(events, 'gemini_generated', true, { skipped: 1 });
      appendPipelineEvent(events, 'fallback_used', true, { noGeminiKey: 1 });
      providerStatus = { ...providerStatus, gemini: 'skipped' };
      fallbackReason = fallbackReason ?? 'no_gemini_key';
    }
    await syncPipelineLog();

    if (!deterministicCompositionUsed && process.env.ANTHROPIC_API_KEY?.trim()) {
      try {
        const c = await reviewWithClaude(draft, candidatesJson, input);
        // Guard: reject any POI Claude chose outside the fixed SQL pool
        if (usedParserFirstPath && fixedPool != null) {
          try {
            assertContentIdsWithinPool(
              c.draft.stops.map((s) => s.contentId),
              fixedPool.candidateContentIds,
            );
          } catch (guardErr) {
            console.warn('[itinerary] Claude pool guard triggered:', guardErr instanceof Error ? guardErr.message : guardErr);
            c.draft.stops = c.draft.stops.filter((s) =>
              new Set(fixedPool!.candidateContentIds).has(s.contentId),
            );
            fallbackReason = fallbackReason ?? 'claude_pool_violation_filtered';
          }
        }
        draft = c.draft;
        claudeReviewSummary = c.reviewSummary;
        claudeModel = c.model;
        claudeRaw = c.rawText;
        appendPipelineEvent(events, 'claude_reviewed', true, {
          changed: c.reviewSummary.changed ? 1 : 0,
        });
        providerStatus = { ...providerStatus, claude: 'success' };
      } catch (e) {
        console.warn('[itinerary] Claude review failed; using Gemini/rule draft', e);
        claudeRaw = e instanceof Error ? e.message : String(e);
        appendPipelineEvent(events, 'claude_reviewed', false, { error: 1 });
        providerStatus = { ...providerStatus, claude: 'failed' };
      }
    } else {
      appendPipelineEvent(events, 'claude_reviewed', true, { skipped: 1 });
      providerStatus = { ...providerStatus, claude: 'skipped' };
    }
    await syncPipelineLog();

    const validateOpts = {
      availableHoursPerDay: input.availableHours ?? 8,
      durationDays: input.durationDays,
      routePlanning: routePlanningCtx,
      routePreferenceContext,
    };

    let validated = await validateDraftAgainstDb(draft, byId, validateOpts);
    draft = validated.draft;
    let mergedWarnings: string[] = [...validated.warnings];
    let mergedRepairs: ValidationRepair[] = [...validated.repairs];
    let mergedMeta: ValidationMeta = validated.meta;
    let didValidationRecovery = false;

    if (draft.stops.length === 0) {
      draft = buildRuleBasedDraft(candidates, input);
      validated = await validateDraftAgainstDb(draft, byId, validateOpts);
      draft = validated.draft;
      mergedWarnings.push(...validated.warnings);
      mergedRepairs.push(...validated.repairs);
      mergedMeta = validated.meta;
      mergedWarnings.push('All model stops were invalid; used rule-based recovery.');
      appendPipelineEvent(events, 'fallback_used', true, { validationRecovery: 1 });
      fallbackReason = fallbackReason ?? 'validation_recovery';
      didValidationRecovery = true;
    }

    let endpointAwarePolishUsed = false;
    if (deterministicCompositionUsed && routePlanningHasEndpoints(routePlanningCtx)) {
      const pol = await runEndpointAwarePolishPass({
        stops: draft.stops,
        byId,
        departureAt: input.departureAt ?? null,
        routePlanning: routePlanningCtx,
        routePreferenceContext,
      });
      if (pol.improved) {
        endpointAwarePolishUsed = Boolean(pol.endpointAwarePolishUsed);
        const v2 = await validateDraftAgainstDb({ ...draft, stops: pol.stops }, byId, validateOpts);
        draft = v2.draft;
        mergedWarnings.push(...v2.warnings);
        mergedRepairs.push(...v2.repairs);
        mergedMeta = v2.meta;
        if (routePreferenceContext.parsedSlots && routePreferenceContext.mergedValues) {
          assemblyTravelStats = await computeFinalTravelStatsForDraftStops({
            stops: draft.stops,
            byId,
            routePlanning: routePlanningCtx,
            parsedSlots: routePreferenceContext.parsedSlots,
            mergedValues: routePreferenceContext.mergedValues,
          });
        }
      }
    }

    mergedMeta = {
      ...mergedMeta,
      ...(assemblyTravelStats != null
        ? {
            assemblyFreshCacheHits: assemblyTravelStats.freshCacheHits,
            assemblyLiveRefreshes: assemblyTravelStats.liveRefreshes,
            assemblyStaleFallbacks: assemblyTravelStats.staleFallbacks,
            assemblyEstimateFallbacks: assemblyTravelStats.estimateFallbacks,
            assemblyRegionFallbacks: assemblyTravelStats.regionFallbacks,
            assemblyLegacyAssumedFallbacks: assemblyTravelStats.legacyAssumedFallbacks,
            assemblyEndpointCacheFreshHits: assemblyTravelStats.endpointCacheFreshHits,
            assemblyEndpointCacheStaleHits: assemblyTravelStats.endpointCacheStaleHits,
            assemblyEndpointLiveRefreshes: assemblyTravelStats.endpointLiveRefreshes,
            assemblyEndpointEstimatedFallbacks: assemblyTravelStats.endpointEstimatedFallbacks,
            assemblyEndpointCacheWrites: assemblyTravelStats.endpointCacheWrites,
            finalTravelStatsIsolated: true,
          }
        : {}),
      ...(endpointAwarePolishUsed ? { endpointAwarePolishUsed: true } : {}),
    };

    try {
      const enriched = await enrichValidationMetaWithTravelTimeResolution({
        meta: mergedMeta,
        stops: draft.stops,
        byId,
        departureAt: input.departureAt ?? null,
      });
      mergedMeta = enriched.meta;
      appendPipelineEvent(events, 'travel_time_resolved', true, {
        bucket:
          enriched.stats.timeBucket === 'am_peak'
            ? 1
            : enriched.stats.timeBucket === 'pm_peak'
              ? 2
              : enriched.stats.timeBucket === 'weekend'
                ? 3
                : 0,
        kakaoLive: enriched.stats.kakaoLiveUsed ? 1 : 0,
        freshCache: enriched.stats.freshCacheHits,
        staleCache: enriched.stats.staleCacheHits,
        liveRefresh: enriched.stats.liveRefreshCount,
        estFallback: enriched.stats.estimateFallbackCount,
      });
    } catch (travelErr) {
      console.warn('[itinerary] travel-time enrichment skipped', travelErr);
    }

    const routeKmDec =
      mergedMeta.totalTravelDistanceKm != null
        ? Math.round(mergedMeta.totalTravelDistanceKm * 10)
        : 0;
    appendPipelineEvent(events, 'validated', true, {
      stops: draft.stops.length,
      warnings: mergedWarnings.length,
      recovery: didValidationRecovery ? 1 : 0,
      estMin: mergedMeta.totalEstimatedMin,
      budgetMin: mergedMeta.budgetMin,
      routeTravelMin: mergedMeta.estimatedTotalTravelMinutes,
      routeVisitMin: mergedMeta.estimatedTotalVisitMinutes,
      routeDayMin: mergedMeta.estimatedTotalDayMinutes,
      routeCoordLegs: mergedMeta.coordinateLegCount,
      routeLegs: mergedMeta.totalLegCount,
      routeKmDec,
      ...compactRepairMetrics(mergedRepairs),
    });
    await syncPipelineLog();

    const locale = input.locale ?? 'ko';
    const stops = hydrateStops(draft, byId, locale);
    appendPipelineEvent(events, 'hydrated', true, { stops: stops.length });
    await syncPipelineLog();

    const warnings = [...(draft.warnings ?? []), ...mergedWarnings];

    if (deterministicCompositionUsed && fixedPool?.requestProfileId && supabaseRef) {
      const persistSignature = buildReusableRequestSignature({
        parsedSlots: routePreferenceContext.parsedSlots ?? null,
        mergedValues: routePreferenceContext.mergedValues ?? null,
        body: bodyForReuseSignature,
        durationDays: input.durationDays,
        routePlanning: routePlanningCtx,
      });
      await persistItineraryRun(supabaseRef, {
        requestProfileId: fixedPool.requestProfileId,
        generationLogId: logId,
        draft,
        templateId: reuseSource === 'template' ? reusedTemplateId ?? null : null,
        routeSummary: {
          deterministic: true,
          reuseSource,
          reusedRunId: reusedRunId ?? null,
          reusedTemplateId: reusedTemplateId ?? null,
          reuseSimilarityScore: reuseSimilarityScore ?? null,
          signature: persistSignature,
          candidateContentIds: fixedPool.candidateContentIds,
          routePreferenceSnapshot: routePreferenceContext,
          routePlanningSnapshot: routePlanningCtx,
          parserConfidence: fixedPool.parsed.parserConfidence,
          parseSource: fixedPool.parsed.parseSource,
          poolCandidateCount: fixedPool.candidates.length,
          finalStopCount: draft.stops.length,
          kakaoLiveUsed: mergedMeta.travelTimeResolution?.kakaoLiveUsed ?? false,
          travelTimeResolution: mergedMeta.travelTimeResolution ?? null,
        },
      });
    }

    const routeMetrics: RouteMetrics = {
      estimatedTotalTravelMinutes: mergedMeta.estimatedTotalTravelMinutes,
      estimatedTotalVisitMinutes: mergedMeta.estimatedTotalVisitMinutes,
      estimatedTotalDayMinutes: mergedMeta.estimatedTotalDayMinutes,
      coordinateLegCount: mergedMeta.coordinateLegCount,
      totalLegCount: mergedMeta.totalLegCount,
      totalTravelDistanceKm: mergedMeta.totalTravelDistanceKm,
    };

    const response: GeneratedItineraryResponse = {
      tourTitle: draft.tourTitle,
      tourSummary: draft.tourSummary,
      routeMetrics,
      stops,
      warnings,
      generationMeta: {
        candidateCount: candidates.length,
        geminiModel,
        claudeModel,
        usedFallback,
        validationRepairs: mergedRepairs,
        validationMeta: mergedMeta,
        ...(claudeReviewSummary != null ? { claudeReviewSummary } : {}),
        ...(deterministicCompositionUsed
          ? {
              reusedItinerary: reuseSource !== 'fresh',
              reuseSource,
              ...(reusedRunId != null ? { reusedRunId } : {}),
              ...(reusedTemplateId != null ? { reusedTemplateId } : {}),
              ...(reuseSimilarityScore != null ? { reuseSimilarityScore } : {}),
            }
          : {}),
      },
    };

    appendPipelineEvent(events, 'completed', true, { stops: stops.length });
    const geminiRawStored =
      typeof geminiRaw === 'string' ? { text: geminiRaw.slice(0, 120000) } : geminiRaw;
    const claudeRawStored =
      typeof claudeRaw === 'string' ? { text: String(claudeRaw).slice(0, 120000) } : claudeRaw;

    const finalResultForLog = sanitizeItineraryForPipelineLog(response);

    await syncPipelineLog({
      candidate_ids: candidateIds,
      gemini_raw: geminiRawStored,
      claude_raw: claudeRawStored,
      final_result: finalResultForLog,
      pipeline_stage: 'completed',
    });

    if (logId == null && supabaseRef != null) {
      try {
        await supabaseRef.from('itinerary_generation_logs').insert({
          user_input: userInputSliceForLog,
          candidate_ids: candidateIds,
          pipeline_stage: 'completed',
          pipeline_events: events,
          prompt_versions: getItineraryPromptVersionsRecord(),
          provider_status: providerStatus,
          fallback_reason: fallbackReason,
          gemini_raw: geminiRawStored,
          claude_raw: claudeRawStored,
          final_result: finalResultForLog,
        });
      } catch (e) {
        console.warn('[itinerary] full log insert skipped', e);
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[itinerary/generate]', error);
    try {
      appendPipelineEvent(events, 'failed', false, { error: 1 });
      if (supabaseRef != null && logId != null) {
        await updateItineraryPipelineLog(supabaseRef, logId, {
          pipeline_stage: 'failed',
          pipeline_events: events,
          provider_status: providerStatus,
          fallback_reason: fallbackReason,
        });
      } else if (supabaseRef != null && events.length > 0) {
        await supabaseRef.from('itinerary_generation_logs').insert({
          user_input: userInputSliceForLog,
          candidate_ids: [],
          pipeline_stage: 'failed',
          pipeline_events: events,
          prompt_versions: getItineraryPromptVersionsRecord(),
          provider_status: providerStatus,
          fallback_reason: fallbackReason,
        });
      }
    } catch (logErr) {
      console.warn('[itinerary] failed-state log skipped', logErr);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 },
    );
  }
}
