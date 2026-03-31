/**
 * Merge logic for the 4-stage parser pipeline.
 *
 * Precedence rules:
 * 1. Higher-confidence stage result wins per slot.
 * 2. Lower-confidence stages fill missing slots only (they do not overwrite).
 * 3. parserHints from UI may override ONLY the narrow allowlist below,
 *    and only when the parsed confidence for that slot is < 0.99.
 *    This ensures text-matched high-confidence values are never clobbered
 *    by UI defaults.
 *
 * The HINT_OVERRIDE_ALLOWLIST is intentionally narrow:
 *   - withSeniors / withChildren: UI toggles that are binary and explicit
 *   - needIndoorIfRain / indoorOutdoor: rainy-day and indoor UI toggles
 *   - pickupArea: structured UI field, not free text
 *   - durationDays / groupSize: numeric UI fields
 *
 * All other slots (region, priorities, etc.) must come from text parsing.
 *
 * ui_hint confidence policy:
 *   - ui_hint slots are assigned confidence 0.60 (not 0.98) so they do NOT
 *     inflate parserConfidence and do NOT suppress stage 4 (LLM) triggering.
 *   - false / null / empty string hints are skipped entirely — they represent
 *     "not set" defaults, not affirmative user intent.
 *   - Positive numeric hints (durationDays, groupSize) and non-empty strings
 *     (pickupArea, indoorOutdoor != 'any') are applied normally.
 *   - ui_hint slots are excluded from the parserConfidence average so that
 *     only text-derived slots influence the confidence score.
 */
import type { MergedParserResult, ParserStageResult } from '@/lib/parser/types';

/**
 * Slots that parserHints from the UI are allowed to override.
 * Keys match the snake_case slot names used throughout the parser.
 * camelCase aliases (withSeniors etc.) are also accepted for backward
 * compatibility with the existing ParserInput.parserHints shape.
 */
const HINT_OVERRIDE_ALLOWLIST = new Set([
  // snake_case (canonical)
  'with_seniors',
  'with_children',
  'need_indoor_if_rain',
  'indoor_outdoor',
  'pickup_area',
  'duration_days',
  'group_size',
  'quick_photo_mode',
  // camelCase aliases from ParserInput.parserHints
  'withSeniors',
  'withChildren',
  'needIndoorIfRain',
  'indoorOutdoor',
  'pickupArea',
  'durationDays',
  'groupSize',
  'quickPhotoMode',
]);

function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function mergeParserStages(params: {
  rawText: string;
  locale: string;
  stages: Array<{ name: string; result: ParserStageResult }>;
  parserHints?: Record<string, unknown>;
}): MergedParserResult {
  const values: Record<string, unknown> = {};
  const perSlotConfidence: Record<string, number> = {};
  const perSlotSource: Record<string, string> = {};

  const matchedRules: Array<string | number> = [];
  const matchedSynonyms: string[] = [];
  const matchedExamples: Array<string | number> = [];
  const unmatched = new Set<string>();

  // Merge stages in order: higher confidence wins per slot
  for (const { name, result } of params.stages) {
    for (const [slotKey, slotValue] of Object.entries(result.values)) {
      const nextConfidence = Number(result.perSlotConfidence[slotKey] ?? 0);
      const prevConfidence = Number(perSlotConfidence[slotKey] ?? -1);

      if (nextConfidence > prevConfidence) {
        values[slotKey] = slotValue;
        perSlotConfidence[slotKey] = nextConfidence;
        perSlotSource[slotKey] = result.perSlotSource[slotKey] ?? name;
      }
    }

    result.unmatchedTerms.forEach((t) => unmatched.add(t));
    (result.matchedRules ?? []).forEach((x) => matchedRules.push(x));
    (result.matchedSynonyms ?? []).forEach((x) => matchedSynonyms.push(x));
    (result.matchedExamples ?? []).forEach((x) => matchedExamples.push(x));
  }

  // Apply parserHints — narrow allowlist only, never overwrite high-confidence values.
  //
  // Skip rules (do NOT insert the hint):
  //   - false boolean: "not toggled" default, not affirmative intent
  //   - null / undefined / empty string: unset field
  //   - indoorOutdoor === 'any': neutral default, adds no signal
  //   - numeric 0: unset / default
  //
  // ui_hint confidence is 0.60 — low enough that:
  //   (a) it does not inflate parserConfidence
  //   (b) it does not suppress stage 4 (LLM) triggering
  //   (c) a text-matched value always wins (text rules are ≥ 0.85)
  const UI_HINT_CONFIDENCE = 0.60;

  for (const [hintKey, hintValue] of Object.entries(params.parserHints ?? {})) {
    if (!HINT_OVERRIDE_ALLOWLIST.has(hintKey)) continue;

    // Skip non-affirmative defaults
    if (hintValue === null || hintValue === undefined || hintValue === '') continue;
    if (hintValue === false) continue;
    if (hintValue === 0) continue;
    if (hintValue === 'any') continue;

    // Normalise camelCase hint keys to snake_case slot keys
    const slotKey = camelToSnake(hintKey);

    const existingConfidence = Number(perSlotConfidence[slotKey] ?? -1);
    // Only apply if the deterministic parser did not already set this slot
    // with high confidence (< 0.99 threshold)
    if (existingConfidence < 0.99) {
      values[slotKey] = hintValue;
      // Keep existing confidence if it's already higher (e.g. text matched same slot)
      perSlotConfidence[slotKey] = Math.max(existingConfidence, UI_HINT_CONFIDENCE);
      perSlotSource[slotKey] = 'ui_hint';
    }
  }

  // parserConfidence is computed from TEXT-derived slots only.
  // ui_hint slots are excluded so that UI defaults don't inflate the score
  // and suppress stage 4 (LLM) triggering.
  const textDerivedConf = Object.entries(perSlotConfidence)
    .filter(([slotKey]) => perSlotSource[slotKey] !== 'ui_hint')
    .map(([, conf]) => conf);

  const parserConfidence =
    textDerivedConf.length === 0
      ? 0
      : Number(
          (textDerivedConf.reduce((a, b) => a + b, 0) / textDerivedConf.length).toFixed(3),
        );

  const stageNames = params.stages.map((s) => s.name).join('+');

  return {
    rawText: params.rawText,
    normalizedText: normalizeText(params.rawText),
    locale: params.locale,
    values,
    perSlotConfidence,
    perSlotSource,
    parserConfidence,
    parseSource: stageNames || 'empty',
    unmatchedTerms: Array.from(unmatched),
    matchedRules,
    matchedSynonyms,
    matchedExamples,
    llmUsed: params.stages.some((s) => s.name === 'stage4'),
    debug: {
      stageCount: params.stages.length,
      stageNames,
      slotCount: Object.keys(values).length,
      hintsApplied: Object.keys(params.parserHints ?? {}).filter((k) =>
        HINT_OVERRIDE_ALLOWLIST.has(k),
      ),
    },
  };
}

/**
 * Convert camelCase hint key to snake_case slot key.
 * Only handles the known aliases in HINT_OVERRIDE_ALLOWLIST.
 */
function camelToSnake(key: string): string {
  const MAP: Record<string, string> = {
    withSeniors: 'with_seniors',
    withChildren: 'with_children',
    needIndoorIfRain: 'need_indoor_if_rain',
    indoorOutdoor: 'indoor_outdoor',
    pickupArea: 'pickup_area',
    durationDays: 'duration_days',
    groupSize: 'group_size',
    quickPhotoMode: 'quick_photo_mode',
  };
  return MAP[key] ?? key;
}
