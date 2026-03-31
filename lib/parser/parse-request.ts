/**
 * 4-stage parser orchestrator.
 *
 * Runs stages 1–3 in parallel, merges results, then conditionally runs
 * stage 4 (LLM slot filler) when confidence is low or important slots
 * are missing.
 *
 * Stage 4 trigger conditions (either):
 *   - merged parserConfidence < LLM_CONFIDENCE_THRESHOLD (0.72)
 *   - any slot in IMPORTANT_SLOTS is still null after stages 1–3
 *
 * Stage 4 is skipped when callJsonModel is not provided (e.g. in tests
 * or when no LLM key is configured). The pipeline always returns a valid
 * MergedParserResult regardless.
 *
 * Architecture rules enforced:
 *   - Rule 7: LLM may only fill predefined slots, never choose POIs
 *   - Rule 12: perSlotConfidence, perSlotSource, unmatchedTerms always present
 *   - Rule F: invalid LLM output is discarded (fail-closed)
 */
import { runRuleStage } from '@/lib/parser/stage1-rules';
import { runSynonymStage } from '@/lib/parser/stage2-synonyms';
import { runSimilarityStage } from '@/lib/parser/stage3-similarity';
import { runLlmSlotFiller } from '@/lib/parser/stage4-llm';
import { mergeParserStages } from '@/lib/parser/merge';
import type { MergedParserResult, ParserStageResult } from '@/lib/parser/types';

const LLM_CONFIDENCE_THRESHOLD = 0.72;

/**
 * Slots that trigger stage 4 when missing after deterministic stages.
 * These are the slots most critical for candidate pool quality.
 */
const IMPORTANT_SLOTS: ReadonlyArray<string> = [
  'region_preference',
  'max_walking_level',
  'first_visit',
  'photo_priority',
  'need_indoor_if_rain',
];

export type ParseRequestResult = {
  stage1: ParserStageResult;
  stage2: ParserStageResult;
  stage3: ParserStageResult;
  stage4: ParserStageResult | null;
  merged: MergedParserResult;
};

/**
 * Run the full 4-stage parser for a raw user request.
 *
 * @param rawText        - Raw user text (Korean or English).
 * @param locale         - Locale for rule/synonym/example lookup (default 'ko').
 * @param parserHints    - Structured UI fields (narrow allowlist only).
 * @param callJsonModel  - Injected LLM JSON caller; omit to skip stage 4.
 */
export async function parseRequest(params: {
  rawText: string;
  locale?: string;
  parserHints?: Record<string, unknown>;
  callJsonModel?: (prompt: string, userInput: string) => Promise<unknown>;
}): Promise<ParseRequestResult> {
  const locale = params.locale ?? 'ko';

  // Stages 1–3 run in parallel (they are independent DB reads)
  const [stage1, stage2, stage3] = await Promise.all([
    runRuleStage(params.rawText, locale),
    runSynonymStage(params.rawText, locale),
    runSimilarityStage(params.rawText, locale),
  ]);

  // First merge: deterministic stages only
  let merged = mergeParserStages({
    rawText: params.rawText,
    locale,
    stages: [
      { name: 'stage1', result: stage1 },
      { name: 'stage2', result: stage2 },
      { name: 'stage3', result: stage3 },
    ],
    parserHints: params.parserHints,
  });

  // Decide whether to run stage 4
  const missingSlots = IMPORTANT_SLOTS.filter(
    (slot) => merged.values[slot] == null,
  );
  const shouldRunLlm =
    params.callJsonModel != null &&
    (merged.parserConfidence < LLM_CONFIDENCE_THRESHOLD ||
      missingSlots.length > 0);

  if (!shouldRunLlm) {
    return { stage1, stage2, stage3, stage4: null, merged };
  }

  const stage4 = await runLlmSlotFiller({
    rawText: params.rawText,
    locale,
    missingSlots,
    currentValues: merged.values,
    callJsonModel: params.callJsonModel!,
  });

  // Re-merge including stage 4 result
  merged = mergeParserStages({
    rawText: params.rawText,
    locale,
    stages: [
      { name: 'stage1', result: stage1 },
      { name: 'stage2', result: stage2 },
      { name: 'stage3', result: stage3 },
      { name: 'stage4', result: stage4 },
    ],
    parserHints: params.parserHints,
  });

  return { stage1, stage2, stage3, stage4, merged };
}
