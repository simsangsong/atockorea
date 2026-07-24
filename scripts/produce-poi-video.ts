#!/usr/bin/env node
/**
 * Produce one POI intro short (plan §C W1, §14.3).
 *
 *   npm run video:produce -- --poi=jagalchi_market
 *   npm run video:produce -- --poi=jagalchi_market --tts=openai --script=llm
 *
 * Thin CLI. The pipeline itself lives in lib/video-automation/produce/run.server.ts
 * so the batch runner (`npm run video:batch`) executes the identical producer.
 *
 * 🔴 Requires real ffmpeg + ffprobe. Nothing is published: the run lands under
 * .tmp/video-automation/, `npm run video:upload` files it as pending_review,
 * and only an approval in /admin/poi-videos ever serves it (VP-D10).
 */

import {
  DEFAULT_VIDEO_LANGUAGE_CODES,
  normalizeVideoLanguageCode,
  type VideoLanguageCode,
} from '@/lib/video-automation/languages';
import { producePoiVideo, type ScriptMode } from '@/lib/video-automation/produce/run.server';
import type { TtsMode } from '@/lib/video-automation/produce/tts';

interface CliOptions {
  poi: string;
  tour?: string;
  outDir?: string;
  version: number;
  languages: VideoLanguageCode[];
  tts: TtsMode;
  script: ScriptMode;
  burnSubtitles: boolean;
  filesOnly: boolean;
}

function usage(): never {
  throw new Error(
    [
      'Usage: npm run video:produce -- --poi=<poi_key> [--tour=<tour_slug>] [--languages=en,zh-Hant,ja,es]',
      '                              [--tts=openai|silent] [--script=template|llm] [--no-burn-subs] [--files-only]',
      'Example: npm run video:produce -- --poi=jagalchi_market --tts=openai --script=llm',
    ].join('\n'),
  );
}

function parseArgs(argv: string[]): CliOptions {
  const opts: Partial<CliOptions> = {
    version: 1,
    languages: [...DEFAULT_VIDEO_LANGUAGE_CODES],
    tts: 'silent',
    script: 'template',
    burnSubtitles: true,
    filesOnly: false,
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
    } else if (arg.startsWith('--script=')) {
      const mode = arg.slice('--script='.length).trim();
      if (mode !== 'template' && mode !== 'llm') usage();
      opts.script = mode;
    } else if (arg === '--no-burn-subs') {
      opts.burnSubtitles = false;
    } else if (arg === '--files-only') {
      opts.filesOnly = true;
    } else {
      usage();
    }
  }
  if (!opts.poi) usage();
  return opts as CliOptions;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  // The DB legs (match_pois / generated_spot_content) are optional: without
  // service-role env the file sources alone still make a complete run.
  let supabase = null;
  if (!options.filesOnly && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createServerClient } = await import('@/lib/supabase');
    supabase = createServerClient();
  }

  const result = await producePoiVideo({
    root: process.cwd(),
    poi: options.poi,
    tour: options.tour,
    outDir: options.outDir,
    version: options.version,
    languages: options.languages,
    tts: options.tts,
    script: options.script,
    burnSubtitles: options.burnSubtitles,
    supabase,
  });

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        poiId: result.poiId,
        outputDir: result.outputDir,
        tts: options.tts,
        script: options.script,
        qcStatus: result.qcStatus,
        renders: result.languages.map((language) => language.renderPath),
        poster: result.poster,
      },
      null,
      2,
    ),
  );
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
