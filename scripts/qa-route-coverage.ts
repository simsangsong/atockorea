/**
 * X7 — which API routes has nothing ever called?
 *
 * The scan lives in `lib/audit/routeCoverage.ts` so the F8 ratchet
 * (`__tests__/audit/wiringRatchet.test.ts`) holds the same number this prints
 * to a ceiling rather than counting a second time and drifting. This file is
 * the human face of it: priority order and what a failure would cost.
 *
 * Usage: npx tsx scripts/qa-route-coverage.ts [--all]
 *        --all lists every uncovered route, not just the prioritised head.
 */
import {
  priority,
  scanRouteCoverage,
  surfaceOf,
  WRITE_VERBS,
  type RouteRow,
} from '../lib/audit/routeCoverage';

const SHOW_ALL = process.argv.includes('--all');
const scan = scanRouteCoverage();
const { uncovered } = scan;

console.log(`route files          ${scan.routeFiles}`);
console.log(`(method, path) pairs ${scan.rows.length}`);
console.log(`  named by jest      ${scan.namedByJest}`);
console.log(`  named by a harness ${scan.namedByHarness}`);
console.log(`  🔴 named by NOTHING ${uncovered.length}\n`);

const byBucket = new Map<string, RouteRow[]>();
for (const r of uncovered) {
  const bucket = `${WRITE_VERBS.has(r.method) ? 'WRITE' : 'read '} · ${surfaceOf(r.urlPath)}`;
  if (!byBucket.has(bucket)) byBucket.set(bucket, []);
  byBucket.get(bucket)!.push(r);
}
console.log('uncovered, by what a failure costs:');
for (const [bucket, list] of [...byBucket].sort((a, b) => priority(a[1][0]) - priority(b[1][0]))) {
  console.log(`  ${bucket.padEnd(28)} ${list.length}`);
}

const head = [...uncovered].sort((a, b) => priority(a) - priority(b));
const shown = SHOW_ALL ? head : head.filter((r) => priority(r) <= 1);
console.log(`\n${SHOW_ALL ? 'every uncovered route' : 'write verbs on guest/driver/guide surfaces — start here'}:`);
for (const r of shown) console.log(`  ${r.method.padEnd(6)} ${r.urlPath}`);
// Silent truncation reads as "that was all of them" — say what was dropped.
if (!SHOW_ALL && head.length > shown.length) {
  console.log(`  … +${head.length - shown.length} more uncovered (pass --all)`);
}
