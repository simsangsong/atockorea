/**
 * Stage 1: Deterministic phrase-rule matching.
 *
 * Loads active rules from request_phrase_rules via the catalog RPC.
 * Supports exact / contains / regex match types.
 * Returns high-confidence slot assignments with full auditability.
 *
 * Slot precedence within this stage: highest-confidence rule wins per slot.
 * All matched rule ids are recorded regardless of whether they won.
 */
import { fetchActivePhraseRules } from '@/lib/parser/repository';
import type { ParserStageResult, SlotMap, SlotValue } from '@/lib/parser/types';

export async function runRuleStage(
  rawText: string,
  locale = 'ko',
): Promise<ParserStageResult> {
  const normalizedText = rawText
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  let rules: Awaited<ReturnType<typeof fetchActivePhraseRules>>;
  try {
    rules = await fetchActivePhraseRules(locale);
  } catch (err) {
    // Surface DB errors in debug but return empty result so pipeline continues
    return {
      values: {},
      perSlotConfidence: {},
      perSlotSource: {},
      matchedRules: [],
      unmatchedTerms: [],
      debug: {
        error: err instanceof Error ? err.message : String(err),
        ruleCount: 0,
      },
    };
  }

  const values: SlotMap = {};
  const perSlotConfidence: Record<string, number> = {};
  const perSlotSource: Record<string, string> = {};
  const matchedRules: Array<string | number> = [];

  for (const rule of rules) {
    const pattern = String(rule.pattern ?? '');
    const matchType = String(rule.match_type ?? 'contains');

    let matched = false;
    if (matchType === 'exact') {
      matched = normalizedText === pattern.normalize('NFC').toLowerCase().trim();
    } else if (matchType === 'contains') {
      matched = normalizedText.includes(
        pattern.normalize('NFC').toLowerCase().trim(),
      );
    } else if (matchType === 'regex') {
      try {
        matched = new RegExp(pattern, 'i').test(normalizedText);
      } catch {
        // Invalid regex in DB — skip rule rather than crashing
        matched = false;
      }
    }

    if (!matched) continue;

    const slotKey = String(rule.slot_key);
    const confidence = Number(rule.confidence ?? 0.95);

    // Highest-confidence rule wins per slot
    if ((perSlotConfidence[slotKey] ?? -1) < confidence) {
      values[slotKey] = rule.slot_value as SlotValue;
      perSlotConfidence[slotKey] = confidence;
      perSlotSource[slotKey] = `rule:${rule.id}`;
    }

    matchedRules.push(rule.id);
  }

  return {
    values,
    perSlotConfidence,
    perSlotSource,
    matchedRules,
    unmatchedTerms: [],
    debug: { ruleCount: rules.length, matchCount: matchedRules.length },
  };
}
