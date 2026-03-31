/**
 * Build GeminiDraft from a reused content-id sequence (same pool rows only).
 */
import type { GeminiDraft } from '@/lib/itinerary/types';
import type { ItineraryUserInput } from '@/lib/itinerary/types';
import type { JejuPoiRow } from '@/lib/itinerary/types';

export function buildDraftFromReuseSequence(
  contentIds: string[],
  input: ItineraryUserInput,
  byId: Map<string, JejuPoiRow>,
): GeminiDraft {
  const dest = input.destination?.trim() || 'Jeju';
  const stops = contentIds.map((contentId, i) => {
    const row = byId.get(contentId);
    const rec = row?.recommended_duration_min;
    const dwell =
      typeof rec === 'number' && rec > 0
        ? Math.min(300, Math.max(20, Math.round(rec)))
        : 60;
    return {
      contentId,
      contentTypeId: typeof row?.content_type_id === 'number' ? row.content_type_id : 12,
      reason: `Reused itinerary slot ${i + 1} — matched prior successful run.`,
      plannedDurationMin: Math.min(480, Math.max(15, dwell)),
      sortOrder: i + 1,
    };
  });

  return {
    tourTitle: `${dest} — matched prior route`.slice(0, 200),
    tourSummary:
      'Reused a verified POI sequence that matched your constraints and the current candidate pool.',
    stops,
    notes: ['deterministic_reuse:1'],
    warnings: [],
  };
}
