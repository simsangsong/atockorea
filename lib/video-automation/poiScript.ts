/**
 * Grounded POI intro script (plan §14.3).
 *
 * `buildVideoScript()` in pipeline.ts stitches a script out of whatever
 * sentence happens to sit first in the source row. It never invents anything,
 * but it also never *writes* anything — the narration is the source text read
 * aloud, which is fine for a dry run and flat as a 60-second film.
 *
 * This module keeps the safety of the template path and adds the narrative:
 *   facts → LLM draft → critic → claim filter → the same six scene slots.
 * The last step is not optional. Whatever the model returns, every sentence
 * carrying a hard claim (a time, a price, a measurement, a superlative) that
 * the fact sheet cannot back is removed before it reaches a viewer — see
 * poiFacts.ts. When the model is unavailable the template narration is used
 * instead, through the identical filter.
 *
 * Client-safe: pure. The LLM call lives in poiScript.server.ts.
 */

import {
  type VideoLanguageCode,
  videoLanguageProfile,
} from '@/lib/video-automation/languages';
import {
  buildFactSheet,
  stripUnsupportedClaims,
  type PoiFactSheet,
  type StripResult,
} from '@/lib/video-automation/poiFacts';
import {
  CTA_BY_LANGUAGE,
  HOOK_BY_LANGUAGE,
  TIMELINE,
  buildVideoScript,
  trimForSpeech,
} from '@/lib/video-automation/pipeline';
import type { VideoPoiSource, VideoScript, VideoScriptScene } from '@/lib/video-automation/types';

/** The four narrated scenes the model writes (scene 1 hook and 6 CTA are fixed). */
export const NARRATIVE_SCENE_KEYS = ['identity', 'background', 'must_see', 'visit_tip'] as const;
export type NarrativeSceneKey = (typeof NARRATIVE_SCENE_KEYS)[number];

export type NarrativeDraft = Partial<Record<NarrativeSceneKey, string>>;

// ---------------------------------------------------------------------------
// Prompts (mirrors lib/tour-room/generatedContent.ts: generate then critic)
// ---------------------------------------------------------------------------

export function buildPoiScriptPrompt(sheet: PoiFactSheet): { system: string; user: string } {
  const profile = videoLanguageProfile(sheet.language);
  const system = [
    'You write narration for a 60-second vertical travel short about one Korean tourist spot. Output STRICT JSON only, no markdown fences, no commentary.',
    `Schema: { "identity": string, "background": string, "must_see": string, "visit_tip": string }`,
    'Each value is ONE or TWO spoken sentences. identity = what this place is; background = history or culture; must_see = the single thing to look at; visit_tip = a practical or experiential tip.',
    'HARD RULES: every factual claim — opening hours, prices, admission, phone numbers, distances, dates/years, rankings such as "the largest" or "the oldest" — must appear in the FACTS block verbatim, or be OMITTED. Never estimate, never round, never guess.',
    'With thin FACTS, write shorter narration. Silence is correct; invention is not.',
    `Write natively in ${profile.label} (not a translation of English). Tone: warm, concrete, spoken aloud, no marketing fluff, no second-person imperatives about buying anything.`,
  ].join('\n');
  const user = [
    `Place: ${sheet.name} (Korea)`,
    `Language: ${profile.label} (${sheet.language})`,
    'FACTS (the only permitted source of factual claims):',
    ...sheet.facts.map((fact) => `- ${fact.field}: ${fact.text}`),
    sheet.facts.length === 0 ? '- NONE' : '',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

export function buildPoiScriptCriticPrompt(
  sheet: PoiFactSheet,
  draft: NarrativeDraft,
): { system: string; user: string } {
  const system = [
    'You are a fact-check filter for travel-video narration. Output STRICT JSON only, the same four keys as the DRAFT.',
    'Delete any clause not supported by the FACTS block: opening hours, prices or admission, phone numbers, exact distances or sizes, dates and years, and rankings ("largest", "oldest", "only", "first").',
    'Keep atmosphere, sensory description, and history framed as general knowledge ("known for", "famous as"). Do not add anything new. Keep every key, even if the value becomes an empty string.',
  ].join('\n');
  const user = [
    `Place: ${sheet.name}`,
    'FACTS:',
    ...sheet.facts.map((fact) => `- ${fact.field}: ${fact.text}`),
    `DRAFT: ${JSON.stringify(draft)}`,
  ].join('\n');
  return { system, user };
}

/** Strip fences, parse, and keep only the four known keys as trimmed strings. */
export function parsePoiScriptJson(raw: string): NarrativeDraft | null {
  let text = (raw ?? '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const out: NarrativeDraft = {};
    for (const key of NARRATIVE_SCENE_KEYS) {
      const value = parsed[key];
      if (typeof value === 'string' && value.trim()) out[key] = value.replace(/\s+/g, ' ').trim();
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export interface GroundedScriptResult {
  script: VideoScript;
  sheet: PoiFactSheet;
  /** 'llm' when the draft was used, 'template' when we fell back. */
  narrationSource: 'llm' | 'template';
  /** Sentences the claim filter deleted, per scene — surfaced in QC. */
  removedClaims: Array<{ sceneId: string; sentence: string; claim: string; kind: string }>;
  /** Scenes whose narration ended up empty after filtering. */
  emptyScenes: string[];
}

function groundedNarration(
  raw: string,
  sheet: PoiFactSheet,
): { text: string; removed: StripResult['removed'] } {
  const stripped = stripUnsupportedClaims(raw, sheet);
  return { text: trimForSpeech(stripped.text, sheet.language), removed: stripped.removed };
}

/**
 * Six scenes from a fact-checked draft. `draft` may be null (or partial) — the
 * template script fills any missing slot, and the claim filter runs over both
 * paths so the guarantee does not depend on which one produced the sentence.
 */
export function assembleGroundedScript(
  source: VideoPoiSource,
  language: VideoLanguageCode,
  draft: NarrativeDraft | null,
): GroundedScriptResult {
  const sheet = buildFactSheet(source, language);
  const template = buildVideoScript(source, language);
  const name = sheet.name;

  const removedClaims: GroundedScriptResult['removedClaims'] = [];
  const emptyScenes: string[] = [];
  let usedLlm = false;

  const scenes: VideoScriptScene[] = TIMELINE.map((slot, index) => {
    const base = template.scenes[index];
    // Scenes 1 and 6 are fixed brand copy, not statements about the POI.
    if (index === 0) return { ...base, narration: HOOK_BY_LANGUAGE[language](name), screenText: name };
    if (index === 5) {
      return { ...base, narration: CTA_BY_LANGUAGE[language], screenText: 'ATOCKOREA Smart Guide' };
    }

    const key = NARRATIVE_SCENE_KEYS[index - 1];
    const drafted = draft?.[key]?.trim();
    if (drafted) usedLlm = true;
    const { text, removed } = groundedNarration(drafted || base.narration, sheet);
    for (const entry of removed) {
      removedClaims.push({
        sceneId: base.sceneId,
        sentence: entry.sentence,
        claim: entry.claim.text,
        kind: entry.claim.kind,
      });
    }
    if (!text) emptyScenes.push(base.sceneId);
    return { ...base, narration: text, screenText: text || name };
  });

  return {
    script: { ...template, scenes },
    sheet,
    narrationSource: usedLlm ? 'llm' : 'template',
    removedClaims,
    emptyScenes,
  };
}
