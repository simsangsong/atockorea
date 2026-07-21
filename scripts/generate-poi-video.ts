import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  DEFAULT_VIDEO_LANGUAGE_CODES,
  normalizeVideoLanguageCode,
  type VideoLanguageCode,
  videoLanguageProfile,
} from '@/lib/video-automation/languages';
import {
  buildAppVideoCardPayload,
  buildAssetManifest,
  buildFacebookPublicationPayload,
  buildQcReport,
  buildStoryboard,
  buildVideoScript,
} from '@/lib/video-automation/pipeline';
import { resolvePoiSource, toRepoRelative } from '@/lib/video-automation/poiSource';
import { buildSrt, buildWebVtt } from '@/lib/video-automation/subtitles';
import type { LanguageOutputPaths, VideoPoiSource } from '@/lib/video-automation/types';

interface CliOptions {
  poi: string;
  tour?: string;
  outDir?: string;
  version: number;
  languages: VideoLanguageCode[];
  dryRun: boolean;
}

function usage(): never {
  throw new Error(
    [
      'Usage: npm run video:generate -- --poi=<poi_key> [--tour=<tour_slug>] [--languages=en,zh-Hant,ja,es] [--outDir=.tmp/video-automation]',
      'Example: npm run video:generate -- --poi=gyeongbokgung_palace --dry-run',
    ].join('\n'),
  );
}

function parseArgs(argv: string[]): CliOptions {
  const opts: Partial<CliOptions> = {
    version: 1,
    languages: [...DEFAULT_VIDEO_LANGUAGE_CODES],
    dryRun: true,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--no-dry-run') {
      opts.dryRun = false;
    } else if (arg.startsWith('--poi=')) {
      opts.poi = arg.slice('--poi='.length).trim();
    } else if (arg.startsWith('--tour=')) {
      opts.tour = arg.slice('--tour='.length).trim();
    } else if (arg.startsWith('--outDir=')) {
      opts.outDir = arg.slice('--outDir='.length).trim();
    } else if (arg.startsWith('--version=')) {
      const version = Number(arg.slice('--version='.length));
      if (!Number.isFinite(version) || version <= 0) usage();
      opts.version = Math.round(version);
    } else if (arg.startsWith('--language=')) {
      const language = normalizeVideoLanguageCode(arg.slice('--language='.length));
      if (!language) usage();
      opts.languages = [language];
    } else if (arg.startsWith('--languages=')) {
      const languages = arg
        .slice('--languages='.length)
        .split(',')
        .map((part) => normalizeVideoLanguageCode(part))
        .filter((language): language is VideoLanguageCode => language !== null);
      if (languages.length === 0) usage();
      opts.languages = [...new Set(languages)];
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

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapTitle(value: string, maxLineLength = 14): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLineLength || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

async function writePoster(filePath: string, source: VideoPoiSource): Promise<void> {
  ensureDir(path.dirname(filePath));
  const titleLines = wrapTitle(source.canonicalName).map((line, index) => (
    `<text x="136" y="${960 + index * 88}" font-family="Arial, sans-serif" font-size="78" font-weight="700" fill="#ffffff">${xmlEscape(line)}</text>`
  )).join('\n    ');
  const subtitle = xmlEscape('ATOCKOREA Smart Guide');
  const svg = `
  <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1920" fill="#102821"/>
    <rect x="70" y="76" width="940" height="1768" rx="36" fill="#f7f3ea"/>
    <rect x="110" y="116" width="860" height="1080" rx="28" fill="#1b4d45"/>
    <text x="136" y="250" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#f7f3ea">ATOCKOREA</text>
    ${titleLines}
    <text x="136" y="1140" font-family="Arial, sans-serif" font-size="44" fill="#d8efe8">${subtitle}</text>
    <text x="136" y="1310" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#102821">1-minute guide</text>
    <text x="136" y="1380" font-family="Arial, sans-serif" font-size="34" fill="#45645d">Draft poster generated from POI text assets.</text>
    <text x="136" y="1710" font-family="Arial, sans-serif" font-size="30" fill="#45645d">Source video pending</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(filePath);
}

function writeSilentWav(filePath: string, durationSeconds: number): void {
  ensureDir(path.dirname(filePath));
  const sampleRate = 16_000;
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const samples = Math.max(1, Math.round(durationSeconds * sampleRate));
  const dataSize = samples * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  writeFileSync(filePath, buffer);
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

function tryRenderMp4(input: {
  ffmpegCommand: string | null;
  posterPath: string;
  audioPath: string;
  outputPath: string;
  durationSeconds: number;
}): string | null {
  if (!input.ffmpegCommand) return null;
  ensureDir(path.dirname(input.outputPath));
  const result = spawnSync(
    input.ffmpegCommand,
    [
      '-y',
      '-loop',
      '1',
      '-i',
      input.posterPath,
      '-i',
      input.audioPath,
      '-t',
      String(input.durationSeconds),
      '-vf',
      'scale=1080:1920',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      input.outputPath,
    ],
    { stdio: 'pipe' },
  );
  if (result.status !== 0) {
    const stderr = result.stderr.toString('utf8').slice(0, 2000);
    writeText(`${input.outputPath}.error.txt`, stderr);
    return null;
  }
  return input.outputPath;
}

function outputRoot(root: string, options: CliOptions, source: VideoPoiSource): string {
  const base = options.outDir ? path.resolve(root, options.outDir) : path.join(root, '.tmp', 'video-automation');
  const key = createHash('sha1')
    .update(JSON.stringify({ poi: source.poiId, version: options.version, languages: options.languages }))
    .digest('hex')
    .slice(0, 10);
  return path.join(base, source.poiId, `v${options.version}-${key}`);
}

async function main(): Promise<void> {
  const root = process.cwd();
  const options = parseArgs(process.argv.slice(2));
  const source = resolvePoiSource(root, { poi: options.poi, tour: options.tour, languages: options.languages });
  const out = outputRoot(root, options, source);
  ensureDir(out);

  const ffmpegCommand = resolveMediaCommand('ffmpeg');
  const ffprobeCommand = resolveMediaCommand('ffprobe');
  const ffmpegAvailable = Boolean(ffmpegCommand);
  const ffprobeAvailable = Boolean(ffprobeCommand);
  const manifest = buildAssetManifest(source, { version: options.version, targetLanguages: options.languages });
  const posterPath = path.join(out, 'poster', `${source.poiId}.png`);
  await writePoster(posterPath, source);

  writeJson(path.join(out, 'asset-manifest.json'), manifest);
  writeJson(path.join(out, 'source.json'), source);

  const languageOutputs: LanguageOutputPaths[] = [];
  const scripts = [];
  const storyboards = [];

  for (const language of options.languages) {
    const profile = videoLanguageProfile(language);
    const script = buildVideoScript(source, language);
    const storyboard = buildStoryboard(script, manifest);
    scripts.push(script);
    storyboards.push(storyboard);

    const scriptPath = path.join(out, 'scripts', `${profile.subtitleFileSuffix}.script.json`);
    const storyboardPath = path.join(out, 'storyboards', `${profile.subtitleFileSuffix}.storyboard.json`);
    const narrationTextPath = path.join(out, 'narration', `${profile.subtitleFileSuffix}.txt`);
    const narrationAudioPath = path.join(out, 'narration', `${profile.subtitleFileSuffix}.wav`);
    const vttPath = path.join(out, 'subtitles', `${profile.subtitleFileSuffix}.vtt`);
    const srtPath = path.join(out, 'subtitles', `${profile.subtitleFileSuffix}.srt`);
    const mp4Target = path.join(out, 'renders', `${source.poiId}-${profile.subtitleFileSuffix}.mp4`);

    writeJson(scriptPath, script);
    writeJson(storyboardPath, storyboard);
    writeText(narrationTextPath, script.scenes.map((scene) => scene.narration).join('\n'));
    writeText(vttPath, buildWebVtt(script));
    writeText(srtPath, buildSrt(script));
    writeSilentWav(narrationAudioPath, script.duration);

    const rendered = tryRenderMp4({
      ffmpegCommand,
      posterPath,
      audioPath: narrationAudioPath,
      outputPath: mp4Target,
      durationSeconds: script.duration,
    });

    languageOutputs.push({
      language,
      narrationTextPath: toRepoRelative(root, narrationTextPath),
      narrationAudioPath: toRepoRelative(root, narrationAudioPath),
      vttPath: toRepoRelative(root, vttPath),
      srtPath: toRepoRelative(root, srtPath),
      mp4Path: rendered ? toRepoRelative(root, rendered) : null,
      renderStatus: rendered ? 'rendered' : ffmpegAvailable ? 'render_failed' : 'blocked_by_missing_ffmpeg',
    });
  }

  const appCard = buildAppVideoCardPayload({
    source,
    version: options.version,
    posterPath: toRepoRelative(root, posterPath),
    languageOutputs,
  });
  const facebookPayload = buildFacebookPublicationPayload({
    source,
    manifest,
    version: options.version,
    posterPath: toRepoRelative(root, posterPath),
    videoPath: languageOutputs.find((output) => output.language === 'en')?.mp4Path ?? null,
  });
  const qc = buildQcReport({
    source,
    manifest,
    scripts,
    languageOutputs,
    ffmpegAvailable,
    ffprobeAvailable,
    version: options.version,
  });

  writeJson(path.join(out, 'app-video-card.json'), appCard);
  writeJson(path.join(out, 'publication', 'facebook.dry-run.json'), facebookPayload);
  writeJson(path.join(out, 'qc-report.json'), qc);
  writeJson(path.join(out, 'run-summary.json'), {
    poiId: source.poiId,
    tourSlug: source.tourSlug,
    outputDir: toRepoRelative(root, out),
    dryRun: options.dryRun,
    targetLanguages: options.languages,
    ffmpegAvailable,
    ffprobeAvailable,
    generated: {
      manifest: toRepoRelative(root, path.join(out, 'asset-manifest.json')),
      poster: toRepoRelative(root, posterPath),
      appVideoCard: toRepoRelative(root, path.join(out, 'app-video-card.json')),
      facebookPayload: toRepoRelative(root, path.join(out, 'publication', 'facebook.dry-run.json')),
      qcReport: toRepoRelative(root, path.join(out, 'qc-report.json')),
      languageOutputs,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: qc.status !== 'failed',
        poiId: source.poiId,
        outputDir: toRepoRelative(root, out),
        targetLanguages: options.languages,
        ffmpegAvailable,
        ffprobeAvailable,
        qcStatus: qc.status,
      },
      null,
      2,
    ),
  );
  if (qc.status === 'failed') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
