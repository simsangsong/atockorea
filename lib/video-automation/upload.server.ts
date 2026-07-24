/**
 * Publish a produced run into the review queue (video W3, plan §14.3).
 *
 * Extracted from scripts/upload-poi-video.ts so the batch runner can file a
 * short the same way the single-POI CLI does — one uploader, one gate.
 *
 * Gate (VP-D10): QC `failed` never uploads; QC `warning` needs an explicit
 * human `--allow-warnings` (silent narration and unreviewed image licences are
 * warnings a person decides on). Rows land as **pending_review** and nothing
 * serves until an admin approves them in /admin/poi-videos.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const TOUR_VIDEOS_BUCKET = process.env.SUPABASE_TOUR_VIDEOS_BUCKET || 'tour-videos';

export interface QcFile {
  poiId: string;
  version: number;
  status: 'passed' | 'warning' | 'failed';
  checks: Array<{ name: string; status: string; detail: string }>;
}

export interface RunSummaryFile {
  poiId: string;
  poster: string | null;
  languages: Array<{ language: string; renderPath: string | null; totalSeconds: number }>;
}

export interface UploadDbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
  storage: {
    listBuckets(): Promise<{ data: Array<{ name: string }> | null }>;
    createBucket(name: string, options: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    from(bucket: string): {
      upload(
        objectPath: string,
        body: Buffer,
        options: Record<string, unknown>,
      ): Promise<{ error: { message: string } | null }>;
      getPublicUrl(objectPath: string): { data: { publicUrl: string } };
    };
  };
}

export class QcGateError extends Error {}

/** Newest prod-v* run directory for a POI (by mtime). */
export function latestRunDir(root: string, poi: string): string {
  const base = path.join(root, '.tmp', 'video-automation', poi);
  if (!existsSync(base)) throw new Error(`No runs found under ${base} — run video:produce first.`);
  const runs = readdirSync(base)
    .filter((name) => name.startsWith('prod-v'))
    .map((name) => path.join(base, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (runs.length === 0) throw new Error(`No prod-v* runs under ${base} — run video:produce first.`);
  return runs[0];
}

/** Reads a completed run's two manifests. Throws when the run is incomplete. */
export function readRunManifests(runDir: string): { qc: QcFile; summary: RunSummaryFile } {
  const qcPath = path.join(runDir, 'qc-production.json');
  const summaryPath = path.join(runDir, 'run-summary.json');
  if (!existsSync(qcPath) || !existsSync(summaryPath)) {
    throw new Error(`${runDir} is not a completed production run (missing qc-production.json / run-summary.json).`);
  }
  return {
    qc: JSON.parse(readFileSync(qcPath, 'utf8')) as QcFile,
    summary: JSON.parse(readFileSync(summaryPath, 'utf8')) as RunSummaryFile,
  };
}

/** The publication gate, pure so it is testable without storage. */
export function assertQcAllowsUpload(qc: QcFile, allowWarnings: boolean): void {
  if (qc.status === 'failed') {
    const failures = qc.checks.filter((check) => check.status === 'failed');
    throw new QcGateError(
      `QC failed — not uploading.\n${failures.map((c) => `  ✗ ${c.name}: ${c.detail}`).join('\n')}`,
    );
  }
  if (qc.status === 'warning' && !allowWarnings) {
    const warnings = qc.checks.filter((check) => check.status === 'warning');
    throw new QcGateError(
      `QC has warnings — re-run with --allow-warnings to upload anyway.\n${warnings
        .map((c) => `  ⚠ ${c.name}: ${c.detail}`)
        .join('\n')}`,
    );
  }
}

export interface UploadOptions {
  root: string;
  runDir: string;
  allowWarnings: boolean;
  log?: (line: string) => void;
}

export interface UploadResult {
  poiKey: string;
  version: number;
  posterUrl: string | null;
  uploaded: Array<{ language: string; url: string }>;
  skipped: string[];
}

export async function uploadProducedRun(
  supabase: UploadDbClient,
  options: UploadOptions,
): Promise<UploadResult> {
  const log = options.log ?? (() => {});
  const { qc, summary } = readRunManifests(options.runDir);
  assertQcAllowsUpload(qc, options.allowWarnings);
  const poiKey = qc.poiId;

  // Public bucket (same pattern as tour-room-photos): these are marketing
  // shorts, not private data.
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((bucket) => bucket.name === TOUR_VIDEOS_BUCKET)) {
    const { error } = await supabase.storage.createBucket(TOUR_VIDEOS_BUCKET, {
      public: true,
      fileSizeLimit: 200 * 1024 * 1024,
    });
    if (error) throw new Error(`Failed to create bucket ${TOUR_VIDEOS_BUCKET}: ${error.message}`);
  }

  // Poster first — shared across languages.
  let posterUrl: string | null = null;
  if (summary.poster) {
    const posterFile = path.resolve(options.root, summary.poster);
    if (existsSync(posterFile)) {
      const bytes = readFileSync(posterFile);
      const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 8);
      const posterPath = `poi/${poiKey}/v${qc.version}/poster-${hash}.png`;
      const { error } = await supabase.storage.from(TOUR_VIDEOS_BUCKET).upload(posterPath, bytes, {
        contentType: 'image/png',
        upsert: true,
      });
      if (error) throw new Error(`Poster upload failed: ${error.message}`);
      posterUrl = supabase.storage.from(TOUR_VIDEOS_BUCKET).getPublicUrl(posterPath).data.publicUrl;
    }
  }

  const uploaded: UploadResult['uploaded'] = [];
  const skipped: string[] = [];
  for (const lang of summary.languages) {
    if (!lang.renderPath) {
      skipped.push(lang.language);
      log(`⚠ ${lang.language}: no render, skipped.`);
      continue;
    }
    const file = path.resolve(options.root, lang.renderPath);
    if (!existsSync(file)) throw new Error(`Render missing on disk: ${file}`);
    const bytes = readFileSync(file);
    const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 8);
    const storagePath = `poi/${poiKey}/v${qc.version}/${lang.language}-${hash}.mp4`;
    const { error: uploadError } = await supabase.storage.from(TOUR_VIDEOS_BUCKET).upload(storagePath, bytes, {
      contentType: 'video/mp4',
      upsert: true,
    });
    if (uploadError) throw new Error(`${lang.language} upload failed: ${uploadError.message}`);
    const url = supabase.storage.from(TOUR_VIDEOS_BUCKET).getPublicUrl(storagePath).data.publicUrl;

    const { error: upsertError } = await supabase.from('poi_videos').upsert(
      {
        poi_key: poiKey,
        language: lang.language,
        version: qc.version,
        kind: 'poi',
        video_url: url,
        poster_url: posterUrl,
        duration_seconds: lang.totalSeconds,
        status: 'pending_review', // VP-D10 — only an admin approval serves it
        qc: { status: qc.status, checks: qc.checks },
      },
      { onConflict: 'poi_key,language,version' },
    );
    if (upsertError) throw new Error(`${lang.language} row upsert failed: ${upsertError.message}`);
    uploaded.push({ language: lang.language, url });
    log(`✓ ${lang.language} → ${url}`);
  }

  if (uploaded.length === 0) throw new Error('No renders uploaded — nothing to review.');
  return { poiKey, version: qc.version, posterUrl, uploaded, skipped };
}
