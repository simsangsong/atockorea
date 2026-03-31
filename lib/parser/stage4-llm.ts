/**
 * Stage 4: Light LLM slot filler.
 *
 * Runs ONLY when:
 *   - merged confidence from stages 1-3 is below LLM_CONFIDENCE_THRESHOLD, OR
 *   - one or more IMPORTANT_SLOTS remain null after deterministic stages
 *
 * Strict constraints (Rule 7):
 *   - LLM may only fill predefined slots (AllowedSlotKeySchema)
 *   - LLM must never recommend POIs
 *   - LLM must never generate itinerary text
 *   - LLM must never invent slot names
 *   - Output must be JSON only
 *   - Output is validated with LlmSlotOutputSchema before merge
 *   - If validation fails, this stage returns empty result (fail-closed)
 *
 * The callJsonModel function is injected by the caller so this module
 * has no direct dependency on Gemini/Claude SDKs.
 */
import { LlmSlotOutputSchema } from '@/lib/parser/schema';
import type { ParserStageResult } from '@/lib/parser/types';

/**
 * The exact prompt sent to the LLM slot filler.
 * Exported so it can be inspected in tests and admin previews.
 */
export const SLOT_FILLER_PROMPT = `You are a strict slot-filling model for a Jeju Island travel request parser.

Your ONLY job is to extract structured travel preference slots from the user message.

Rules you MUST follow:
- Output valid JSON only. No prose, no explanation, no markdown.
- Do NOT recommend any attractions, places, or POIs.
- Do NOT generate itinerary text or travel plans.
- Do NOT invent slot names. Use only the allowed slot keys listed below.
- If a slot cannot be determined from the text, omit it entirely.
- confidence values must be between 0.0 and 1.0.

Allowed slot keys and their value types:
  region_preference       : string ("east" | "west" | "south" | "north" | "central" | null)
  subregion_preference    : string (area name, e.g. "성산" | "애월" | null)
  with_seniors            : boolean
  with_children           : boolean
  first_visit             : boolean
  max_walking_level       : string ("easy" | "moderate" | "hard")
  photo_priority          : integer 0-10
  hidden_gem_priority     : integer 0-10
  iconic_spot_priority    : integer 0-10
  avoid_overly_touristy   : boolean
  need_indoor_if_rain     : boolean
  nature_priority         : integer 0-10
  culture_priority        : integer 0-10
  food_priority           : integer 0-10
  cafe_priority           : integer 0-10
  shopping_priority       : integer 0-10
  quick_photo_mode        : boolean
  morning_preference      : boolean
  sunset_preference       : boolean
  pickup_area             : string (pickup location name)
  group_type              : string ("solo" | "couple" | "family" | "friends" | "seniors")
  nationality_preference  : string (nationality hint, e.g. "korean" | "japanese" | "chinese")
  indoor_outdoor          : string ("indoor" | "outdoor" | "mixed")

Output format (JSON only):
{
  "values": { "<slot_key>": <value>, ... },
  "confidence": { "<slot_key>": <0.0-1.0>, ... },
  "reason": "<one sentence summary of what you extracted, optional>"
}`;

export async function runLlmSlotFiller(params: {
  rawText: string;
  locale: string;
  missingSlots: string[];
  currentValues: Record<string, unknown>;
  callJsonModel: (prompt: string, userInput: string) => Promise<unknown>;
}): Promise<ParserStageResult> {
  // Skip if nothing to fill
  if (params.missingSlots.length === 0) {
    return {
      values: {},
      perSlotConfidence: {},
      perSlotSource: {},
      unmatchedTerms: [],
      debug: { llmSkipped: true, reason: 'no_missing_slots' },
    };
  }

  let raw: unknown;
  try {
    raw = await params.callJsonModel(
      SLOT_FILLER_PROMPT,
      JSON.stringify({
        locale: params.locale,
        rawText: params.rawText,
        missingSlots: params.missingSlots,
        currentValues: params.currentValues,
      }),
    );
  } catch (err) {
    return {
      values: {},
      perSlotConfidence: {},
      perSlotSource: {},
      unmatchedTerms: [],
      debug: {
        llmCallFailed: true,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // Strict validation — fail closed if output is invalid
  const parsed = LlmSlotOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      values: {},
      perSlotConfidence: {},
      perSlotSource: {},
      unmatchedTerms: [],
      debug: {
        llmInvalid: true,
        issues: parsed.error.flatten(),
        rawOutput: typeof raw === 'object' ? raw : String(raw),
      },
    };
  }

  const values: Record<string, unknown> = {};
  const perSlotConfidence: Record<string, number> = {};
  const perSlotSource: Record<string, string> = {};

  for (const [slotKey, slotValue] of Object.entries(parsed.data.values)) {
    values[slotKey] = slotValue;
    perSlotConfidence[slotKey] =
      parsed.data.confidence[slotKey as keyof typeof parsed.data.confidence] ??
      0.55;
    perSlotSource[slotKey] = 'llm_slot_filler';
  }

  return {
    values,
    perSlotConfidence,
    perSlotSource,
    unmatchedTerms: [],
    debug: {
      llmUsed: true,
      reason: parsed.data.reason ?? null,
      filledSlots: Object.keys(values),
    },
  };
}
