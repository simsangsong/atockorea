/**
 * Normalizes the already-parsed ItineraryUserInput (from itineraryUserInputSchema)
 * into a ParserInput suitable for the deterministic parser.
 *
 * Why this exists:
 * - The existing route parses the request body with Zod (itineraryUserInputSchema)
 *   before we get to touch it. The result is a typed ItineraryUserInput, not a raw body.
 * - The parser needs a rawText string. We reconstruct it from the structured fields
 *   that carry semantic intent: travelStyle, theme, mustSee, groupType, pickupArea.
 * - parserHints carries structured fields that can fill slots directly when the
 *   deterministic text parser doesn't match (e.g. withSeniors=true from the UI toggle).
 * - legacyRequestSnapshot is stored for auditability alongside the parse log.
 *
 * Actual request body fields (from itineraryUserInputRawSchema / ItineraryUserInput):
 *   destination, pickupArea, travelStyle, groupType, seniors/withSeniors, family,
 *   couple/isCouple, withChildren, indoorOutdoor/indoorPreference, rainyDay,
 *   availableHours, mustSee, mustSeeKeywords, theme, durationDays, locale/language
 */
import type { ItineraryUserInput } from '@/lib/itinerary/types';

export type ParserInput = {
  rawText: string;
  locale: string;
  parserHints: {
    withSeniors: boolean;
    withChildren: boolean;
    needIndoorIfRain: boolean;
    indoorOutdoor: string;
    durationDays: number;
    pickupArea: string | null;
    mustSeeKeywords: string[];
    /** Mirrors `quickPhotoMode` from the API body — applied after merge via narrow allowlist. */
    quick_photo_mode?: boolean;
  };
  legacyRequestSnapshot: Record<string, unknown>;
};

/**
 * Joins non-empty string parts with " | " as a readable rawText for the parser.
 * The parser normalizes to lowercase before matching, so casing here doesn't matter.
 */
function compactText(parts: Array<string | null | undefined>): string {
  return parts
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
    .join(' | ');
}

/**
 * Build a ParserInput from an already-validated ItineraryUserInput.
 *
 * rawText is assembled from the free-text intent fields:
 *   travelStyle, theme, mustSee (+ mustSeeKeywords joined), groupType, pickupArea
 * These are the fields most likely to contain natural-language intent that the
 * deterministic parser can match against phrase rules and synonym groups.
 *
 * Structured boolean/enum fields (seniors, rainyDay, indoorOutdoor) go into
 * parserHints so buildFixedCandidatePool can apply them as slot overrides
 * when the text parser doesn't catch them.
 */
export function extractParserInputFromInput(input: ItineraryUserInput): ParserInput {
  const locale = input.locale ?? 'ko';

  const rawText = compactText([
    input.travelStyle,
    input.theme,
    input.mustSee,
    input.mustSeeKeywords?.length ? input.mustSeeKeywords.join(', ') : null,
    input.groupType,
    input.pickupArea,
  ]);

  return {
    rawText,
    locale,
    parserHints: {
      withSeniors:       input.seniors ?? false,
      withChildren:      input.withChildren ?? false,
      needIndoorIfRain:  input.rainyDay ?? false,
      indoorOutdoor:     input.indoorOutdoor ?? 'any',
      durationDays:      input.durationDays ?? 1,
      pickupArea:        input.pickupArea ?? null,
      mustSeeKeywords:   input.mustSeeKeywords ?? [],
      ...(input.quickPhotoMode ? { quick_photo_mode: true } : {}),
    },
    legacyRequestSnapshot: {
      destination:   input.destination,
      durationDays:  input.durationDays,
      travelStyle:   input.travelStyle ?? null,
      groupType:     input.groupType ?? null,
      seniors:       input.seniors,
      family:        input.family,
      couple:        input.couple,
      withChildren:  input.withChildren,
      indoorOutdoor: input.indoorOutdoor,
      rainyDay:      input.rainyDay ?? null,
      mustSee:       input.mustSee ?? null,
      theme:         input.theme ?? null,
      pickupArea:    input.pickupArea ?? null,
      locale,
    },
  };
}
