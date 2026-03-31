/**
 * Persists a completed deterministic run for observability (itinerary_runs).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeminiDraft } from '@/lib/itinerary/types';

export async function persistItineraryRun(
  supabase: SupabaseClient<any, any, any>,
  params: {
    requestProfileId: string | null;
    generationLogId: number | null;
    draft: GeminiDraft;
    routeSummary: Record<string, unknown>;
    /** Optional FK when this run was seeded from a template. */
    templateId?: string | null;
  },
): Promise<void> {
  if (!params.requestProfileId) return;

  try {
    const row: Record<string, unknown> = {
      request_profile_id: params.requestProfileId,
      generation_log_id: params.generationLogId,
      final_poi_sequence: params.draft.stops.map((s) => ({
        contentId: s.contentId,
        sortOrder: s.sortOrder,
        plannedDurationMin: s.plannedDurationMin,
      })),
      route_summary: params.routeSummary,
    };
    if (params.templateId != null && params.templateId !== '') {
      row.template_id = params.templateId;
    }
    const { error } = await supabase.from('itinerary_runs').insert(row);
    if (error) {
      console.warn('[itinerary] itinerary_runs insert skipped:', error.message);
    }
  } catch (e) {
    console.warn('[itinerary] itinerary_runs insert failed', e);
  }
}
