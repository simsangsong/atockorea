/**
 * Batch planning for POI intro shorts (plan §14.3, §D W5 "전 POI 배치").
 *
 * Same split as lib/ops/dining/seed.ts: everything that decides how much money
 * and how much render time a run spends is a pure module so a unit test can pin
 * it, and the script does only io (load rows, call the producer, pace, print).
 *
 * Posture: **nothing runs without `--apply`.** A bare `npm run video:batch`
 * prints the plan — which POIs, in what order, what it would cost — and exits
 * without touching ffmpeg, the TTS provider, or the database.
 *
 * Client-safe: pure. No node:*, no supabase, no clock.
 */

import {
  DEFAULT_VIDEO_LANGUAGE_CODES,
  normalizeVideoLanguageCode,
  type VideoLanguageCode,
} from '@/lib/video-automation/languages';

/** §F of the video plan measured ≈ $0.05 per POI across the 4 languages. */
export const ESTIMATED_TTS_USD_PER_LANGUAGE = 0.0125;
/** Default ceiling for one batch run. `--budget=` overrides. */
export const DEFAULT_BATCH_BUDGET_USD = 2;
/** Default number of POIs one run will touch. `--limit=` overrides. */
export const DEFAULT_BATCH_LIMIT = 10;
/** Gentle pacing between POIs, matching scripts/seed-dining-cells.ts. */
export const BATCH_DELAY_MS = 250;

export type BatchSkipReason = 'produced' | 'uploaded' | 'no-images';

export interface BatchCandidate {
  poiKey: string;
  label: string;
  region: string | null;
  /**
   * Local image files the ingest stage could use. 0 → not renderable, skipped.
   * null → unknown (the POI has no `match_pois` row, so only the file sources
   * can answer); those are attempted and the producer raises the honest error.
   */
  imageCount: number | null;
  /** Times this POI appears on a real itinerary — the ordering signal. */
  visits: number;
}

export interface BatchTarget extends BatchCandidate {
  skip: BatchSkipReason | null;
  /** Run directory that already satisfies this POI, when `skip === 'produced'`. */
  existingRunDir: string | null;
}

export interface BatchPlan {
  produce: BatchTarget[];
  skipped: BatchTarget[];
  limit: number;
  /** Best-effort TTS estimate for `produce`, in USD. */
  estimatedUsd: number;
}

export interface BatchOptions {
  /** Default posture — nothing is produced unless `--apply` is passed. */
  dry: boolean;
  apply: boolean;
  force: boolean;
  limit: number | null;
  poiKeys: string[];
  region: string | null;
  languages: VideoLanguageCode[];
  tts: 'openai' | 'silent';
  script: 'template' | 'llm';
  version: number;
  /** File the produced runs into the review queue as pending_review. */
  upload: boolean;
  allowWarnings: boolean;
  budgetUsd: number;
}

export function parseBatchArgs(argv: string[]): BatchOptions {
  const options: BatchOptions = {
    dry: true,
    apply: false,
    force: false,
    limit: null,
    poiKeys: [],
    region: null,
    languages: [...DEFAULT_VIDEO_LANGUAGE_CODES],
    tts: 'silent',
    script: 'template',
    version: 1,
    upload: false,
    allowWarnings: false,
    budgetUsd: DEFAULT_BATCH_BUDGET_USD,
  };

  for (const arg of argv) {
    if (arg === '--apply') {
      options.apply = true;
      options.dry = false;
    } else if (arg === '--dry') {
      options.dry = true;
      options.apply = false;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--upload') {
      options.upload = true;
    } else if (arg === '--allow-warnings') {
      options.allowWarnings = true;
    } else if (arg.startsWith('--limit=')) {
      const limit = Number(arg.slice('--limit='.length));
      if (!Number.isFinite(limit) || limit <= 0) throw new Error(`Invalid --limit: ${arg}`);
      options.limit = Math.floor(limit);
    } else if (arg.startsWith('--poi=')) {
      options.poiKeys.push(
        ...arg
          .slice('--poi='.length)
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
      );
    } else if (arg.startsWith('--region=')) {
      options.region = arg.slice('--region='.length).trim() || null;
    } else if (arg.startsWith('--languages=')) {
      const languages = arg
        .slice('--languages='.length)
        .split(',')
        .map((part) => normalizeVideoLanguageCode(part))
        .filter((language): language is VideoLanguageCode => language !== null);
      if (languages.length === 0) throw new Error(`Invalid --languages: ${arg}`);
      options.languages = [...new Set(languages)];
    } else if (arg.startsWith('--tts=')) {
      const mode = arg.slice('--tts='.length).trim();
      if (mode !== 'openai' && mode !== 'silent') throw new Error(`Invalid --tts: ${arg}`);
      options.tts = mode;
    } else if (arg.startsWith('--script=')) {
      const mode = arg.slice('--script='.length).trim();
      if (mode !== 'template' && mode !== 'llm') throw new Error(`Invalid --script: ${arg}`);
      options.script = mode;
    } else if (arg.startsWith('--version=')) {
      const version = Number(arg.slice('--version='.length));
      if (!Number.isFinite(version) || version <= 0) throw new Error(`Invalid --version: ${arg}`);
      options.version = Math.round(version);
    } else if (arg.startsWith('--budget=')) {
      const budget = Number(arg.slice('--budget='.length));
      if (!Number.isFinite(budget) || budget < 0) throw new Error(`Invalid --budget: ${arg}`);
      options.budgetUsd = budget;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

export function resolveBatchLimit(options: Pick<BatchOptions, 'limit' | 'poiKeys'>): number {
  if (options.limit !== null) return options.limit;
  // Named POIs are an explicit list: do not silently truncate it.
  if (options.poiKeys.length > 0) return options.poiKeys.length;
  return DEFAULT_BATCH_LIMIT;
}

/**
 * Silent mode costs nothing; only real TTS spends. The number is an estimate
 * and is labelled as one wherever it is printed — the cache means a re-run of
 * the same script costs zero, which this cannot know.
 */
export function estimateBatchCostUsd(
  poiCount: number,
  languageCount: number,
  tts: 'openai' | 'silent',
): number {
  if (tts !== 'openai') return 0;
  return Math.round(poiCount * languageCount * ESTIMATED_TTS_USD_PER_LANGUAGE * 100) / 100;
}

export function shouldAbortForBudget(spentUsd: number, budgetUsd: number): boolean {
  return budgetUsd > 0 && spentUsd >= budgetUsd;
}

export interface BatchPlanInput {
  /** poiKey → run directory of an existing non-failed run. */
  producedRuns?: Record<string, string>;
  /** poiKeys that already have a poi_videos row at the target version. */
  uploadedPoiKeys?: string[];
  limit: number;
  force: boolean;
  languages: VideoLanguageCode[];
  tts: 'openai' | 'silent';
}

/**
 * Order (visits desc, then key) → skip what is already done → cut to the limit.
 *
 * Resumability is derived, not journalled: a completed run directory or an
 * existing `poi_videos` row IS the record that a POI is done, so an
 * interrupted batch resumes correctly just by being run again. `--force`
 * re-produces regardless.
 */
export function planBatch(candidates: BatchCandidate[], input: BatchPlanInput): BatchPlan {
  const producedRuns = input.producedRuns ?? {};
  const uploaded = new Set(input.uploadedPoiKeys ?? []);

  const ordered = [...candidates].sort((a, b) => {
    if (a.visits !== b.visits) return b.visits - a.visits;
    return a.poiKey < b.poiKey ? -1 : a.poiKey > b.poiKey ? 1 : 0;
  });

  const produce: BatchTarget[] = [];
  const skipped: BatchTarget[] = [];

  for (const candidate of ordered) {
    const existingRunDir = producedRuns[candidate.poiKey] ?? null;
    let skip: BatchSkipReason | null = null;
    if (candidate.imageCount === 0) skip = 'no-images';
    else if (!input.force && uploaded.has(candidate.poiKey)) skip = 'uploaded';
    else if (!input.force && existingRunDir) skip = 'produced';

    const target: BatchTarget = { ...candidate, skip, existingRunDir };
    if (skip) skipped.push(target);
    else if (produce.length < input.limit) produce.push(target);
  }

  return {
    produce,
    skipped,
    limit: input.limit,
    estimatedUsd: estimateBatchCostUsd(produce.length, input.languages.length, input.tts),
  };
}
