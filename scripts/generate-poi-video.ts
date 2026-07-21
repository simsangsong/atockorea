import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
import { buildSrt, buildWebVtt } from '@/lib/video-automation/subtitles';
import type {
  LanguageOutputPaths,
  VideoLocalizedPoiContent,
  VideoPoiSource,
} from '@/lib/video-automation/types';

interface CliOptions {
  poi: string;
  tour?: string;
  outDir?: string;
  version: number;
  languages: VideoLanguageCode[];
  dryRun: boolean;
}

interface StaticStopMatch {
  tourSlug: string;
  sourcePath: string;
  locale: string;
  stop: Record<string, unknown>;
  poiKey: string;
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

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

function slugLike(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function relative(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function stopPoiKey(stop: Record<string, unknown>): string | null {
  const meta = stop._poi_meta;
  if (meta && typeof meta === 'object') {
    const key = (meta as Record<string, unknown>).poi_key;
    if (typeof key === 'string' && key.trim()) return key.trim();
  }
  return null;
}

function stopMatches(stop: Record<string, unknown>, requestedPoi: string): boolean {
  const key = stopPoiKey(stop);
  if (key === requestedPoi) return true;
  const requestedSlug = slugLike(requestedPoi);
  if (key && slugLike(key).includes(requestedSlug)) return true;
  const name = cleanText(stop.name);
  return Boolean(name && slugLike(name).includes(requestedSlug));
}

function findStopInPayload(payload: Record<string, unknown>, requestedPoi: string): Record<string, unknown> | null {
  const stops = Array.isArray(payload.itineraryStops) ? payload.itineraryStops : [];
  for (const stop of stops) {
    if (stop && typeof stop === 'object' && stopMatches(stop as Record<string, unknown>, requestedPoi)) {
      return stop as Record<string, unknown>;
    }
  }
  return null;
}

function findStaticStop(root: string, requestedPoi: string, tourSlug?: string): StaticStopMatch | null {
  const base = path.join(root, 'components', 'product-tour-static');
  if (!existsSync(base)) return null;
  const tourDirs = readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && entry.name !== 'catalog')
    .map((entry) => entry.name)
    .filter((name) => !tourSlug || name === tourSlug);

  for (const slug of tourDirs) {
    const sourcePath = path.join(base, slug, `${slug}.en.json`);
    if (!existsSync(sourcePath)) continue;
    const payload = readJson(sourcePath);
    const stop = findStopInPayload(payload, requestedPoi);
    if (!stop) continue;
    return {
      tourSlug: slug,
      sourcePath,
      locale: 'en',
      stop,
      poiKey: stopPoiKey(stop) ?? requestedPoi,
    };
  }
  return null;
}

function localizedStop(root: string, match: StaticStopMatch, sourceLocale: string): { stop: Record<string, unknown>; sourcePath: string; locale: string } | null {
  const filePath = path.join(root, 'components', 'product-tour-static', match.tourSlug, `${match.tourSlug}.${sourceLocale}.json`);
  if (!existsSync(filePath)) return null;
  const payload = readJson(filePath);
  const stop = findStopInPayload(payload, match.poiKey);
  if (!stop) return null;
  return { stop, sourcePath: filePath, locale: sourceLocale };
}

function objectStrings(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const text = cleanText(raw);
    if (text) out[key] = text;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function factIdsFor(root: string, sourcePath: string, stop: Record<string, unknown>): string[] {
  const rel = relative(root, sourcePath);
  const meta = stop._poi_meta && typeof stop._poi_meta === 'object' ? (stop._poi_meta as Record<string, unknown>) : {};
  const sources = Array.isArray(meta.sources) ? meta.sources : [];
  return [
    `file:${rel}`,
    ...sources
      .filter((source): source is string => typeof source === 'string' && source.trim() !== '')
      .slice(0, 6)
      .map((source, index) => `source:${index + 1}:${source}`),
  ];
}

function contentFromStop(
  root: string,
  language: VideoLanguageCode,
  sourceLocale: string,
  sourcePath: string,
  stop: Record<string, unknown>,
): VideoLocalizedPoiContent {
  const highlights = Array.isArray(stop.highlights)
    ? stop.highlights.map(cleanText).filter(Boolean).slice(0, 8)
    : [];
  return {
    language,
    sourceLocale,
    name: cleanText(stop.name) || cleanText(stop.title) || 'Unknown POI',
    category: cleanText(stop.category),
    description: cleanText(stop.description || stop.whyOnRoute),
    image: cleanText(stop.image),
    highlights,
    visitBasics: objectStrings(stop.visitBasics),
    convenience: objectStrings(stop.convenience),
    smartNotes: objectStrings(stop.smartNotes),
    sourceFactIds: factIdsFor(root, sourcePath, stop),
    sourcePath: relative(root, sourcePath),
  };
}

function sourceFromStaticStop(root: string, match: StaticStopMatch, languages: VideoLanguageCode[]): VideoPoiSource {
  const localized: VideoPoiSource['localized'] = {};
  const sourcePaths = new Set<string>([relative(root, match.sourcePath)]);

  for (const language of languages) {
    const profile = videoLanguageProfile(language);
    const found = localizedStop(root, match, profile.sourceLocale);
    const stop = found?.stop ?? match.stop;
    const sourcePath = found?.sourcePath ?? match.sourcePath;
    sourcePaths.add(relative(root, sourcePath));
    localized[language] = contentFromStop(root, language, found?.locale ?? match.locale, sourcePath, stop);
  }

  const canonicalName = localized.en?.name ?? Object.values(localized)[0]?.name ?? match.poiKey;
  return {
    poiId: match.poiKey,
    canonicalName,
    tourSlug: match.tourSlug,
    localized,
    sourcePaths: [...sourcePaths],
  };
}

function sourceFromPoiKb(root: string, poi: string, languages: VideoLanguageCode[]): VideoPoiSource | null {
  const filePath = path.join(root, 'data', 'poi_kb', 'poi_knowledge_base_v1.29.json');
  if (!existsSync(filePath)) return null;
  const kb = readJson(filePath);
  const entry = kb[poi];
  if (!entry || typeof entry !== 'object') return null;
  const row = entry as Record<string, unknown>;
  const smartNotes = objectStrings(row.smartNotes);
  const visitBasics = objectStrings(row.visitBasics);
  const convenience = objectStrings(row.convenience);
  const fallbackName = poi.split('_').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
  const localized: VideoPoiSource['localized'] = {};
  for (const language of languages) {
    localized[language] = {
      language,
      sourceLocale: 'en',
      name: fallbackName,
      description: [smartNotes?.photo, smartNotes?.tip].filter(Boolean).join(' '),
      highlights: [smartNotes?.photo, smartNotes?.facilities, smartNotes?.tip].filter(Boolean) as string[],
      visitBasics,
      convenience,
      smartNotes,
      sourceFactIds: [`file:${relative(root, filePath)}`, `poi_kb:${poi}`],
      sourcePath: relative(root, filePath),
    };
  }
  return {
    poiId: poi,
    canonicalName: fallbackName,
    localized,
    sourcePaths: [relative(root, filePath)],
  };
}

function resolvePoiSource(root: string, options: CliOptions): VideoPoiSource {
  const match = findStaticStop(root, options.poi, options.tour);
  if (match) return sourceFromStaticStop(root, match, options.languages);
  const kb = sourceFromPoiKb(root, options.poi, options.languages);
  if (kb) return kb;
  throw new Error(`POI not found in static tour JSON or poi_kb: ${options.poi}`);
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
  const source = resolvePoiSource(root, options);
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
      narrationTextPath: relative(root, narrationTextPath),
      narrationAudioPath: relative(root, narrationAudioPath),
      vttPath: relative(root, vttPath),
      srtPath: relative(root, srtPath),
      mp4Path: rendered ? relative(root, rendered) : null,
      renderStatus: rendered ? 'rendered' : ffmpegAvailable ? 'render_failed' : 'blocked_by_missing_ffmpeg',
    });
  }

  const appCard = buildAppVideoCardPayload({
    source,
    version: options.version,
    posterPath: relative(root, posterPath),
    languageOutputs,
  });
  const facebookPayload = buildFacebookPublicationPayload({
    source,
    manifest,
    version: options.version,
    posterPath: relative(root, posterPath),
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
    outputDir: relative(root, out),
    dryRun: options.dryRun,
    targetLanguages: options.languages,
    ffmpegAvailable,
    ffprobeAvailable,
    generated: {
      manifest: relative(root, path.join(out, 'asset-manifest.json')),
      poster: relative(root, posterPath),
      appVideoCard: relative(root, path.join(out, 'app-video-card.json')),
      facebookPayload: relative(root, path.join(out, 'publication', 'facebook.dry-run.json')),
      qcReport: relative(root, path.join(out, 'qc-report.json')),
      languageOutputs,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: qc.status !== 'failed',
        poiId: source.poiId,
        outputDir: relative(root, out),
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
