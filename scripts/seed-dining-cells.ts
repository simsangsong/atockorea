#!/usr/bin/env node
/**
 * Pre-seed the dining cache for a region's main POIs (§5.7 R-8).
 * Spec: docs/dining-rag-task7-build-spec-2026-07-25.md
 *
 * Why this exists: the cell cache is a zero-call cache only AFTER someone has
 * paid for the first collection. Without seeding, the first guest to reach a
 * meal stop waits on a Kakao sweep + a Google enrichment — and if either times
 * out, they get no card at all. Running this once over the pilot catalogue
 * moves that cost off the guest path entirely: every seeded cell is a HIT for
 * the next 90 days (CACHE_TTL_DAYS).
 *
 * 🔴 It calls the SAME `collectCell` the app calls. It does not re-implement
 * collection — a second collector would drift from the served one, and the
 * whole point of seeding is that the guest path finds exactly what we stored.
 * That is also why this is a .ts script run through the repo's tsx runner
 * (the `rag:index` / `video:produce` precedent): cache.server.ts is TypeScript
 * behind the `@/` alias, so a .mjs script could not import it.
 *
 * ⚠ Deviation from the spec's §R-8 wording, deliberately: the spec says to
 * filter `match_pois` on `is_operational`. That column is GENERATED as
 * `poi_key LIKE 'OPS_%'` — it marks pickup/logistics rows, not "this POI is in
 * operation". Filtering on it true selects ZERO Jeju POIs (verified against the
 * live catalogue), and those rows are never meal stops anyway. So OPS_ rows are
 * EXCLUDED instead of required.
 *
 * Usage:
 *   npm run dining:seed                     # dry run, top 30 Jeju POIs
 *   npm run dining:seed -- --apply          # actually collect
 *   npm run dining:seed -- --apply --limit=5
 *   npm run dining:seed -- --poi=seongsan_ilchulbong,manjanggul --apply
 *   npm run dining:seed -- --apply --force  # re-collect cells that are still valid
 *
 * Flags: --dry (default) · --apply · --limit=N · --poi=<key> (repeatable or
 *        comma-separated) · --region=jeju · --radius=800 · --force
 */

import { createServerClient } from '@/lib/supabase';
import {
  CACHE_TTL_DAYS,
  DEFAULT_RADIUS_M,
  cellFor,
  collectCell,
} from '@/lib/ops/dining/cache.server';
import { QUOTA_ALERT_RATIO, quotaState } from '@/lib/ops/dining/kakao.server';
import { googleQuotaState } from '@/lib/ops/dining/google.server';
import {
  DEFAULT_SEED_REGION,
  parseSeedArgs,
  planSeed,
  resolveSeedLimit,
  seedCandidates,
  shouldAbortForQuota,
  visitCountsFromStops,
  type SeedPoiRow,
  type SeedTarget,
} from '@/lib/ops/dining/seed';

/** Gentle pacing between POIs, matching collect-facility-pins.mjs. */
const DELAY_MS = 150;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RunTotals {
  cells: number;
  places: number;
  kakaoCalls: number;
  googleCalls: number;
  failed: number;
}

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function describeSkip(target: SeedTarget): string {
  if (target.skip === 'duplicate-cell') return 'same cell as an earlier POI in this run';
  if (target.skip === 'cached') {
    return target.cachedUntil ? `cached until ${target.cachedUntil.slice(0, 10)}` : 'already cached';
  }
  return 'skipped';
}

async function main(): Promise<void> {
  const opts = parseSeedArgs(process.argv.slice(2));
  const limit = resolveSeedLimit(opts);
  const radiusM = opts.radiusM ?? DEFAULT_RADIUS_M;
  const supabase = createServerClient();

  // --- 1. Catalogue ---------------------------------------------------------
  const { data: poiRows, error: poiError } = await supabase
    .from('match_pois')
    .select('poi_key, name_en, name_ko, region, lat, lng, is_attraction, stop_role, is_operational')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .order('poi_key');
  if (poiError) throw poiError;

  // --- 2. Visit-frequency signal (§R-8 "방문빈도순") -------------------------
  // The whole table is a couple of hundred rows; counting client-side avoids a
  // group-by round trip and keeps the ordering logic in the tested module.
  const { data: stopRows } = await supabase.from('match_itinerary_stops').select('poi_key');
  const visitCounts = visitCountsFromStops((stopRows ?? []) as Array<{ poi_key?: unknown }>);

  const candidates = seedCandidates(
    (poiRows ?? []) as SeedPoiRow[],
    { region: opts.poiKeys.length > 0 ? null : opts.region ?? DEFAULT_SEED_REGION, poiKeys: opts.poiKeys, visitCounts },
    cellFor,
  );

  if (candidates.length === 0) {
    console.log('No POIs matched. Check --region / --poi and that the rows carry coordinates.');
    return;
  }

  // --- 3. Which of those cells are already warm? ----------------------------
  // Only live index rows count as cached; an expired one must be re-collected,
  // which is exactly what leaving it out of this map achieves.
  const cachedCells: Record<string, string | null> = {};
  const cells = [...new Set(candidates.map((candidate) => candidate.cell))];
  const { data: indexRows, error: indexError } = await supabase
    .from('ops_kakao_cell_index')
    .select('cell, expires_at')
    .in('cell', cells)
    .gt('expires_at', new Date().toISOString());
  if (indexError) {
    console.warn(`! could not read ops_kakao_cell_index (${indexError.message}) — treating every cell as cold.`);
  }
  for (const row of (indexRows ?? []) as Array<{ cell?: unknown; expires_at?: unknown }>) {
    if (typeof row.cell === 'string') {
      cachedCells[row.cell] = typeof row.expires_at === 'string' ? row.expires_at : null;
    }
  }

  const plan = planSeed(candidates, { cachedCells, limit, force: opts.force });

  // --- 4. Print the plan ----------------------------------------------------
  const scope = opts.poiKeys.length > 0 ? `${opts.poiKeys.length} named POI(s)` : `region=${opts.region}`;
  const kakao = await quotaState();
  const google = await googleQuotaState();
  console.log(
    `Seeding dining cells — ${scope}, radius ${radiusM}m, limit ${plan.limit}` +
      `${opts.force ? ', force' : ''}${opts.dry ? '  [DRY RUN — no external calls, no writes]' : ''}`,
  );
  console.log(
    `Quota today: kakao ${kakao.used}/${kakao.cap} (${pct(kakao.ratio)}) · ` +
      `google ${google.used}/${google.cap} (${pct(google.ratio)})\n`,
  );

  for (const target of plan.skipped) {
    console.log(`· ${target.label} [${target.cell}] — skipped: ${describeSkip(target)}`);
  }
  for (const target of plan.collect) {
    console.log(
      `${opts.dry ? '+' : '→'} ${target.label} [${target.cell}] ` +
        `${target.lat.toFixed(5)}, ${target.lng.toFixed(5)} · ${target.visits} itinerary stop(s)`,
    );
  }

  if (opts.dry) {
    console.log(
      `\nDRY RUN. Would collect ${plan.collect.length} cell(s); ${plan.skipped.length} skipped. ` +
        'No external call was made and nothing was written.',
    );
    console.log('Re-run with --apply to spend quota. Each collected cell then serves for ' + `${CACHE_TTL_DAYS} days.`);
    return;
  }

  // --- 5. Collect -----------------------------------------------------------
  const totals: RunTotals = { cells: 0, places: 0, kakaoCalls: 0, googleCalls: 0, failed: 0 };
  const remaining: SeedTarget[] = [];
  let abortedAt: { used: number; cap: number; ratio: number } | null = null;

  for (let i = 0; i < plan.collect.length; i += 1) {
    const target = plan.collect[i];

    // Re-checked per POI: a 30-POI run can cross the line mid-way.
    const quota = await quotaState();
    if (shouldAbortForQuota(quota.ratio, QUOTA_ALERT_RATIO)) {
      abortedAt = { used: quota.used, cap: quota.cap, ratio: quota.ratio };
      remaining.push(...plan.collect.slice(i));
      break;
    }

    const result = await collectCell(supabase, { lat: target.lat, lng: target.lng, radiusM });

    // Call counts come from the ledger row collectCell just wrote — it is the
    // only place that knows whether the 800 m sweep had to widen to 1500 m.
    let kakaoCalls = 0;
    let googleCalls = 0;
    if (result.hit) {
      const { data: written } = await supabase
        .from('ops_kakao_cell_index')
        .select('kakao_calls, google_calls, place_count')
        .eq('cell', target.cell)
        .maybeSingle();
      kakaoCalls = Number((written as { kakao_calls?: unknown } | null)?.kakao_calls ?? 0) || 0;
      googleCalls = Number((written as { google_calls?: unknown } | null)?.google_calls ?? 0) || 0;
    }

    if (!result.hit) {
      totals.failed += 1;
      console.log(
        `! ${target.label} [${target.cell}] — collection returned nothing ` +
          '(no Kakao key, quota exhausted, or the sweep failed). Safe to re-run.',
      );
    } else {
      totals.cells += 1;
      totals.places += result.places.length;
      totals.kakaoCalls += kakaoCalls;
      totals.googleCalls += googleCalls;
      console.log(
        `+ ${target.label} [${target.cell}] — ${result.places.length} place(s) cached · ` +
          `kakao ${kakaoCalls} / google ${googleCalls}${result.unrated ? ' · unrated fallback' : ''}`,
      );
    }

    await sleep(DELAY_MS);
  }

  // --- 6. Summary -----------------------------------------------------------
  const finalKakao = await quotaState();
  const finalGoogle = await googleQuotaState();
  const rows: Array<[string, string]> = [
    ['cells seeded', String(totals.cells)],
    ['places cached', String(totals.places)],
    ['kakao calls spent', String(totals.kakaoCalls)],
    ['google calls spent', String(totals.googleCalls)],
    ['skipped', String(plan.skipped.length)],
    ['failed', String(totals.failed)],
    ['kakao quota today', `${finalKakao.used}/${finalKakao.cap} (${pct(finalKakao.ratio)})`],
    ['google quota today', `${finalGoogle.used}/${finalGoogle.cap} (${pct(finalGoogle.ratio)})`],
  ];
  const width = Math.max(...rows.map(([label]) => label.length));
  console.log('\n' + '─'.repeat(width + 12));
  for (const [label, value] of rows) console.log(`${label.padEnd(width)}  ${value}`);
  console.log('─'.repeat(width + 12));

  if (abortedAt) {
    console.log(
      `\n⚠ Stopped at ${pct(abortedAt.ratio)} of the daily Kakao quota ` +
        `(${abortedAt.used}/${abortedAt.cap}) — the §R-3 70% brake.`,
    );
    console.log(`  ${remaining.length} POI(s) left. Resume tomorrow, or re-run with:`);
    console.log(`  npm run dining:seed -- --apply --poi=${remaining.map((t) => t.poi_key).join(',')}`);
  }

  console.log('\nReview the cache in /admin/dining-cache (report queue first).');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
