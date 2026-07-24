/**
 * Server half of the grounded POI script — the two LLM calls (plan §14.3).
 *
 * Kept out of poiScript.ts because lib/ai/router imports node:crypto: the pure
 * prompt/parse/assembly half must stay client-safe (repo pattern:
 * facilityPins.ts vs facilityPins.server.ts).
 *
 * Ladder: 'batch' (deepseek → gemini → openai) — POI copy carries no PII.
 * Any failure returns null and the caller falls back to the template
 * narration, which goes through the identical claim filter.
 */

import { chatCompletion } from '@/lib/ai/router';
import type { VideoLanguageCode } from '@/lib/video-automation/languages';
import { buildFactSheet } from '@/lib/video-automation/poiFacts';
import {
  buildPoiScriptCriticPrompt,
  buildPoiScriptPrompt,
  parsePoiScriptJson,
  type NarrativeDraft,
} from '@/lib/video-automation/poiScript';
import type { VideoPoiSource } from '@/lib/video-automation/types';

export interface NarrationGenerationResult {
  draft: NarrativeDraft | null;
  provider: string;
  model: string;
  /** True when the critic pass ran and its output was used. */
  criticApplied: boolean;
  error?: string;
}

/**
 * facts → draft → critic. Returns `draft: null` when nothing usable came back;
 * the assembly step then uses template narration instead of failing the run.
 */
export async function generatePoiNarration(
  source: VideoPoiSource,
  language: VideoLanguageCode,
): Promise<NarrationGenerationResult> {
  const sheet = buildFactSheet(source, language);
  if (sheet.facts.length === 0) {
    return { draft: null, provider: '', model: '', criticApplied: false, error: 'no_facts' };
  }

  try {
    const prompt = buildPoiScriptPrompt(sheet);
    const completion = await chatCompletion(
      'batch',
      [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      { maxOutputTokens: 900, temperature: 0.5, jsonResponse: true },
    );
    const draft = parsePoiScriptJson(completion.content);
    if (!draft) {
      return {
        draft: null,
        provider: completion.provider,
        model: completion.model,
        criticApplied: false,
        error: 'unparseable_draft',
      };
    }

    let final = draft;
    let criticApplied = false;
    try {
      const critic = buildPoiScriptCriticPrompt(sheet, draft);
      const criticCompletion = await chatCompletion(
        'batch',
        [
          { role: 'system', content: critic.system },
          { role: 'user', content: critic.user },
        ],
        { maxOutputTokens: 900, temperature: 0, jsonResponse: true },
      );
      const reviewed = parsePoiScriptJson(criticCompletion.content);
      if (reviewed) {
        final = reviewed;
        criticApplied = true;
      }
    } catch {
      // Critic outage: the draft's own hard rules plus the deterministic claim
      // filter downstream still stand between the model and the viewer.
    }

    return {
      draft: final,
      provider: completion.provider,
      model: completion.model,
      criticApplied,
    };
  } catch (error) {
    return {
      draft: null,
      provider: '',
      model: '',
      criticApplied: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
