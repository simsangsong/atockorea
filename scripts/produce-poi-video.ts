import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_VIDEO_LANGUAGE_CODES,
  normalizeVideoLanguageCode,
  type VideoLanguageCode,
  videoLanguageProfile,
} from '@/lib/video-automation/languages';
import { buildVideoScript } from '@/lib/video-automation/pipeline';
import { resolvePoiSource, toRepoRelative } from '@/lib/video-automation/poiSource';
import { buildRenderArgs, SUBTITLE_FONT_BY_LANGUAGE } from '@/lib/video-automation/produce/ffmpegGraph';
import { planSceneImages } from '@/lib/video-automation/produce/ingest';
import { computeProductionTimeline } from '@/lib/video-automation/produce/timeline';
import { cuesForScene, cuesToSrt, cuesToVtt } from '@/lib/video-automation/produce/subtitleCues';
import { synthesizeSceneNarration, type TtsMode } from '@/lib/video-automation/produce/tts';
import type { VideoScript } from '@/lib/video-automation/types';

interface CliOptions {
  poi: string;
  tour?: string;
  outDir?: string;
  version: number;
  languages: VideoLanguageCode[];
  tts: TtsMode;
  burnSubtitles: boolean;
}

interface QcCheck {
  name: string;
  status: 'passed' | 'warning' | 'failed';
  detail: string;
}

function usage(): never {
  throw new Error(
    [
      'Usage: npm run video:produce -- --poi=<poi_key> [--tour=<tour_slug>] [--languages=en,zh-Hant,ja,es] [--tts=openai|silent] [--no-burn-subs]',
      'Example: npm run video:produce -- --poi=jagalchi_market --tts=openai',
    ].join('\n'),
  );
}

function parseArgs(argv: string[]): CliOptions {
  const opts: Partial<CliOptions> = {
    version: 1,
    languages: [...DEFAULT_VIDEO_LANGUAGE_CODES],
    tts: 'silent',
    burnSubtitles: true,
  };
  for (const arg of argv) {
    if (arg.startsWith('--poi=')) {
      opts.poi = arg.slice('--poi='.length).trim();
    } else if (arg.startsWith('--tour=')) {
      opts.tour = arg.slice('--tour='.length).trim();
    } else if (arg.startsWith('--outDir=')) {
      opts.outDir = arg.slice('--outDir='.length).trim();
    } else if (arg.startsWith('--version=')) {
      const version = Number(arg.slice('--version='.length));
      if (!Number.isFinite(version) || version <= 0) usage();
      opts.version = Math.round(version);
    } else if (arg.startsWith('--languages=')) {
      const languages = arg
        .slice('--languages='.length)
        .split(',')
        .map((part) => normalizeVideoLanguageCode(part))
        .filter((language): language is VideoLanguageCode => language !== null);
      if (languages.length === 0) usage();
      opts.languages = [...new Set(languages)];
    } else if (arg.startsWith('--tts=')) {
      const mode = arg.slice('--tts='.length).trim();
      if (mode !== 'openai' && mode !== 'silent') usage();
      opts.tts = mode;
    } else if (arg === '--no-burn-subs') {
      opts.burnSubtitles = false;
    } else {
      usage();
    }
  }
  if (!opts.poi) usage();
  return opts as CliOptions;
}

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

function resolveMediaCommand(command: 'ffmpeg' | 'ffprobe'): string | null {
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

function relativeForward(root: string, filePath: string): string {
  return toRepoRelative(root, filePath);
}

async function main(): Promise<void> {
  const root = process.cwd();
  const options = parseArgs(process.argv.slice(2));

  const ffmpegCommand = resolveMediaCommand('ffmpeg');
  const ffprobeCommand = resolveMediaCommand('ffprobe');
  if (!ffmpegCommand || !ffprobeCommand) {
    throw new Error('video:produce requires ffmpeg and ffprobe (install or set FFMPEG_PATH/FFPROBE_PATH).');
  }

  const source = resolvePoiSource(root, { poi: options.poi, tour: options.tour, languages: options.languages });

  const base = options.outDir ? path.resolve(root, options.outDir) : path.join(root, '.tmp', 'video-automation');
  const key = createHash('sha1')
    .update(JSON.stringify({ poi: source.poiId, version: options.version, languages: options.languages, tts: options.tts }))
    .digest('hex')
    .slice(0, 10);
  const out = path.join(base, source.poiId, `prod-v${options.version}-${key}`);
  ensureDir(out);
  const cacheDir = path.join(base, 'tts-cache');

  // Stage 1 — ingest: plan one still per scene from local POI imagery (VP-D6).
  const referenceContent = source.localized.en ?? Object.values(source.localized)[0];
  const sceneCount = 6;
  const imagePlan = planSceneImages(referenceContent, sceneCount, (uri) =>
    existsSync(path.join(root, 'public', uri.replace(/^\//, ''))),
  );
  if (imagePlan.selected.length === 0) {
    throw new Error(
      `No usable local images for ${source.poiId}. ` +
        'Production render needs static tour imagery (poi_kb-only POIs are not renderable yet).',
    );
  }
  const sceneImages = imagePlan.selected.map(imageUriToRelativePath);

  const coverageWarnings: string[] = [];
  const languageResults: Array<Record<string, unknown>> = [];
  const checks: QcCheck[] = [];
  const scriptsByLanguage: VideoScript[] = [];

  for (const language of options.languages) {
    const profile = videoLanguageProfile(language);
    const suffix = profile.subtitleFileSuffix;

    // Stage 2 — script (reused dry-run builder, real POI facts).
    const script = buildVideoScript(source, language);
    scriptsByLanguage.push(script);
    const content = source.localized[language];
    if (!content || content.sourceLocale !== profile.sourceLocale) {
      coverageWarnings.push(`${language}: localized source missing, narration falls back to English content.`);
    }

    // Stage 3 — narration synthesis (cached OpenAI TTS or silent estimate).
    const narrations = [];
    for (const [index, scene] of script.scenes.entries()) {
      const narration = await synthesizeSceneNarration({
        text: scene.narration,
        language,
        mode: options.tts,
        outPath: path.join(out, 'narration', suffix, `scene-${index + 1}.${options.tts === 'openai' ? 'mp3' : 'wav'}`),
        cacheDir,
        ffprobeCommand,
      });
      narrations.push(narration);
    }

    // Stage 4 — adaptive timeline from narration lengths (VP-D5).
    const timeline = computeProductionTimeline({ narrationSeconds: narrations.map((narration) => narration.seconds) });

    // Stage 5 — subtitles resynced to the adaptive timeline, chunked to ≤2-line cues.
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
    writeText(
      path.join(out, 'narration', `${suffix}.txt`),
      script.scenes.map((scene) => scene.narration).join('\n'),
    );

    // Stage 6 — render.
    const renderPath = path.join(out, 'renders', `${source.poiId}-${suffix}.mp4`);
    ensureDir(path.dirname(renderPath));
    const args = buildRenderArgs({
      images: sceneImages,
      narrations: narrations.map((narration, index) => ({
        path: relativeForward(root, narration.path),
        delayMs: timeline.scenes[index].narrationDelayMs,
      })),
      timeline,
      srtPath: options.burnSubtitles ? relativeForward(root, srtPath) : undefined,
      fontName: SUBTITLE_FONT_BY_LANGUAGE[language],
      outputPath: relativeForward(root, renderPath),
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
    const durationOk = probe?.durationSeconds !== null && probe !== null
      ? Math.abs((probe.durationSeconds ?? 0) - timeline.total) <= 1.5
      : false;
    const resolutionOk = probe?.width === 1080 && probe?.height === 1920;
    checks.push({
      name: `render_${suffix}`,
      status: rendered && durationOk && resolutionOk && probe?.hasAudio ? 'passed' : 'failed',
      detail: rendered
        ? `duration=${probe?.durationSeconds?.toFixed(2)}s (target ${timeline.total.toFixed(2)}s), ${probe?.width}x${probe?.height}, audio=${probe?.hasAudio}`
        : 'ffmpeg render failed; see renders/*.error.txt',
    });

    languageResults.push({
      language,
      renderPath: rendered ? relativeForward(root, renderPath) : null,
      vttPath: relativeForward(root, vttPath),
      srtPath: relativeForward(root, srtPath),
      totalSeconds: timeline.total,
      narrationMode: options.tts,
      narrationCached: narrations.filter((narration) => narration.cached).length,
      sceneDurations: timeline.scenes.map((scene) => scene.duration),
    });
  }

  // Poster from the first successful render's real frame.
  const firstRender = languageResults.find((result) => result.renderPath);
  const posterPath = path.join(out, 'poster', `${source.poiId}.png`);
  let posterRelative: string | null = null;
  if (firstRender) {
    ensureDir(path.dirname(posterPath));
    const poster = spawnSync(
      ffmpegCommand,
      ['-y', '-ss', '1.2', '-i', String(firstRender.renderPath), '-frames:v', '1', relativeForward(root, posterPath)],
      { cwd: root, stdio: 'pipe' },
    );
    if (poster.status === 0) posterRelative = relativeForward(root, posterPath);
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
    detail: `${imagePlan.pool.length} unique image(s) across ${sceneCount} scenes. ${imagePlan.warnings.join(' ')}`.trim(),
  });

  const failed = checks.some((check) => check.status === 'failed');
  const warning = checks.some((check) => check.status === 'warning');
  const qc = {
    poiId: source.poiId,
    version: options.version,
    status: failed ? 'failed' : warning ? 'warning' : 'passed',
    checks,
  };

  writeJson(path.join(out, 'qc-production.json'), qc);
  writeJson(path.join(out, 'source.json'), source);
  writeJson(path.join(out, 'run-summary.json'), {
    workflow: 'video:produce (W1)',
    poiId: source.poiId,
    tourSlug: source.tourSlug,
    outputDir: relativeForward(root, out),
    tts: options.tts,
    burnSubtitles: options.burnSubtitles,
    targetLanguages: options.languages,
    poster: posterRelative,
    sceneImages: imagePlan.selected,
    imageLicenses: imagePlan.licenses,
    excludedAiImages: imagePlan.excludedAi,
    demotedBulkImages: imagePlan.demotedBulk,
    coverageWarnings,
    languages: languageResults,
    qcStatus: qc.status,
    publishState: 'awaiting_publish_approval',
  });

  console.log(
    JSON.stringify(
      {
        ok: !failed,
        poiId: source.poiId,
        outputDir: relativeForward(root, out),
        tts: options.tts,
        qcStatus: qc.status,
        renders: languageResults.map((result) => result.renderPath),
        poster: posterRelative,
      },
      null,
      2,
    ),
  );
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
