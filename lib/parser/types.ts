/**
 * Core type definitions for the 4-stage parser pipeline.
 *
 * SlotMap uses snake_case keys that match request_profiles columns and
 * get_poi_candidates() RPC parameters exactly.
 *
 * Priority fields use integer 0–10 scale (0 = not specified / neutral).
 */

export type SlotValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | Record<string, unknown>;

export type SlotMap = Record<string, SlotValue>;

export type SlotConfidenceMap = Record<string, number>;
export type SlotSourceMap = Record<string, string>;

/**
 * Output of a single parser stage (rule / synonym / similarity / llm).
 * All fields are always present; optional arrays default to [].
 */
export type ParserStageResult = {
  values: SlotMap;
  perSlotConfidence: SlotConfidenceMap;
  perSlotSource: SlotSourceMap;
  matchedRules?: Array<string | number>;
  matchedSynonyms?: string[];
  matchedExamples?: Array<string | number>;
  unmatchedTerms: string[];
  debug?: Record<string, unknown>;
};

/**
 * Final merged output of the full 4-stage pipeline.
 * This is the authoritative parser result consumed by build-fixed-candidate-pool.
 */
export type MergedParserResult = {
  rawText: string;
  normalizedText: string;
  locale: string;
  values: SlotMap;
  perSlotConfidence: SlotConfidenceMap;
  perSlotSource: SlotSourceMap;
  parserConfidence: number;
  parseSource: string;
  unmatchedTerms: string[];
  matchedRules: Array<string | number>;
  matchedSynonyms: string[];
  matchedExamples: Array<string | number>;
  llmUsed: boolean;
  debug: Record<string, unknown>;
};
