/**
 * Deterministic parser pass — Stage 1 (phrase rules) + Stage 2 (synonym groups).
 *
 * Architecture rules enforced here:
 * - LLM does NOT influence slot values in this module (Rule 7).
 * - Output is fully inspectable: every match is recorded in matchedRules / matchedSynonyms.
 * - parserConfidence, parseSource, unmatchedTerms are always present (Rule 12).
 * - Later stages (LLM slot extraction, pgvector similarity) are separate modules;
 *   this module only runs deterministic DB-driven rules.
 *
 * Slot precedence: phrase rules run first (higher confidence), then synonym groups.
 * If both set the same slot key, the rule value wins (rules have higher priority).
 */
import type {
  DeterministicParserResult,
  ParsedRequestSlots,
  ParserMatch,
} from './types';
import type { PhraseRuleRow, SynonymGroupRow } from './catalog';

// ── text normalization ────────────────────────────────────────

/**
 * Normalize input text for matching:
 * - NFC unicode normalization
 * - lowercase
 * - collapse whitespace
 * - trim
 *
 * Korean text does not need additional stemming for rule-based matching.
 */
function normalizeText(input: string): string {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ── default slots ─────────────────────────────────────────────

function defaultSlots(): ParsedRequestSlots {
  return {
    regionPreference: null,
    subregionPreference: null,
    withSeniors: null,
    withChildren: null,
    firstVisit: null,
    maxWalkingLevel: null,
    needIndoorIfRain: null,
    rainAware: null,
    photoPriority: 0,
    hiddenGemPriority: 0,
    iconicPriority: 0,
    naturePriority: 0,
    culturePriority: 0,
    foodPriority: 0,
    cafePriority: 0,
    shoppingPriority: 0,
  };
}

// ── slot application ──────────────────────────────────────────

/**
 * Apply a parsed slot value to the slots object.
 * slot_value from DB is JSONB — may be a primitive or object.
 * We extract the actual value for typed slots.
 */
function applySlot(
  slots: ParsedRequestSlots,
  slotKey: string,
  value: unknown,
): void {
  switch (slotKey) {
    case 'region_preference':
      slots.regionPreference = typeof value === 'string' ? value : null;
      break;
    case 'subregion_preference':
      slots.subregionPreference = typeof value === 'string' ? value : null;
      break;
    case 'with_seniors':
      slots.withSeniors = typeof value === 'boolean' ? value : null;
      break;
    case 'with_children':
      slots.withChildren = typeof value === 'boolean' ? value : null;
      break;
    case 'first_visit':
      slots.firstVisit = typeof value === 'boolean' ? value : null;
      break;
    case 'max_walking_level':
      if (value === 'easy' || value === 'moderate' || value === 'hard') {
        slots.maxWalkingLevel = value;
      }
      break;
    case 'need_indoor_if_rain':
      slots.needIndoorIfRain = typeof value === 'boolean' ? value : null;
      break;
    case 'photo_priority':
      slots.photoPriority = Number(value) || 0;
      break;
    case 'hidden_gem_priority':
      slots.hiddenGemPriority = Number(value) || 0;
      break;
    case 'iconic_priority':
      slots.iconicPriority = Number(value) || 0;
      break;
    case 'nature_priority':
      slots.naturePriority = Number(value) || 0;
      break;
    case 'culture_priority':
      slots.culturePriority = Number(value) || 0;
      break;
    case 'food_priority':
      slots.foodPriority = Number(value) || 0;
      break;
    case 'cafe_priority':
      slots.cafePriority = Number(value) || 0;
      break;
    case 'shopping_priority':
      slots.shoppingPriority = Number(value) || 0;
      break;
    default:
      // Unknown slot keys are silently ignored here; they appear in debug.unknownSlots.
      break;
  }
}

// ── phrase rule matching ──────────────────────────────────────

function matchPhraseRule(
  normalizedInput: string,
  rule: PhraseRuleRow,
): boolean {
  const normalizedPattern = normalizeText(rule.pattern);

  switch (rule.match_type) {
    case 'exact':
      return normalizedInput === normalizedPattern;
    case 'contains':
      return normalizedInput.includes(normalizedPattern);
    case 'regex':
      try {
        return new RegExp(rule.pattern, 'i').test(normalizedInput);
      } catch {
        // Invalid regex in DB — skip this rule rather than crashing.
        return false;
      }
    default:
      return false;
  }
}

// ── synonym group matching ────────────────────────────────────

function matchSynonymGroup(
  normalizedInput: string,
  group: SynonymGroupRow,
): string | null {
  for (const phrase of group.phrases ?? []) {
    if (normalizedInput.includes(normalizeText(phrase))) {
      return phrase;
    }
  }
  return null;
}

// ── main parser ───────────────────────────────────────────────

export type DeterministicParserArgs = {
  rawText: string;
  locale: string;
  phraseRules: PhraseRuleRow[];
  synonymGroups: SynonymGroupRow[];
};

/**
 * Run the deterministic parser (Stage 1: phrase rules, Stage 2: synonym groups).
 *
 * Slot precedence:
 * - Phrase rules are applied first (ordered by priority ASC, id ASC from DB).
 * - Synonym groups are applied second.
 * - For the same slot key, the FIRST match wins (rules before synonyms).
 *   Later matches for the same slot are recorded in debug.laterSlotConflicts.
 *
 * Returns a fully inspectable DeterministicParserResult.
 */
export function parseDeterministicRequest(
  args: DeterministicParserArgs,
): DeterministicParserResult {
  const normalizedText = normalizeText(args.rawText);
  const slots = defaultSlots();
  const matchedRules: ParserMatch[] = [];
  const matchedSynonyms: ParserMatch[] = [];
  const appliedSlotKeys = new Set<string>();
  const laterSlotConflicts: Array<{
    slotKey: string;
    source: string;
    id: number;
    skipped: boolean;
  }> = [];
  const unknownSlots: string[] = [];

  // ── Stage 1: phrase rules ─────────────────────────────────
  for (const rule of args.phraseRules) {
    if (!matchPhraseRule(normalizedText, rule)) continue;

    const match: ParserMatch = {
      source: 'rule',
      id: rule.id,
      intentKey: rule.intent_key,
      slotKey: rule.slot_key,
      matchedText: rule.pattern,
      confidence: Number(rule.confidence ?? 0),
      value: rule.slot_value,
    };
    matchedRules.push(match);

    if (appliedSlotKeys.has(rule.slot_key)) {
      laterSlotConflicts.push({
        slotKey: rule.slot_key,
        source: 'rule',
        id: rule.id,
        skipped: true,
      });
    } else {
      applySlot(slots, rule.slot_key, rule.slot_value);
      appliedSlotKeys.add(rule.slot_key);
      // Track unknown slot keys for debug
      const knownSlotKeys = [
        'region_preference', 'subregion_preference', 'with_seniors', 'with_children',
        'first_visit', 'max_walking_level', 'need_indoor_if_rain', 'photo_priority',
        'hidden_gem_priority', 'iconic_priority', 'nature_priority', 'culture_priority',
        'food_priority', 'cafe_priority', 'shopping_priority',
      ];
      if (!knownSlotKeys.includes(rule.slot_key)) {
        unknownSlots.push(rule.slot_key);
      }
    }
  }

  // ── Stage 2: synonym groups ───────────────────────────────
  for (const group of args.synonymGroups) {
    const foundPhrase = matchSynonymGroup(normalizedText, group);
    if (foundPhrase === null) continue;

    const match: ParserMatch = {
      source: 'synonym',
      id: group.id,
      intentKey: group.intent_key,
      slotKey: group.slot_key,
      matchedText: foundPhrase,
      confidence: Number(group.confidence ?? 0),
      value: group.slot_value,
    };
    matchedSynonyms.push(match);

    if (appliedSlotKeys.has(group.slot_key)) {
      laterSlotConflicts.push({
        slotKey: group.slot_key,
        source: 'synonym',
        id: group.id,
        skipped: true,
      });
    } else {
      applySlot(slots, group.slot_key, group.slot_value);
      appliedSlotKeys.add(group.slot_key);
    }
  }

  // ── confidence + source ───────────────────────────────────
  const totalMatches = matchedRules.length + matchedSynonyms.length;

  const parserConfidence =
    totalMatches === 0
      ? 0
      : Math.min(
          0.98,
          (matchedRules.reduce((sum, x) => sum + x.confidence, 0) +
            matchedSynonyms.reduce((sum, x) => sum + x.confidence, 0)) /
            totalMatches,
        );

  const parseSource: DeterministicParserResult['parseSource'] =
    matchedRules.length > 0 && matchedSynonyms.length > 0
      ? 'rule_plus_synonym'
      : matchedRules.length > 0
        ? 'rule_only'
        : matchedSynonyms.length > 0
          ? 'synonym_only'
          : 'empty';

  return {
    rawText: args.rawText,
    normalizedText,
    locale: args.locale,
    slots,
    parserConfidence,
    parseSource,
    matchedRules,
    matchedSynonyms,
    // unmatchedTerms: populated by future LLM/similarity stage; empty here.
    unmatchedTerms: [],
    debug: {
      ruleMatchCount: matchedRules.length,
      synonymMatchCount: matchedSynonyms.length,
      appliedSlotCount: appliedSlotKeys.size,
      laterSlotConflicts,
      unknownSlots,
    },
  };
}
