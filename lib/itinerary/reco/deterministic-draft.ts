/**
 * Builds GeminiDraft-shaped output from deterministic SelectedStop list only.
 * No LLM involvement in POI selection.
 */
import type { GeminiDraft } from '@/lib/itinerary/types';
import type { ItineraryUserInput } from '@/lib/itinerary/types';
import type { JejuPoiRow } from '@/lib/itinerary/types';
import type { SelectedStop } from '@/lib/itinerary/reco/assemble-route';

export function buildDeterministicDraft(
  selected: SelectedStop[],
  input: ItineraryUserInput,
  byContentId: Map<string, JejuPoiRow>,
): GeminiDraft {
  const dest = input.destination?.trim() || 'Jeju';
  const style = input.travelStyle?.trim() || 'Custom';

  const stops = selected.map((s, i) => {
    const row = byContentId.get(s.contentId);
    const title = row?.title?.trim() || s.contentId;
    let reason = `Deterministic pick (score-weighted, SQL pool): ${s.stopType}.`;
    if (s.stopType === 'cafe') reason = `Cafe break matched to cafe preference — ${title}.`;
    if (s.stopType === 'meal') reason = `Meal stop aligned with food preference — ${title}.`;

    return {
      contentId: s.contentId,
      contentTypeId: typeof row?.content_type_id === 'number' ? row.content_type_id : 12,
      reason,
      plannedDurationMin: Math.min(480, Math.max(15, s.plannedStayMinutes)),
      sortOrder: i + 1,
    };
  });

  return {
    tourTitle: `${dest} — ${style}`.slice(0, 200),
    tourSummary:
      'Curated route from parser-weighted, SQL-bounded POI candidates. Times are estimates; verify on site.',
    stops,
    notes: ['deterministic_composition:1'],
    warnings: [],
  };
}
