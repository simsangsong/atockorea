/**
 * Central prompt bundle versions for the itinerary pipeline.
 * Bump here when prompt templates change materially.
 */
export const ITINERARY_PROMPT_VERSIONS = {
  gemini: 'v1',
  claude: 'v1',
} as const;

export type ItineraryPromptProviderKey = keyof typeof ITINERARY_PROMPT_VERSIONS;

export function getItineraryPromptVersionsRecord(): Record<ItineraryPromptProviderKey, string> {
  return {
    gemini: ITINERARY_PROMPT_VERSIONS.gemini,
    claude: ITINERARY_PROMPT_VERSIONS.claude,
  };
}
