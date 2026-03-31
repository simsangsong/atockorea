/**
 * Runnable entrypoint: Jeju top-200 POI photo gallery backfill (Step 6).
 * Default: dry-run (no DB writes). Requires explicit `--write` to persist.
 *
 * Env: TOUR_API_SERVICE_KEY or TOUR_API_KEY; NEXT_PUBLIC_SUPABASE_URL;
 *      read: NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY;
 *      write (--write): SUPABASE_SERVICE_ROLE_KEY.
 *
 * See parseJejuPhotoTargetSetConfig() for JEJU_PHOTO_GALLERY_* env keys.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  formatJejuPhotoDryRunSummaryText,
  parseJejuPhotoTargetSetConfig,
  runJejuPhotoGalleryBackfillExecutor,
} from '@/lib/jeju-photo-gallery';

const TOP_N_CAP = 200;

function loadEnvFiles(): void {
  for (const name of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      const cur = process.env[key];
      if (cur === undefined || String(cur).trim() === '') process.env[key] = val;
    }
  }
}

function getNumArg(argv: string[], name: string): number | undefined {
  const pref = `--${name}=`;
  const hit = argv.find((a) => a.startsWith(pref));
  if (hit) {
    const n = parseInt(hit.slice(pref.length), 10);
    return Number.isFinite(n) ? n : undefined;
  }
  const j = argv.indexOf(`--${name}`);
  if (j >= 0 && argv[j + 1] && !argv[j + 1].startsWith('--')) {
    const n = parseInt(argv[j + 1], 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function createSupabaseForScript(mode: 'read' | 'write'): SupabaseClient<any, any, any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  if (mode === 'write') {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!key) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (required for --write).');
    }
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const key = sr || anon;
  if (!key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY (needed to read jeju_kor_tourapi_places).');
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function buildTargetConfig(argv: string[]): ReturnType<typeof parseJejuPhotoTargetSetConfig> {
  const base = parseJejuPhotoTargetSetConfig();
  const targetPhotoCount = getNumArg(argv, 'target-photo-count');
  const cfg: typeof base = {
    ...base,
    topN: Math.min(TOP_N_CAP, base.topN),
    targetPhotoCount: targetPhotoCount !== undefined ? Math.max(1, Math.floor(targetPhotoCount)) : base.targetPhotoCount,
  };
  if (argv.includes('--force-refresh')) {
    cfg.forceRefresh = true;
  }
  return cfg;
}

async function main(): Promise<void> {
  loadEnvFiles();
  const argv = process.argv.slice(2);

  const hasWrite = argv.includes('--write');
  const hasDryRun = argv.includes('--dry-run');
  const dryRun = hasDryRun || !hasWrite;
  const applyWrites = hasWrite && !hasDryRun;

  const limitPois = getNumArg(argv, 'limit-pois');
  const maxRequests = getNumArg(argv, 'max-requests');

  const targetSetConfig = buildTargetConfig(argv);

  const supabase = createSupabaseForScript(applyWrites ? 'write' : 'read');

  const result = await runJejuPhotoGalleryBackfillExecutor(supabase, {
    targetSetConfig,
    maxPoisToProcess: limitPois,
    maxRequests,
    dryRun,
    applyWrites,
  });

  if (!result.ok) {
    console.error(`[fatal] ${result.fatalError ?? 'unknown error'}`);
    process.exitCode = 1;
    return;
  }

  const a = result.aggregate;

  if (applyWrites && !dryRun) {
    for (const p of result.poiLogs) {
      if (p.lookupPath === 'skipped_complete') continue;
      const line = [
        `[write] rank=${p.rank}`,
        `id=${p.poiId}`,
        `content_id=${p.contentId}`,
        `"${p.title ?? ''}"`,
        `currentPhotoCount=${p.currentPhotoCount}`,
        `selectedNewCount=${p.selectedNewCount}`,
        `finalMergedCount=${p.finalMergedCount}`,
        `action=${p.writeDbAction ?? 'n/a'}`,
        `reason=${p.writeDbReason ?? ''}`,
      ].join(' | ');
      console.log(line);
    }
  }

  console.log('');
  console.log('=== Jeju photo gallery backfill — final summary ===');
  console.log(`total target POIs: ${a.totalTargetPois}`);
  console.log(`already complete: ${a.alreadyComplete}`);
  console.log(`attempted: ${a.attempted}`);
  console.log(`changed and written: ${a.rowsWritten}`);
  console.log(`no-op skipped (DB): ${a.rowsSkippedNoop}`);
  console.log(`write failed: ${a.rowsWriteFailed}`);
  console.log(`no match: ${a.noMatch}`);
  console.log(`low confidence rejected: ${a.lowConfidenceRejected}`);
  console.log(`still incomplete after run: ${a.stillIncompleteAfter}`);
  console.log(`total requests consumed: ${a.totalRequestsConsumed}`);
  if (a.stoppedEarlyReason) {
    console.log(`stopped early: ${a.stoppedEarlyReason}`);
  }
  console.log(`dryRun=${result.dryRun} applyWrites=${applyWrites}`);
  console.log('');
  console.log(formatJejuPhotoDryRunSummaryText(result));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
