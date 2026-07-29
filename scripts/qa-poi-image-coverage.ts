/**
 * P7.1 harness — how many POIs can actually show a photo, and which stored
 * URLs point at files that are not there.
 *
 *   npx tsx scripts/qa-poi-image-coverage.ts
 *
 * Read-only. Exits 2 when nothing was checked, so an empty pass can never be
 * mistaken for a clean one. Exits 1 when coverage has regressed below the
 * floor recorded at the time of P7.1.
 *
 * 🔴 Why this exists rather than a unit test: the failure is silent. A POI
 * whose photo URL 404s renders the swatch, which is a legitimate state for the
 * 48 POIs that genuinely have no photo — so a dead asset is indistinguishable
 * from missing content by looking at the screen. Only a check that resolves the
 * candidates AND stats the file can tell those two apart.
 *
 * It found three dead assets on introduction, two of which the audit that
 * commissioned this ticket had missed because it only inspected
 * `default_image_url`:
 *
 *     yongmeori_coast       default + images[0] both dead, no replacement in repo
 *     sanbangsan_mountain   images[0] dead, images[1] LIVE   ← chain recovers it
 *     hueree_natural_park   images[0..1] dead, images[2] LIVE ← chain recovers it
 */

import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { poiImageCandidates } from '../lib/tour-room/poiImage';

config({ path: '.env.local' });
config({ path: '../../../.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Measured 2026-07-30 on live `match_pois` (124 rows) AFTER the dead-URL
 * cleanup: 75 POIs resolve to a candidate whose file exists, and every stored
 * candidate now resolves (candidates 75 == renderable 75, dead 0).
 *
 * The floor is the measurement, not a target — it is here so that a future data
 * edit that drops photos gets noticed rather than discovered by a guest.
 */
const COVERAGE_FLOOR = 75;

/** Local `/images/...` URLs are served from `public/`; remote ones can't be stat'd. */
function localFileFor(url: string): string | null {
  if (!url.startsWith('/')) return null;
  const clean = url.split('?')[0].split('#')[0];
  return path.join(process.cwd(), 'public', clean);
}

const dirCache = new Map<string, Set<string> | null>();

/**
 * 🔴 Case-EXACT existence, because this repo is developed on Windows and
 * deployed to Linux.
 *
 * `existsSync` on NTFS matches `Photo-001.webp` for a request for
 * `photo-001.webp`, so a case-mismatched URL passes here and 404s in
 * production — the harness would report coverage the guest never gets. Reading
 * the directory and testing membership is the only answer that is true on both
 * filesystems.
 */
function fileExistsExact(file: string): boolean {
  const dir = path.dirname(file);
  let entries = dirCache.get(dir);
  if (entries === undefined) {
    try {
      entries = new Set(readdirSync(dir));
    } catch {
      entries = null; // directory itself is missing
    }
    dirCache.set(dir, entries);
  }
  if (entries === null) return false;
  return entries.has(path.basename(file));
}

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await db
    .from('match_pois')
    .select('poi_key, default_image_url, images')
    .order('poi_key');
  if (error) throw error;

  const pois = data ?? [];
  if (pois.length === 0) {
    console.error('No match_pois rows read — refusing to report 0% as a pass.');
    process.exit(2);
  }

  let withCandidate = 0;
  let renderable = 0;
  const noCandidate: string[] = [];
  const deadUrls: Array<{ poi: string; url: string; recovered: string | null }> = [];
  const caseMismatches: Array<{ poi: string; url: string }> = [];
  let remoteSkipped = 0;

  for (const poi of pois) {
    const candidates = poiImageCandidates(poi as { default_image_url: string | null; images: string[] | null });
    if (candidates.length === 0) {
      noCandidate.push(poi.poi_key);
      continue;
    }
    withCandidate += 1;

    let live: string | null = null;
    const dead: string[] = [];
    for (const url of candidates) {
      const file = localFileFor(url);
      if (file === null) {
        remoteSkipped += 1;
        live = live ?? url; // can't verify a remote URL; assume it serves
        continue;
      }
      if (fileExistsExact(file)) {
        live = live ?? url;
      } else {
        dead.push(url);
        // Distinguish "wrong case" from "absent" — they need different fixes.
        if (existsSync(file)) caseMismatches.push({ poi: poi.poi_key, url });
      }
    }
    if (live) renderable += 1;
    for (const url of dead) deadUrls.push({ poi: poi.poi_key, url, recovered: live });
  }

  const pct = (n: number) => `${((n / pois.length) * 100).toFixed(1)}%`;

  console.log('--- POI photo coverage (live match_pois × repo public/) ---');
  console.log(`rows                       ${pois.length}`);
  console.log(`has >=1 candidate URL      ${withCandidate}  (${pct(withCandidate)})`);
  console.log(`…file actually present     ${renderable}  (${pct(renderable)})   <- what a guest sees`);
  console.log(`no candidate at all        ${noCandidate.length}  (${pct(noCandidate.length)})   <- content gate`);
  if (remoteSkipped > 0) console.log(`remote URLs (not stat'd)   ${remoteSkipped}`);

  if (deadUrls.length > 0) {
    console.log(`\n--- dead asset URLs (${deadUrls.length}) ---`);
    for (const d of deadUrls) {
      console.log(`  ${d.poi}\n    ${d.url}\n    ${d.recovered ? `recovered by chain -> ${d.recovered}` : 'NO live candidate -> swatch'}`);
    }
  }

  if (caseMismatches.length > 0) {
    console.log(`\n🔴 --- case-mismatched URLs (${caseMismatches.length}) — pass on Windows, 404 on Vercel ---`);
    for (const c of caseMismatches) console.log(`  ${c.poi}  ${c.url}`);
  }

  if (noCandidate.length > 0) {
    console.log(`\n--- POIs with no photo at all (${noCandidate.length}) — owner content gate ---`);
    console.log(noCandidate.join('\n'));
  }

  if (renderable < COVERAGE_FLOOR) {
    console.error(`\nREGRESSION: ${renderable} renderable < floor ${COVERAGE_FLOOR}`);
    process.exit(1);
  }
  console.log(`\nOK — ${renderable} renderable (floor ${COVERAGE_FLOOR}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
