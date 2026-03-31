/**
 * Zod schemas for runtime validation of parser stage outputs and LLM slot filler JSON.
 *
 * AllowedSlotKeySchema is the authoritative list of slots the parser may fill.
 * Any slot key not in this enum is rejected at merge time.
 *
 * LlmSlotOutputSchema is the strict contract for stage4 LLM JSON output.
 * If the LLM returns anything outside this schema, the output is discarded
 * and deterministic stages are used as-is (fail-closed).
 */
import { z } from 'zod';

export const AllowedSlotKeySchema = z.enum([
  'region_preference',
  'subregion_preference',
  'with_seniors',
  'with_children',
  'first_visit',
  'max_walking_level',
  'photo_priority',
  'hidden_gem_priority',
  'iconic_spot_priority',
  'avoid_overly_touristy',
  'need_indoor_if_rain',
  'nature_priority',
  'culture_priority',
  'food_priority',
  'cafe_priority',
  'shopping_priority',
  'quick_photo_mode',
  'morning_preference',
  'sunset_preference',
  'pickup_area',
  'group_type',
  'nationality_preference',
  'indoor_outdoor',
]);

export type AllowedSlotKey = z.infer<typeof AllowedSlotKeySchema>;

export const ALLOWED_SLOT_KEYS: ReadonlySet<string> = new Set(
  AllowedSlotKeySchema.options,
);

export const SlotValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
  z.record(z.string(), z.unknown()),
]);

export const StageResultSchema = z.object({
  values: z.record(z.string(), SlotValueSchema),
  perSlotConfidence: z.record(z.string(), z.number().min(0).max(1)),
  perSlotSource: z.record(z.string(), z.string()),
  matchedRules: z.array(z.union([z.string(), z.number()])).optional(),
  matchedSynonyms: z.array(z.string()).optional(),
  matchedExamples: z.array(z.union([z.string(), z.number()])).optional(),
  unmatchedTerms: z.array(z.string()).default([]),
  debug: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Strict schema for stage4 LLM JSON output.
 * The LLM must return exactly this shape; any deviation causes the output
 * to be discarded (fail-closed per Rule 7 / Rule F).
 */
export const LlmSlotOutputSchema = z.object({
  values: z.record(AllowedSlotKeySchema, SlotValueSchema).default({}),
  confidence: z.record(AllowedSlotKeySchema, z.number().min(0).max(1)).default({}),
  reason: z.string().optional(),
});

export type LlmSlotOutput = z.infer<typeof LlmSlotOutputSchema>;
