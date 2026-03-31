/**
 * Parser-first + SQL-first candidate pool builder.
 *
 * Orchestrates:
 *   1. Run 4-stage parser → MergedParserResult (stage1 rules, stage2 synonyms,
 *      stage3 similarity, stage4 LLM slot filler when needed)
 *   2. Bridge merged slots to ParsedRequestSlots for SQL candidate query
 *   3. Query lean POI candidates via get_poi_candidates() RPC
 *   4. Persist request_profiles + request_parse_logs (non-throwing)
 *
 * The returned candidatePoiIds is the hard boundary for downstream LLM stages.
 * No LLM may select a POI outside this set.
 *
 * parserHints from UI are applied inside parseRequest via the narrow allowlist
 * in lib/parser/merge.ts. They do NOT broadly overwrite all parsed slots.
 *
 * Persistence is non-throwing: a DB write failure is recorded in persistenceError
 * but never breaks the generation flow.
 */
import { parseRequest } from '@/lib/parser/parse-request';
import { getParserSlotFillerCallJsonModel } from '@/lib/parser/call-slot-filler-llm';
import { buildMergedResultLog } from '@/lib/parser/debug';
import type { LeanPoiCandidate } from '@/lib/itinerary/reco/get-poi-candidates';
import { fetchCandidatesWithRecovery } from '@/lib/itinerary/reco/candidate-pool-recovery';
import { applyDeterministicSlotInference } from '@/lib/itinerary/reco/slot-inference';
import type { ParsedRequestSlots, DeterministicParserResult } from '@/lib/itinerary/parser/types';
import type { MergedParserResult } from '@/lib/parser/types';
import { createServerClient } from '@/lib/supabase';
import type { ParserInput } from '@/lib/itinerary/reco/extract-parser-input';

export type FixedCandidatePoolResult = {
  /**
   * Adapter view of the merged parser result shaped as DeterministicParserResult
   * for backward compatibility with the existing route (reads .parsed.parseSource,
   * .parsed.parserConfidence, .parsed.slots, .parsed.matchedRules, etc.)
   */
  parsed: DeterministicParserResult;
  /** Full merged result from the 4-stage parser (new, inspectable). */
  mergedParserResult: MergedParserResult;
  candidates: LeanPoiCandidate[];
  /** Numeric poi_ids of the fixed candidate set — hard boundary for LLM stages. */
  candidatePoiIds: number[];
  /** content_id strings of the fixed candidate set — used by legacy byId map. */
  candidateContentIds: string[];
  requestProfileId: string | null;
  parseLogId: string | null;
  persistenceError: string | null;
};

/**
 * Bridge MergedParserResult.values (snake_case SlotMap) to the typed
 * ParsedRequestSlots (camelCase) expected by getPoiCandidates().
 *
 * Only the slots that get_poi_candidates() uses are mapped here.
 * Unknown slots in values are silently ignored.
 */
function bridgeToSlots(values: Record<string, unknown>): ParsedRequestSlots {
  function str(v: unknown): string | null {
    return typeof v === 'string' ? v : null;
  }
  function bool(v: unknown): boolean | null {
    if (typeof v === 'boolean') return v;
    // DB JSONB stores booleans as JSON true/false, but slot_value strings like "true"/"false"
    // also appear when rules are seeded with string literals.
    if (v === 'true') return true;
    if (v === 'false') return false;
    return null;
  }
  function num(v: unknown): number {
    if (typeof v === 'number') return v;
    // DB JSONB may return numeric slot_value as a string (e.g. "8", "9")
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  function walkingLevel(v: unknown): 'easy' | 'moderate' | 'hard' | null {
    if (v === 'easy' || v === 'moderate' || v === 'hard') return v;
    return null;
  }

  return {
    regionPreference:    str(values['region_preference']),
    subregionPreference: str(values['subregion_preference']),
    withSeniors:         bool(values['with_seniors']),
    withChildren:        bool(values['with_children']),
    firstVisit:          bool(values['first_visit']),
    maxWalkingLevel:     walkingLevel(values['max_walking_level']),
    needIndoorIfRain:    bool(values['need_indoor_if_rain']),
    rainAware:           bool(values['rain_aware']),
    photoPriority:       num(values['photo_priority']),
    hiddenGemPriority:   num(values['hidden_gem_priority']),
    iconicPriority:      num(values['iconic_spot_priority']),
    naturePriority:      num(values['nature_priority']),
    culturePriority:     num(values['culture_priority']),
    foodPriority:        num(values['food_priority']),
    cafePriority:        num(values['cafe_priority']),
    shoppingPriority:    num(values['shopping_priority']),
  };
}

/**
 * Build a DeterministicParserResult-shaped adapter from a MergedParserResult.
 * This preserves backward compatibility with the existing route code that reads
 * fixedPool.parsed.parseSource, fixedPool.parsed.parserConfidence, etc.
 *
 * The route is NOT changed in this step (Rule E / Rule 4).
 */
function buildParsedAdapter(
  merged: MergedParserResult,
  slots: ParsedRequestSlots,
): DeterministicParserResult {
  return {
    rawText:          merged.rawText,
    normalizedText:   merged.normalizedText,
    locale:           merged.locale,
    slots,
    parserConfidence: merged.parserConfidence,
    // Map parseSource to the DeterministicParserResult union type.
    // 'rules+synonyms+similarity+llm' → 'rule_plus_synonym' for backward compat.
    // The full source string is available in mergedParserResult.parseSource.
    parseSource: deriveParseSource(merged),
    matchedRules: merged.matchedRules.map((id) => ({
      source: 'rule' as const,
      id: Number(id),
      intentKey: '',
      slotKey: '',
      matchedText: '',
      confidence: 0,
      value: null,
    })),
    matchedSynonyms: merged.matchedSynonyms.map((key) => ({
      source: 'synonym' as const,
      id: 0,
      intentKey: '',
      slotKey: '',
      matchedText: key,
      confidence: 0,
      value: null,
    })),
    unmatchedTerms: merged.unmatchedTerms,
    debug: merged.debug,
  };
}

function deriveParseSource(
  merged: MergedParserResult,
): DeterministicParserResult['parseSource'] {
  const hasRules    = merged.matchedRules.length > 0;
  const hasSynonyms = merged.matchedSynonyms.length > 0;
  if (hasRules && hasSynonyms) return 'rule_plus_synonym';
  if (hasRules)                return 'rule_only';
  if (hasSynonyms)             return 'synonym_only';
  return 'empty';
}

/**
 * Build the fixed SQL candidate pool for a generation request.
 *
 * @param parserInput  - Extracted from ItineraryUserInput via extractParserInputFromInput()
 * @param limit        - Max candidates (default 55, matching legacy DEFAULT_LIMIT)
 * @param persist      - Whether to write to request_profiles + request_parse_logs
 */
export async function buildFixedCandidatePool(
  parserInput: ParserInput,
  limit = 55,
  persist = true,
): Promise<FixedCandidatePoolResult> {
  // Step 1: Run 4-stage parser (stage 4 LLM when GEMINI_API_KEY or ANTHROPIC_API_KEY is set)
  const callJsonModel = getParserSlotFillerCallJsonModel();
  const parseBundle = await parseRequest({
    rawText:     parserInput.rawText,
    locale:      parserInput.locale,
    parserHints: parserInput.parserHints as Record<string, unknown>,
    ...(callJsonModel ? { callJsonModel } : {}),
  });

  const merged = parseBundle.merged;

  // Step 2: Deterministic inference (rain semantics, strictness, quick-photo boost)
  const inferenceCtx = applyDeterministicSlotInference(merged, parserInput.rawText, {
    explicitNeedIndoorFromUi: parserInput.parserHints.needIndoorIfRain === true,
    quickPhotoModeFromUi:     parserInput.parserHints.quick_photo_mode === true,
  });

  // Step 3: Bridge merged slots to typed ParsedRequestSlots for SQL query
  const baseSlots = bridgeToSlots(merged.values);

  // Step 4: SQL-first candidate query with zero-row recovery ladder
  const recovery = await fetchCandidatesWithRecovery({
    baseSlots,
    walkingStrictness: inferenceCtx.walkingStrictness,
    regionStrictness: inferenceCtx.regionStrictness,
    explicitNeedIndoorFromUi: inferenceCtx.explicitNeedIndoorFromUi,
    limit,
  });

  const candidates = recovery.candidates;
  const candidatePoiIds = candidates.map((c) => c.poi_id);
  const candidateContentIds = candidates.map((c) => c.content_id);

  const candidatePoolDebug: Record<string, unknown> = {
    requestedRegion: baseSlots.regionPreference,
    requestedSubregion: baseSlots.subregionPreference,
    maxWalkingLevel: baseSlots.maxWalkingLevel,
    walkingFilterStrictness: inferenceCtx.walkingStrictness,
    regionFilterStrictness: inferenceCtx.regionStrictness,
    withSeniors: baseSlots.withSeniors,
    withChildren: baseSlots.withChildren,
    firstVisit: baseSlots.firstVisit,
    needIndoorIfRain: baseSlots.needIndoorIfRain,
    rainAware: baseSlots.rainAware,
    photoPriority: baseSlots.photoPriority,
    hiddenGemPriority: baseSlots.hiddenGemPriority,
    recoveryStage: recovery.recoveryStage,
    zeroResultStages: recovery.zeroResultStages,
    poolRowCount: candidates.length,
    finalRpcRegion: recovery.finalSlots.regionPreference,
    finalRpcMaxWalking: recovery.finalSlots.maxWalkingLevel,
    finalRpcNeedIndoorIfRain: recovery.finalSlots.needIndoorIfRain,
    finalRpcRainAware: recovery.finalSlots.rainAware,
  };

  // Step 5: Build backward-compat adapter for existing route code (uses post-recovery slots)
  const parsed = buildParsedAdapter(merged, recovery.finalSlots);

  // Step 6: persistence (non-throwing, matches existing route log pattern)
  let requestProfileId: string | null = null;
  let parseLogId: string | null = null;
  let persistenceError: string | null = null;

  if (persist) {
    try {
      const supabase = createServerClient();

      const { data: profileData, error: profileError } = await supabase
        .from('request_profiles')
        .insert({
          raw_text:              parserInput.rawText,
          normalized_query_text: merged.normalizedText,
          locale:                merged.locale,
          region_preference:     baseSlots.regionPreference,
          subregion_preference:  baseSlots.subregionPreference,
          with_seniors:          baseSlots.withSeniors,
          with_children:         baseSlots.withChildren,
          first_visit:           baseSlots.firstVisit,
          max_walking_level:     baseSlots.maxWalkingLevel,
          need_indoor_if_rain:   baseSlots.needIndoorIfRain,
          photo_priority:        baseSlots.photoPriority,
          iconic_spot_priority:  baseSlots.iconicPriority,
          hidden_gem_priority:   baseSlots.hiddenGemPriority,
          nature_priority:       baseSlots.naturePriority,
          culture_priority:      baseSlots.culturePriority,
          food_priority:         baseSlots.foodPriority,
          cafe_priority:         baseSlots.cafePriority,
          shopping_priority:     baseSlots.shoppingPriority,
          // Extended slots from new parser (not in legacy ParsedRequestSlots)
          avoid_overly_touristy: merged.values['avoid_overly_touristy'] ?? null,
          quick_photo_mode:      merged.values['quick_photo_mode'] ?? null,
          morning_preference:    merged.values['morning_preference'] ?? null,
          sunset_preference:     merged.values['sunset_preference'] ?? null,
          pickup_area:           merged.values['pickup_area'] ?? null,
          group_type:            merged.values['group_type'] ?? null,
          nationality_preference: merged.values['nationality_preference'] ?? null,
          parser_confidence:     merged.parserConfidence,
          parse_source:          merged.parseSource,
          unmatched_terms:       merged.unmatchedTerms,
          structured_slots:      merged.values as Record<string, unknown>,
          parse_debug:           {
            ...merged.debug,
            perSlotConfidence:    merged.perSlotConfidence,
            perSlotSource:        merged.perSlotSource,
            llmUsed:              merged.llmUsed,
            hintsApplied:         parserInput.parserHints,
            legacySnapshot:       parserInput.legacyRequestSnapshot,
            candidate_pool_debug: candidatePoolDebug,
          },
        })
        .select('id')
        .single();

      if (profileError || profileData == null) {
        persistenceError = `request_profiles insert failed: ${profileError?.message ?? 'no data'}`;
      } else {
        requestProfileId = profileData.id as string;

        const { data: logData, error: logError } = await supabase
          .from('request_parse_logs')
          .insert({
            request_profile_id:       requestProfileId,
            raw_text:                 parserInput.rawText,
            locale:                   merged.locale,
            stage1_rule_result: {
              matchedRules: merged.matchedRules,
              count:         merged.matchedRules.length,
              debug:         parseBundle.stage1.debug ?? {},
            },
            stage2_synonym_result: {
              matchedSynonyms: merged.matchedSynonyms,
              count:           merged.matchedSynonyms.length,
              debug:           parseBundle.stage2.debug ?? {},
            },
            stage3_similarity_result: {
              matchedExamples: merged.matchedExamples,
              count:           merged.matchedExamples.length,
              debug:           parseBundle.stage3.debug ?? {},
            },
            stage4_llm_result: parseBundle.stage4
              ? {
                  filledSlots: Object.keys(parseBundle.stage4.values),
                  debug:       parseBundle.stage4.debug ?? {},
                }
              : null,
            merged_result: buildMergedResultLog(merged, candidatePoiIds, candidatePoolDebug),
            parser_confidence: merged.parserConfidence,
            unmatched_terms:   merged.unmatchedTerms,
            parse_source:      merged.parseSource,
          })
          .select('id')
          .single();

        if (logError || logData == null) {
          persistenceError = `request_parse_logs insert failed: ${logError?.message ?? 'no data'}`;
        } else {
          parseLogId = logData.id as string;
        }
      }
    } catch (e) {
      persistenceError = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    parsed,
    mergedParserResult: merged,
    candidates,
    candidatePoiIds,
    candidateContentIds,
    requestProfileId,
    parseLogId,
    persistenceError,
  };
}

/**
 * Guard: throws if any selected contentId is outside the fixed candidate pool.
 * Called after LLM draft is received to enforce the hard boundary.
 *
 * Uses content_id strings because the legacy draft uses contentId (string),
 * not numeric poi_id.
 */
export function assertContentIdsWithinPool(
  selectedContentIds: string[],
  allowedContentIds: string[],
): void {
  const allowed = new Set(allowedContentIds);
  const invalid = selectedContentIds.filter((id) => !allowed.has(id));
  if (invalid.length > 0) {
    throw new Error(
      `[itinerary] LLM selected POIs outside fixed SQL candidate pool: ${invalid.join(', ')}`,
    );
  }
}
