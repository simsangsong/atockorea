/**
 * The POI production run (plan §C W1 stages 1–7, §14.3 grounding + batch).
 *
 * This used to be the body of scripts/produce-poi-video.ts. It moved here so
 * the single-POI CLI and the batch runner execute **the same producer** — a
 * second copy of the render path would drift from the one whose output the
 * review queue approves, which is exactly the failure the dining seeder calls
 * out ("it calls the SAME collectCell the app calls").
 *
 * Stages: ingest (local imagery, licence + AI-image gate) → script (grounded,
 * see poiScript.ts) → TTS → adaptive timeline → subtitles → ffmpeg render →
 * QC probe. Nothing here publishes: the run lands on disk, `uploadProducedRun`
 * puts it in the review queue as pending_review, and only an admin approval in
 * /admin/poi-videos ever serves it (VP-D10).
 *
 * 🔴 Real binaries required. ffmpeg + ffprobe must exist; there is no
 * placeholder render and no fake media.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type VideoLanguageCode, videoLanguageProfile } from '@/lib/video-automation/languages';
import { toRepoRelative } from '@/lib/video-automation/poiSource';
import { resolveVideoPoiSource, type VideoSourceDbClient } from '@/lib/video-automation/poiSource.server';
import { assembleGroundedScript } from '@/lib/video-automation/poiScript';
import { generatePoiNarration } from '@/lib/video-automation/poiScript.server';
import { buildRenderArgs, SUBTITLE_FONT_BY_LANGUAGE } from '@/lib/video-automation/produce/ffmpegGraph';
import { planSceneImages } from '@/lib/video-automation/produce/ingest';
import { computeProductionTimeline } from '@/lib/video-automation/produce/timeline';
import { cuesForScene, cuesToSrt, cuesToVtt } from '@/lib/video-automation/produce/subtitleCues';
import { synthesizeSceneNarration, type TtsMode } from '@/lib/video-automation/produce/tts';
import type { VideoPoiSource, VideoScript } from '@/lib/video-automation/types';

export type ScriptMode = 'template' | 'llm';

export interface QcCheck {
  name: string;
  status: 'passed' | 'warning' | 'failed';
  detail: string;
}

export interface ProduceLanguageResult {
  language: VideoLanguageCode;
  renderPath: string | null;
  vttPath: string;
  srtPath: string;
  totalSeconds: number;
  narrationMode: TtsMode;
  narrationSource: 'llm' | 'template';
  narrationCached: number;
  narrationChars: number;
  removedClaims: number;
  sceneDurations: number[];
}

export interface ProduceOptions {
  root: string;
  poi: string;
  tour?: string;
  outDir?: string;
  version: number;
  languages: VideoLanguageCode[];
  tts: TtsMode;
  burnSubtitles: boolean;
  script: ScriptMode;
  /** Optional — enables the match_pois / generated_spot_content source legs. */
  supabase?: VideoSourceDbClient | null;
  log?: (line: string) => void;
}

export interface ProduceResult {
  ok: boolean;
  poiId: string;
  outputDir: string;
  qcStatus: 'passed' | 'warning' | 'failed';
  checks: QcCheck[];
  poster: string | null;
  languages: ProduceLanguageResult[];
  /** Total characters sent to the TTS provider (0 in silent mode). */
  ttsChars: number;
}

const SCENE_COUNT = 6;

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function writeText(filePath: string, value: string): void {
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, value, 'utf8');
}

function commandAvailable(command: string): boolean {
  const result = spawnSync(command, ['-version'], { stdio: 'ignore' });
  return result.status === 0;
}

export function resolveMediaCommand(command: 'ffmpeg' | 'ffprobe'): string | null {
  const envKey = command === 'ffmpeg' ? 'FFMPEG_PATH' : 'FFPROBE_PATH';
  const configured = process.env[envKey];
  if (configured && commandAvailable(configured)) return configured;
  return commandAvailable(command) ? command : null;
}

interface ProbeResult {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
}

function probeRender(ffprobeCommand: string, filePath: string): ProbeResult {
  const result = spawnSync(ffprobeCommand, [
    '-v',
    'error',
    '-show_entries',
    'stream=codec_type,width,height',
    '-show_entries',
    'format=duration',
    '-of',
    'json',
    filePath,
  ]);
  if (result.status !== 0) return { durationSeconds: null, width: null, height: null, hasAudio: false };
  try {
    const parsed = JSON.parse(result.stdout.toString('utf8')) as {
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
      format?: { duration?: string };
    };
    const video = parsed.streams?.find((stream) => stream.codec_type === 'video');
    const duration = Number(parsed.format?.duration);
    return {
      durationSeconds: Number.isFinite(duration) ? duration : null,
      width: video?.width ?? null,
      height: video?.height ?? null,
      hasAudio: Boolean(parsed.streams?.some((stream) => stream.codec_type === 'audio')),
    };
  } catch {
    return { durationSeconds: null, width: null, height: null, hasAudio: false };
  }
}

/** Web URI like /images/... → repo-relative file path with forward slashes. */
function imageUriToRelativePath(uri: string): string {
  return `public${uri}`.replace(/\\/g, '/');
}

/** Deterministic run directory for a (poi, version, languages, tts, script). */
export function runDirFor(
  base: string,
  source: Pick<VideoPoiSource, 'poiId'>,
  options: Pick<ProduceOptions, 'version' | 'languages' | 'tts' | 'script'>,
): string {
  const key = createHash('sha1')
    .update(
      JSON.stringify({
        poi: source.poiId,
        version: options.version,
        languages: options.languages,
        tts: options.tts,
        script: options.script,
      }),
    )
    .digest('hex')
    .slice(0, 10);
  return path.join(base, source.poiId, `prod-v${options.version}-${key}`);
}

export function productionBaseDir(root: string, outDir?: string): string {
  return outDir ? path.resolve(root, outDir) : path.join(root, '.tmp', 'video-automation');
}

export async function producePoiVideo(options: ProduceOptions): Promise<ProduceResult> {
  const { root } = options;
  const log = options.log ?? (() => {});

  const ffmpegCommand = resolveMediaCommand('ffmpeg');
  const ffprobeCommand = resolveMediaCommand('ffprobe');
  if (!ffmpegCommand || !ffprobeCommand) {
    throw new Error('video production requires ffmpeg and ffprobe (install or set FFMPEG_PATH/FFPROBE_PATH).');
  }

  const source = await resolveVideoPoiSource(root, options.supabase ?? null, {
    poi: options.poi,
    tour: options.tour,
    languages: options.languages,
  });

  const base = productionBaseDir(root, options.outDir);
  const out = runDirFor(base, source, options);
  ensureDir(out);
  const cacheDir = path.join(base, 'tts-cache');

  // Stage 1 — ingest: plan one still per scene from local POI imagery (VP-D6).
  const referenceContent = source.localized.en ?? Object.values(source.localized)[0];
  const imagePlan = planSceneImages(referenceContent, SCENE_COUNT, (uri) =>
    existsSync(path.join(root, 'public', uri.replace(/^\//, ''))),
  );
  if (imagePlan.selected.length === 0) {
    throw new Error(
      `No usable local images for ${source.poiId}. ` +
        'Production render needs local imagery under public/ (remote-only POIs are not renderable yet).',
    );
  }
  const sceneImages = imagePlan.selected.map(imageUriToRelativePath);

  const coverageWarnings: string[] = [];
  const languageResults: ProduceLanguageResult[] = [];
  const checks: QcCheck[] = [];
  const groundingLog: Array<Record<string, unknown>> = [];
  let ttsChars = 0;

  for (const language of options.languages) {
    const profile = videoLanguageProfile(language);
    const suffix = profile.subtitleFileSuffix;

    // Stage 2 — script. Grounded assembly runs in both modes; the LLM only
    // supplies a draft that the claim filter then has to accept.
    const generation =
      options.script === 'llm' ? await generatePoiNarration(source, language) : null;
    if (generation?.error) {
      coverageWarnings.push(`${language}: narration draft unavailable (${generation.error}); template narration used.`);
    }
    const grounded = assembleGroundedScript(source, language, generation?.draft ?? null);
    const script = grounded.script;

    const content = source.localized[language];
    if (!content || content.sourceLocale !== profile.sourceLocale) {
      coverageWarnings.push(`${language}: localized source missing, narration falls back to English content.`);
    }
    groundingLog.push({
      language,
      narrationSource: grounded.narrationSource,
      provider: generation?.provider ?? null,
      model: generation?.model ?? null,
      criticApplied: generation?.criticApplied ?? false,
      factCount: grounded.sheet.facts.length,
      factFields: grounded.sheet.facts.map((fact) => fact.field),
      removedClaims: grounded.removedClaims,
      emptyScenes: grounded.emptyScenes,
    });

    // Stage 3 — narration synthesis. An empty scene (everything it could have
    // said was unsupported) stays silent rather than being padded with filler.
    const narrations = [];
    for (const [index, scene] of script.scenes.entries()) {
      const speak = scene.narration.trim();
      const mode: TtsMode = speak ? options.tts : 'silent';
      if (mode === 'openai') ttsChars += speak.length;
      const narration = await synthesizeSceneNarration({
        text: speak,
        language,
        mode,
        outPath: path.join(out, 'narration', suffix, `scene-${index + 1}.${mode === 'openai' ? 'mp3' : 'wav'}`),
        cacheDir,
        ffprobeCommand,
      });
      narrations.push(narration);
    }

    // Stage 4 — adaptive timeline from narration lengths (VP-D5).
    const timeline = computeProductionTimeline({ narrationSeconds: narrations.map((n) => n.seconds) });

    // Stage 5 — subtitles resynced to the adaptive timeline (subtitles.ts
    // formatters, shared with the safety tracks — not forked).
    const adaptedScript: VideoScript = {
      ...script,
      duration: timeline.total,
      scenes: script.scenes.map((scene, index) => ({
        ...scene,
        start: timeline.scenes[index].subtitleStart,
        end: timeline.scenes[index].subtitleEnd,
      })),
    };
    const cues = script.scenes.flatMap((scene, index) =>
      cuesForScene(scene.narration, language, timeline.scenes[index].subtitleStart, timeline.scenes[index].subtitleEnd),
    );
    const vttPath = path.join(out, 'subtitles', `${suffix}.vtt`);
    const srtPath = path.join(out, 'subtitles', `${suffix}.srt`);
    writeText(vttPath, cuesToVtt(cues));
    writeText(srtPath, cuesToSrt(cues));
    writeJson(path.join(out, 'scripts', `${suffix}.script.json`), adaptedScript);
    writeText(path.join(out, 'narration', `${suffix}.txt`), script.scenes.map((s) => s.narration).join('\n'));

    // Stage 6 — render.
    const renderPath = path.join(out, 'renders', `${source.poiId}-${suffix}.mp4`);
    ensureDir(path.dirname(renderPath));
    const args = buildRenderArgs({
      images: sceneImages,
      narrations: narrations.map((narration, index) => ({
        path: toRepoRelative(root, narration.path),
        delayMs: timeline.scenes[index].narrationDelayMs,
      })),
      timeline,
      srtPath: options.burnSubtitles ? toRepoRelative(root, srtPath) : undefined,
      fontName: SUBTITLE_FONT_BY_LANGUAGE[language],
      outputPath: toRepoRelative(root, renderPath),
    });
    const render = spawnSync(ffmpegCommand, args, { cwd: root, stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 });
    const rendered = render.status === 0;
    if (!rendered) {
      writeText(`${renderPath}.error.txt`, render.stderr?.toString('utf8').slice(0, 4000) ?? 'unknown ffmpeg error');
    }

    // No-overlap guard: every narration must fit inside its own scene.
    const overflowScenes = narrations
      .map((narration, index) => ({ index, over: narration.seconds + 0.5 - timeline.scenes[index].duration }))
      .filter((entry) => entry.over > 0);
    checks.push({
      name: `narration_fit_${suffix}`,
      status: overflowScenes.length === 0 ? 'passed' : 'failed',
      detail:
        overflowScenes.length === 0
          ? 'All narrations fit their scenes; no overlapping voices.'
          : `Scene(s) ${overflowScenes.map((entry) => entry.index + 1).join(', ')} narration exceeds scene length.`,
    });

    // Stage 7 — per-language QC probes.
    const probe = rendered ? probeRender(ffprobeCommand, renderPath) : null;
    const durationOk =
      probe !== null && probe.durationSeconds !== null
        ? Math.abs(probe.durationSeconds - timeline.total) <= 1.5
        : false;
    const resolutionOk = probe?.width === 1080 && probe?.height === 1920;
    checks.push({
      name: `render_${suffix}`,
      status: rendered && durationOk && resolutionOk && probe?.hasAudio ? 'passed' : 'failed',
      detail: rendered
        ? `duration=${probe?.durationSeconds?.toFixed(2)}s (target ${timeline.total.toFixed(2)}s), ${probe?.width}x${probe?.height}, audio=${probe?.hasAudio}`
        : 'ffmpeg render failed; see renders/*.error.txt',
    });

    log(`  ${language}: ${rendered ? 'rendered' : 'RENDER FAILED'} · ${grounded.narrationSource} narration`);

    languageResults.push({
      language,
      renderPath: rendered ? toRepoRelative(root, renderPath) : null,
      vttPath: toRepoRelative(root, vttPath),
      srtPath: toRepoRelative(root, srtPath),
      totalSeconds: timeline.total,
      narrationMode: options.tts,
      narrationSource: grounded.narrationSource,
      narrationCached: narrations.filter((narration) => narration.cached).length,
      narrationChars: script.scenes.reduce((sum, scene) => sum + scene.narration.length, 0),
      removedClaims: grounded.removedClaims.length,
      sceneDurations: timeline.scenes.map((scene) => scene.duration),
    });
  }

  // Poster from the first successful render's real frame.
  const firstRender = languageResults.find((result) => result.renderPath);
  const posterPath = path.join(out, 'poster', `${source.poiId}.png`);
  let posterRelative: string | null = null;
  if (firstRender?.renderPath) {
    ensureDir(path.dirname(posterPath));
    const poster = spawnSync(
      ffmpegCommand,
      ['-y', '-ss', '1.2', '-i', firstRender.renderPath, '-frames:v', '1', toRepoRelative(root, posterPath)],
      { cwd: root, stdio: 'pipe' },
    );
    if (poster.status === 0) posterRelative = toRepoRelative(root, posterPath);
  }

  // Global QC checks.
  checks.push({
    name: 'language_coverage',
    status: coverageWarnings.length === 0 ? 'passed' : 'warning',
    detail: coverageWarnings.length === 0 ? 'All languages use localized source content.' : coverageWarnings.join(' '),
  });
  const unknownLicenses = Object.values(imagePlan.licenses).filter((license) => license.status !== 'cleared').length;
  checks.push({
    name: 'image_license',
    status: unknownLicenses === 0 ? 'passed' : 'warning',
    detail:
      unknownLicenses === 0
        ? `All ${imagePlan.pool.length} images auto-cleared (atoc-korea).`
        : `${unknownLicenses} image(s) with unreviewed license; publication blocked until cleared.`,
  });
  checks.push({
    name: 'narration_mode',
    status: options.tts === 'openai' ? 'passed' : 'warning',
    detail: options.tts === 'openai' ? 'Real TTS narration.' : 'Silent placeholder narration (--tts=silent).',
  });
  checks.push({
    name: 'scene_images',
    status: imagePlan.pool.length >= 3 ? 'passed' : 'warning',
    detail: `${imagePlan.pool.length} unique image(s) across ${SCENE_COUNT} scenes. ${imagePlan.warnings.join(' ')}`.trim(),
  });

  // Grounding is a QC surface, not a silent filter: a reviewer must be able to
  // see what the model tried to say and why it was cut.
  const removedTotal = languageResults.reduce((sum, result) => sum + result.removedClaims, 0);
  const emptyTotal = groundingLog.reduce(
    (sum, entry) => sum + ((entry.emptyScenes as string[] | undefined)?.length ?? 0),
    0,
  );
  checks.push({
    name: 'narration_grounding',
    status: emptyTotal > 0 ? 'warning' : 'passed',
    detail:
      `${removedTotal} unsupported claim sentence(s) removed; ` +
      `${emptyTotal} scene(s) left without narration (silent visuals).`,
  });

  const failed = checks.some((check) => check.status === 'failed');
  const warning = checks.some((check) => check.status === 'warning');
  const qcStatus: ProduceResult['qcStatus'] = failed ? 'failed' : warning ? 'warning' : 'passed';

  writeJson(path.join(out, 'qc-production.json'), {
    poiId: source.poiId,
    version: options.version,
    status: qcStatus,
    checks,
  });
  writeJson(path.join(out, 'source.json'), source);
  writeJson(path.join(out, 'grounding.json'), { poiId: source.poiId, languages: groundingLog });
  writeJson(path.join(out, 'run-summary.json'), {
    workflow: 'video:produce (W1 + §14.3 grounding)',
    poiId: source.poiId,
    tourSlug: source.tourSlug,
    outputDir: toRepoRelative(root, out),
    tts: options.tts,
    scriptMode: options.script,
    burnSubtitles: options.burnSubtitles,
    targetLanguages: options.languages,
    poster: posterRelative,
    sceneImages: imagePlan.selected,
    imageLicenses: imagePlan.licenses,
    excludedAiImages: imagePlan.excludedAi,
    demotedBulkImages: imagePlan.demotedBulk,
    coverageWarnings,
    languages: languageResults,
    qcStatus,
    publishState: 'awaiting_publish_approval',
  });

  return {
    ok: !failed,
    poiId: source.poiId,
    outputDir: toRepoRelative(root, out),
    qcStatus,
    checks,
    poster: posterRelative,
    languages: languageResults,
    ttsChars,
  };
}
