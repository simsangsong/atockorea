/**
 * Debug helpers for the 4-stage parser pipeline.
 *
 * These utilities are used by admin preview routes and test harnesses.
 * They are NOT imported by the production generation route.
 */
import type { MergedParserResult, ParserStageResult } from '@/lib/parser/types';

export type ParserDebugBundle = {
  stage1: ParserStageResult | null;
  stage2: ParserStageResult | null;
  stage3: ParserStageResult | null;
  stage4: ParserStageResult | null;
  merged: MergedParserResult;
};

/**
 * Produce a human-readable summary of a parser debug bundle.
 * Useful for console output in admin preview routes.
 */
export function summarizeParserBundle(bundle: ParserDebugBundle): string {
  const { merged } = bundle;
  const lines: string[] = [
    `[parser] rawText: "${merged.rawText.slice(0, 80)}"`,
    `[parser] parserConfidence: ${merged.parserConfidence}`,
    `[parser] parseSource: ${merged.parseSource}`,
    `[parser] llmUsed: ${merged.llmUsed}`,
    `[parser] slots filled: ${Object.keys(merged.values).join(', ') || '(none)'}`,
    `[parser] matchedRules: ${merged.matchedRules.length}`,
    `[parser] matchedSynonyms: ${merged.matchedSynonyms.length}`,
    `[parser] matchedExamples: ${merged.matchedExamples.length}`,
    `[parser] unmatchedTerms: ${merged.unmatchedTerms.join(', ') || '(none)'}`,
  ];

  for (const [slotKey, value] of Object.entries(merged.values)) {
    const conf = merged.perSlotConfidence[slotKey] ?? 0;
    const src = merged.perSlotSource[slotKey] ?? '?';
    lines.push(`  ${slotKey}: ${JSON.stringify(value)} (conf=${conf}, src=${src})`);
  }

  return lines.join('\n');
}

/**
 * Build the JSONB payload for request_parse_logs.merged_result column.
 * Includes candidate ids when available.
 */
export function buildMergedResultLog(
  merged: MergedParserResult,
  candidatePoiIds?: number[],
  candidatePoolDebug?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    values: merged.values,
    perSlotConfidence: merged.perSlotConfidence,
    perSlotSource: merged.perSlotSource,
    parserConfidence: merged.parserConfidence,
    parseSource: merged.parseSource,
    llmUsed: merged.llmUsed,
    unmatchedTerms: merged.unmatchedTerms,
    matchedRules: merged.matchedRules,
    matchedSynonyms: merged.matchedSynonyms,
    matchedExamples: merged.matchedExamples,
    ...(candidatePoiIds != null ? { candidatePoiIds } : {}),
    ...(candidatePoolDebug != null ? { candidate_pool_debug: candidatePoolDebug } : {}),
  };
}
