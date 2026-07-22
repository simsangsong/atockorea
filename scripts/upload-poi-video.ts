import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/**
 * W3 — publish a produced POI video run to Supabase Storage + the review queue.
 *
 *   npm run video:upload -- --poi=<poi_key> [--dir=<prod dir>] [--allow-warnings]
 *
 * Reads the newest `prod-v*` run under .tmp/video-automation/<poi>/ (or --dir),
 * refuses failed QC always and warning QC unless --allow-warnings (silent
 * narration and unreviewed image licenses are warnings — VP-D6/VP-D10 say a
 * human decides), uploads the per-language MP4s + poster to the public
 * `tour-videos` bucket, and upserts `poi_videos` rows as **pending_review**.
 * Nothing serves until an admin approves it in /admin/poi-videos.
 */

interface QcFile {
  poiId: string;
  version: number;
  status: 'passed' | 'warning' | 'failed';
  checks: Array<{ name: string; status: string; detail: string }>;
}

interface RunSummary {
  poiId: string;
  poster: string | null;
  languages: Array<{ language: string; renderPath: string | null; totalSeconds: number }>;
}

const BUCKET = process.env.SUPABASE_TOUR_VIDEOS_BUCKET || 'tour-videos';

function parseArgs(argv: string[]): { poi: string; dir?: string; allowWarnings: boolean } {
  let poi = '';
  let dir: string | undefined;
  let allowWarnings = false;
  for (const arg of argv) {
    if (arg.startsWith('--poi=')) poi = arg.slice('--poi='.length).trim();
    else if (arg.startsWith('--dir=')) dir = arg.slice('--dir='.length).trim();
    else if (arg === '--allow-warnings') allowWarnings = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!poi && !dir) {
    throw new Error('Usage: npm run video:upload -- --poi=<poi_key> [--dir=<prod dir>] [--allow-warnings]');
  }
  return { poi, dir, allowWarnings };
}

/** Newest prod-v* run directory for a POI (by mtime). */
function latestRunDir(root: string, poi: string): string {
  const base = path.join(root, '.tmp', 'video-automation', poi);
  if (!existsSync(base)) throw new Error(`No runs found under ${base} — run video:produce first.`);
  const runs = readdirSync(base)
    .filter((name) => name.startsWith('prod-v'))
    .map((name) => path.join(base, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (runs.length === 0) throw new Error(`No prod-v* runs under ${base} — run video:produce first.`);
  return runs[0];
}

async function main(): Promise<void> {
  const root = process.cwd();
  const options = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local).');
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const runDir = options.dir ? path.resolve(root, options.dir) : latestRunDir(root, options.poi);
  const qcPath = path.join(runDir, 'qc-production.json');
  const summaryPath = path.join(runDir, 'run-summary.json');
  if (!existsSync(qcPath) || !existsSync(summaryPath)) {
    throw new Error(`${runDir} is not a completed production run (missing qc-production.json / run-summary.json).`);
  }
  const qc = JSON.parse(readFileSync(qcPath, 'utf8')) as QcFile;
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8')) as RunSummary;
  const poiKey = qc.poiId;

  // Publication gate: failed never uploads; warnings need an explicit human OK.
  if (qc.status === 'failed') {
    const failures = qc.checks.filter((check) => check.status === 'failed');
    throw new Error(`QC failed — not uploading.\n${failures.map((c) => `  ✗ ${c.name}: ${c.detail}`).join('\n')}`);
  }
  if (qc.status === 'warning' && !options.allowWarnings) {
    const warnings = qc.checks.filter((check) => check.status === 'warning');
    throw new Error(
      `QC has warnings — re-run with --allow-warnings to upload anyway.\n${warnings
        .map((c) => `  ⚠ ${c.name}: ${c.detail}`)
        .join('\n')}`,
    );
  }

  // Public bucket (same pattern as tour-room-photos): the unguessable-ish path
  // is fine here — these are marketing shorts, not private data.
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((bucket) => bucket.name === BUCKET)) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 200 * 1024 * 1024,
    });
    if (error) throw new Error(`Failed to create bucket ${BUCKET}: ${error.message}`);
  }

  // Poster first — shared across languages.
  let posterUrl: string | null = null;
  if (summary.poster) {
    const posterFile = path.resolve(root, summary.poster);
    if (existsSync(posterFile)) {
      const bytes = readFileSync(posterFile);
      const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 8);
      const posterPath = `poi/${poiKey}/v${qc.version}/poster-${hash}.png`;
      const { error } = await supabase.storage.from(BUCKET).upload(posterPath, bytes, {
        contentType: 'image/png',
        upsert: true,
      });
      if (error) throw new Error(`Poster upload failed: ${error.message}`);
      posterUrl = supabase.storage.from(BUCKET).getPublicUrl(posterPath).data.publicUrl;
    }
  }

  const results: Array<{ language: string; url: string }> = [];
  for (const lang of summary.languages) {
    if (!lang.renderPath) {
      console.warn(`⚠ ${lang.language}: no render, skipped.`);
      continue;
    }
    const file = path.resolve(root, lang.renderPath);
    if (!existsSync(file)) throw new Error(`Render missing on disk: ${file}`);
    const bytes = readFileSync(file);
    const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 8);
    const storagePath = `poi/${poiKey}/v${qc.version}/${lang.language}-${hash}.mp4`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: 'video/mp4',
      upsert: true,
    });
    if (uploadError) throw new Error(`${lang.language} upload failed: ${uploadError.message}`);
    const url = supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;

    const { error: upsertError } = await supabase.from('poi_videos').upsert(
      {
        poi_key: poiKey,
        language: lang.language,
        version: qc.version,
        video_url: url,
        poster_url: posterUrl,
        duration_seconds: lang.totalSeconds,
        status: 'pending_review', // VP-D10 — only an admin approval serves it
        qc: { status: qc.status, checks: qc.checks },
      },
      { onConflict: 'poi_key,language,version' },
    );
    if (upsertError) throw new Error(`${lang.language} row upsert failed: ${upsertError.message}`);
    results.push({ language: lang.language, url });
    console.log(`✓ ${lang.language} → ${url}`);
  }

  if (results.length === 0) throw new Error('No renders uploaded — nothing to review.');
  console.log(
    `\nDone: ${results.length} language(s) uploaded as pending_review (v${qc.version}).` +
      '\nNext: approve them in /admin/poi-videos — nothing serves until then.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
