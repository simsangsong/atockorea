#!/usr/bin/env node
/**
 * Batch-produce POI intro shorts (plan §14.3, §D W5).
 *
 *   npm run video:batch                                  # DRY RUN — plan only
 *   npm run video:batch -- --apply --limit=3
 *   npm run video:batch -- --apply --tts=openai --script=llm --upload
 *   npm run video:batch -- --apply --poi=jagalchi_market,gyeongbokgung
 *
 * 🔴 It calls the SAME producer and the SAME uploader as the single-POI CLIs
 * (lib/video-automation/produce/run.server.ts, upload.server.ts). A second
 * render path would drift from the one whose output the review queue approves.
 *
 * Resumable by construction: a POI with a completed run directory, or with a
 * `poi_videos` row at the target version, is skipped. Re-running after an
 * interrupt picks up where it stopped; `--force` re-produces anyway.
 *
 * Nothing is published. `--upload` files renders as **pending_review**; only an
 * admin approval in /admin/poi-videos ever serves one (VP-D10).
 *
 * Flags: --dry (default) · --apply · --limit=N · --poi=<key,...> · --region=jeju
 *        --languages=en,zh-Hant,ja,es · --tts=openai|silent · --script=template|llm
 *        --version=N · --upload · --allow-warnings · --budget=USD · --force
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { createServerClient } from '@/lib/supabase';
import {
  BATCH_DELAY_MS,
  estimateBatchCostUsd,
  parseBatchArgs,
  planBatch,
  resolveBatchLimit,
  shouldAbortForBudget,
  type BatchCandidate,
  type BatchTarget,
} from '@/lib/video-automation/batch';
import {
  MATCH_POI_VIDEO_COLUMNS,
  localizedFromMatchPoi,
  type MatchPoiVideoRow,
} from '@/lib/video-automation/poiDbSource';
import { planSceneImages } from '@/lib/video-automation/produce/ingest';
import { producePoiVideo } from '@/lib/video-automation/produce/run.server';
import { uploadProducedRun, type UploadDbClient } from '@/lib/video-automation/upload.server';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RunTotals {
  produced: number;
  uploaded: number;
  failed: number;
  ttsChars: number;
}

/** Existing non-failed run directories, keyed by POI — the resume ledger. */
function scanProducedRuns(root: string): Record<string, string> {
  const base = path.join(root, '.tmp', 'video-automation');
  if (!existsSync(base)) return {};
  const out: Record<string, string> = {};
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'tts-cache') continue;
    const poiDir = path.join(base, entry.name);
    const runs = readdirSync(poiDir)
      .filter((name) => name.startsWith('prod-v'))
      .map((name) => path.join(poiDir, name))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    for (const runDir of runs) {
      const summaryPath = path.join(runDir, 'run-summary.json');
      if (!existsSync(summaryPath)) continue;
      try {
        const summary = JSON.parse(readFileSync(summaryPath, 'utf8')) as { qcStatus?: string };
        if (summary.qcStatus === 'failed') continue;
        out[entry.name] = runDir;
        break;
      } catch {
        // unreadable manifest = not a completed run
      }
    }
  }
  return out;
}

function fileExistsUnderPublic(root: string): (uri: string) => boolean {
  return (uri: string) => existsSync(path.join(root, 'public', uri.replace(/^\//, '')));
}

function labelFor(row: MatchPoiVideoRow): string {
  return (row.name_en || row.name_ko || row.poi_key || '').trim() || row.poi_key;
}

function visitCountsFrom(rows: Array<{ poi_key?: unknown }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (typeof row?.poi_key === 'string' && row.poi_key) {
      counts[row.poi_key] = (counts[row.poi_key] ?? 0) + 1;
    }
  }
  return counts;
}

function describeSkip(target: BatchTarget): string {
  if (target.skip === 'no-images') return 'no local imagery — nothing to render from';
  if (target.skip === 'uploaded') return 'already in the review queue at this version';
  if (target.skip === 'produced') return `already produced (${target.existingRunDir})`;
  return 'skipped';
}

async function main(): Promise<void> {
  const root = process.cwd();
  const options = parseBatchArgs(process.argv.slice(2));
  const limit = resolveBatchLimit(options);
  const supabase = createServerClient();

  // --- 1. Catalogue ---------------------------------------------------------
  let query = supabase.from('match_pois').select(MATCH_POI_VIDEO_COLUMNS).order('poi_key');
  if (options.poiKeys.length > 0) query = query.in('poi_key', options.poiKeys);
  else if (options.region) query = query.eq('region', options.region);
  const { data: poiRows, error: poiError } = await query;
  if (poiError) throw poiError;

  const { data: stopRows } = await supabase.from('match_itinerary_stops').select('poi_key');
  const visits = visitCountsFrom((stopRows ?? []) as Array<{ poi_key?: unknown }>);

  const exists = fileExistsUnderPublic(root);
  const rows = (poiRows ?? []) as MatchPoiVideoRow[];
  const candidates: BatchCandidate[] = rows
    .filter((row) => typeof row.poi_key === 'string' && !row.poi_key.startsWith('OPS_'))
    .map((row) => {
      // Same ingest gate the producer uses (-ai excluded, missing files dropped).
      const content = localizedFromMatchPoi(row, 'en');
      const pool = content ? planSceneImages(content, 6, exists).pool.length : 0;
      return {
        poiKey: row.poi_key,
        label: labelFor(row),
        region: row.region ?? null,
        imageCount: pool,
        visits: visits[row.poi_key] ?? 0,
      };
    });

  // Explicitly named POIs with no match_pois row still get a shot: the file
  // sources (static tour JSON / poi_kb) may know them.
  const known = new Set(candidates.map((candidate) => candidate.poiKey));
  for (const poiKey of options.poiKeys) {
    if (!known.has(poiKey)) {
      candidates.push({ poiKey, label: poiKey, region: null, imageCount: null, visits: visits[poiKey] ?? 0 });
    }
  }

  if (candidates.length === 0) {
    console.log('No POIs matched. Check --region / --poi.');
    return;
  }

  // --- 2. What is already done? --------------------------------------------
  const producedRuns = scanProducedRuns(root);
  let uploadedPoiKeys: string[] = [];
  const { data: videoRows, error: videoError } = await supabase
    .from('poi_videos')
    .select('poi_key, version, kind')
    .eq('version', options.version)
    .eq('kind', 'poi');
  if (videoError) {
    console.warn(`! could not read poi_videos (${videoError.message}) — treating every POI as unpublished.`);
  } else {
    uploadedPoiKeys = [
      ...new Set(((videoRows ?? []) as Array<{ poi_key?: unknown }>).flatMap((row) =>
        typeof row.poi_key === 'string' ? [row.poi_key] : [],
      )),
    ];
  }

  const plan = planBatch(candidates, {
    producedRuns,
    uploadedPoiKeys,
    limit,
    force: options.force,
    languages: options.languages,
    tts: options.tts,
  });

  // --- 3. Print the plan ----------------------------------------------------
  const scope = options.poiKeys.length > 0 ? `${options.poiKeys.length} named POI(s)` : `region=${options.region ?? 'all'}`;
  console.log(
    `POI video batch — ${scope}, limit ${plan.limit}, v${options.version}, ` +
      `${options.languages.join('/')}, tts=${options.tts}, script=${options.script}` +
      `${options.upload ? ', upload' : ''}${options.force ? ', force' : ''}` +
      `${options.dry ? '  [DRY RUN — no render, no TTS, no writes]' : ''}`,
  );
  console.log(
    `Estimated TTS spend: ~$${plan.estimatedUsd.toFixed(2)} of $${options.budgetUsd.toFixed(2)} budget` +
      `${options.tts === 'silent' ? ' (silent mode — nothing is spent)' : ' (estimate; cached scenes cost nothing)'}`,
  );
  console.log('');

  for (const target of plan.skipped) {
    console.log(`· ${target.label} [${target.poiKey}] — skipped: ${describeSkip(target)}`);
  }
  for (const target of plan.produce) {
    console.log(
      `${options.dry ? '+' : '→'} ${target.label} [${target.poiKey}] · ` +
        `${target.imageCount ?? '?'} image(s) · ${target.visits} itinerary stop(s)`,
    );
  }

  if (options.dry) {
    console.log(
      `\nDRY RUN. Would produce ${plan.produce.length} POI(s); ${plan.skipped.length} skipped. ` +
        'No render ran, no TTS was requested, nothing was written.',
    );
    console.log('Re-run with --apply to produce. Add --upload to file them as pending_review.');
    return;
  }

  // --- 4. Produce -----------------------------------------------------------
  const totals: RunTotals = { produced: 0, uploaded: 0, failed: 0, ttsChars: 0 };
  const remaining: BatchTarget[] = [];
  let spentUsd = 0;
  let abortedAt: number | null = null;

  for (let index = 0; index < plan.produce.length; index += 1) {
    const target = plan.produce[index];

    // Re-checked per POI: a long run can cross the budget line mid-way.
    if (shouldAbortForBudget(spentUsd, options.budgetUsd)) {
      abortedAt = spentUsd;
      remaining.push(...plan.produce.slice(index));
      break;
    }

    console.log(`\n→ ${target.label} [${target.poiKey}]`);
    try {
      const result = await producePoiVideo({
        root,
        poi: target.poiKey,
        version: options.version,
        languages: options.languages,
        tts: options.tts,
        script: options.script,
        burnSubtitles: true,
        supabase,
        log: (line) => console.log(line),
      });
      totals.ttsChars += result.ttsChars;
      spentUsd += estimateBatchCostUsd(1, options.languages.length, options.tts);

      if (!result.ok) {
        totals.failed += 1;
        console.log(`! ${target.poiKey} — QC failed (${result.outputDir}); not uploaded. Safe to re-run.`);
        continue;
      }
      totals.produced += 1;
      console.log(`+ ${target.poiKey} — ${result.qcStatus} · ${result.outputDir}`);

      if (options.upload) {
        try {
          const uploaded = await uploadProducedRun(supabase as unknown as UploadDbClient, {
            root,
            runDir: path.resolve(root, result.outputDir),
            allowWarnings: options.allowWarnings,
            log: (line) => console.log(`  ${line}`),
          });
          totals.uploaded += uploaded.uploaded.length;
        } catch (error) {
          console.log(`  ⚠ upload skipped: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      totals.failed += 1;
      console.log(`! ${target.poiKey} — ${error instanceof Error ? error.message : String(error)}`);
    }

    await sleep(BATCH_DELAY_MS);
  }

  // --- 5. Summary -----------------------------------------------------------
  const summaryRows: Array<[string, string]> = [
    ['POIs produced', String(totals.produced)],
    ['renders queued for review', String(totals.uploaded)],
    ['failed', String(totals.failed)],
    ['skipped', String(plan.skipped.length)],
    ['TTS characters sent', String(totals.ttsChars)],
    ['estimated spend', `$${spentUsd.toFixed(2)}`],
  ];
  const width = Math.max(...summaryRows.map(([label]) => label.length));
  console.log('\n' + '─'.repeat(width + 14));
  for (const [label, value] of summaryRows) console.log(`${label.padEnd(width)}  ${value}`);
  console.log('─'.repeat(width + 14));

  if (abortedAt !== null) {
    console.log(`\n⚠ Stopped at the $${options.budgetUsd.toFixed(2)} budget (spent ~$${abortedAt.toFixed(2)}).`);
    console.log(`  ${remaining.length} POI(s) left. Resume with:`);
    console.log(`  npm run video:batch -- --apply --poi=${remaining.map((t) => t.poiKey).join(',')}`);
  } else if (totals.uploaded > 0) {
    console.log('\nQueued as pending_review. Approve in /admin/poi-videos — nothing serves until then.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
