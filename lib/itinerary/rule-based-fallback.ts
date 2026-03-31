import type { GeminiDraft, ItineraryUserInput } from './types';
import type { JejuPoiRow } from './types';

/**
 * Deterministic itinerary when Gemini/Claude unavailable — only uses candidate IDs.
 */
export function buildRuleBasedDraft(
  candidates: JejuPoiRow[],
  input: ItineraryUserInput,
): GeminiDraft {
  const n = Math.min(6, Math.max(3, Math.ceil((input.durationDays || 1) * 3)));
  const slice = candidates.slice(0, n);
  const stops = slice.map((r, i) => ({
    contentId: String(r.content_id),
    contentTypeId: typeof r.content_type_id === 'number' ? r.content_type_id : 12,
    reason:
      input.mustSee && (r.title || '').includes(input.mustSee)
        ? `Matches your must-see preference and regional fit.`
        : `Selected from curated Jeju POIs by score and data quality.`,
    plannedDurationMin: r.recommended_duration_min && r.recommended_duration_min > 0
      ? Math.min(180, r.recommended_duration_min)
      : 90,
    sortOrder: i + 1,
  }));
  return {
    tourTitle: `${input.destination || 'Jeju'} — ${input.travelStyle || 'Custom'} day`,
    tourSummary:
      'Rule-based itinerary from verified database POIs (LLM unavailable). Adjust times on site.',
    stops,
    notes: ['fallback:rule_based'],
  };
}
