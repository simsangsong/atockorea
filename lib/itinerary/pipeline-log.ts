import type { SupabaseClient } from '@supabase/supabase-js';
import { getItineraryPromptVersionsRecord } from './prompt-versions';

export const PIPELINE_STAGES = [
  'request_received',
  'candidate_fetched',
  'gemini_generated',
  'claude_reviewed',
  'validated',
  'travel_time_resolved',
  'hydrated',
  'fallback_used',
  'completed',
  'failed',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type ProviderOutcome = 'success' | 'failed' | 'skipped';

export type ProviderStatusMap = {
  gemini: ProviderOutcome;
  claude: ProviderOutcome;
};

export type PipelineEventRecord = {
  stage: PipelineStage;
  at: string;
  success: boolean;
  /** Counts only — no raw text or oversized payloads */
  metadata: Record<string, number>;
};

export function appendPipelineEvent(
  events: PipelineEventRecord[],
  stage: PipelineStage,
  success: boolean,
  metadata: Record<string, number> = {},
): void {
  events.push({
    stage,
    at: new Date().toISOString(),
    success,
    metadata,
  });
}

export function defaultProviderStatus(): ProviderStatusMap {
  return { gemini: 'skipped', claude: 'skipped' };
}

export async function insertItineraryPipelineLog(
  supabase: SupabaseClient,
  args: {
    userInputSlice: Record<string, unknown>;
    events: PipelineEventRecord[];
    providerStatus: ProviderStatusMap;
  },
): Promise<number | null> {
  try {
    const last = args.events[args.events.length - 1];
    const { data, error } = await supabase
      .from('itinerary_generation_logs')
      .insert({
        user_input: args.userInputSlice,
        candidate_ids: [],
        pipeline_stage: last?.stage ?? 'request_received',
        pipeline_events: args.events,
        prompt_versions: getItineraryPromptVersionsRecord(),
        provider_status: args.providerStatus,
        fallback_reason: null,
      })
      .select('id')
      .single();

    if (error || data == null || data.id == null) {
      console.warn('[itinerary] pipeline log insert failed', error);
      return null;
    }
    return Number(data.id);
  } catch (e) {
    console.warn('[itinerary] pipeline log insert failed', e);
    return null;
  }
}

export async function updateItineraryPipelineLog(
  supabase: SupabaseClient,
  logId: number,
  patch: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('itinerary_generation_logs')
      .update(patch)
      .eq('id', logId);
    if (error) console.warn('[itinerary] pipeline log update failed', error);
  } catch (e) {
    console.warn('[itinerary] pipeline log update failed', e);
  }
}
