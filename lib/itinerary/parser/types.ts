/**
 * Parser-first + SQL-first itinerary architecture — type definitions.
 *
 * ParsedRequestSlots: the explicit structured output of the deterministic parser.
 * All fields map 1-to-1 to get_poi_candidates() parameters and request_profiles columns.
 *
 * Priority fields use integer 0–10 scale:
 *   0 = not specified / neutral
 *   1–3 = low preference
 *   4–6 = moderate preference
 *   7–10 = high preference
 */
export type ParsedRequestSlots = {
  regionPreference: string | null;
  subregionPreference: string | null;
  withSeniors: boolean | null;
  withChildren: boolean | null;
  firstVisit: boolean | null;
  maxWalkingLevel: 'easy' | 'moderate' | 'hard' | null;
  needIndoorIfRain: boolean | null;
  /**
   * When true, SQL boosts rain_fallback_score without requiring indoor-only filter.
   * Derived from text + UI; passed to get_poi_candidates (p_rain_aware).
   */
  rainAware: boolean | null;
  photoPriority: number;
  hiddenGemPriority: number;
  iconicPriority: number;
  naturePriority: number;
  culturePriority: number;
  foodPriority: number;
  cafePriority: number;
  shoppingPriority: number;
};

/**
 * A single matched rule or synonym that contributed to the parser output.
 * Kept in the result for full auditability (Rule 12/13).
 */
export type ParserMatch = {
  source: 'rule' | 'synonym';
  id: number;
  intentKey: string;
  slotKey: string;
  matchedText: string;
  confidence: number;
  value: unknown;
};

/**
 * Full inspectable output of the deterministic parser pass.
 * This is what gets persisted to request_profiles + request_parse_logs.
 *
 * parseSource values:
 *   'rule_only'         — only phrase rules matched
 *   'rule_plus_synonym' — both phrase rules and synonym groups matched
 *   'synonym_only'      — only synonym groups matched
 *   'empty'             — no rules or synonyms matched (slots all at defaults)
 */
export type DeterministicParserResult = {
  rawText: string;
  normalizedText: string;
  locale: string;
  slots: ParsedRequestSlots;
  parserConfidence: number;
  parseSource: 'rule_only' | 'rule_plus_synonym' | 'synonym_only' | 'empty';
  matchedRules: ParserMatch[];
  matchedSynonyms: ParserMatch[];
  unmatchedTerms: string[];
  debug: Record<string, unknown>;
};
