/**
 * Stage 2: Synonym-group matching.
 *
 * Loads active synonym groups from request_synonym_groups via the catalog RPC.
 * Each group carries a list of phrases; if any phrase is found in the input,
 * the group's slot assignment fires.
 *
 * This replaces brittle if/else chains with DB-driven phrase clusters.
 * Highest-confidence group wins per slot.
 * All matched group_keys are recorded for auditability.
 */
import { fetchActiveSynonymGroups } from '@/lib/parser/repository';
import type { ParserStageResult, SlotMap, SlotValue } from '@/lib/parser/types';

export async function runSynonymStage(
  rawText: string,
  locale = 'ko',
): Promise<ParserStageResult> {
  const normalizedText = rawText
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  let groups: Awaited<ReturnType<typeof fetchActiveSynonymGroups>>;
  try {
    groups = await fetchActiveSynonymGroups(locale);
  } catch (err) {
    return {
      values: {},
      perSlotConfidence: {},
      perSlotSource: {},
      matchedSynonyms: [],
      unmatchedTerms: [],
      debug: {
        error: err instanceof Error ? err.message : String(err),
        synonymGroupCount: 0,
      },
    };
  }

  const values: SlotMap = {};
  const perSlotConfidence: Record<string, number> = {};
  const perSlotSource: Record<string, string> = {};
  const matchedSynonyms: string[] = [];

  for (const group of groups) {
    const phrases = Array.isArray(group.phrases) ? group.phrases : [];
    const matched = phrases.some((phrase) =>
      normalizedText.includes(
        String(phrase).normalize('NFC').toLowerCase().trim(),
      ),
    );

    if (!matched) continue;

    const slotKey = String(group.slot_key);
    const confidence = Number(group.confidence ?? 0.85);

    if ((perSlotConfidence[slotKey] ?? -1) < confidence) {
      values[slotKey] = group.slot_value as SlotValue;
      perSlotConfidence[slotKey] = confidence;
      perSlotSource[slotKey] = `synonym:${group.group_key}`;
    }

    matchedSynonyms.push(String(group.group_key));
  }

  return {
    values,
    perSlotConfidence,
    perSlotSource,
    matchedSynonyms,
    unmatchedTerms: [],
    debug: {
      synonymGroupCount: groups.length,
      matchCount: matchedSynonyms.length,
    },
  };
}
