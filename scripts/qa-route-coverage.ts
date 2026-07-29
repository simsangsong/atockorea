/**
 * X7 — which API routes has nothing ever called?
 *
 * The plan carried the figures "257 routes · 171 in a production harness · 90 in
 * jest · 59 in neither" through several rounds, but nothing in the repo could
 * reproduce them: they were counted by hand, once. A number nobody can re-derive
 * stops being a measurement and becomes a slogan — and this one is the input to
 * deciding what to test next, so it has to be re-runnable.
 *
 * 🔴 What "covered" means here, and what it does not.
 *
 * Two independent signals, because they fail differently:
 *   jest      — a test file names the route module or its URL. Proves somebody
 *               exercised the handler, but a mocked `next/server` can make that
 *               shallow.
 *   harness   — a `scripts/` walk or pressure test names the URL. Proves the
 *               route answered a real request, but says nothing about branches.
 * Neither proves the route is CORRECT. "Nothing has ever called this" is the
 * only claim this script makes, and it is the one that picks the work.
 *
 * Priority follows the ticket: write verbs first (they change state, so a
 * failure is not merely a blank screen), and among those, the surfaces a guest
 * or a driver touches — where "it broke" means a person is standing on a kerb.
 *
 * Usage: npx tsx scripts/qa-route-coverage.ts [--all]
 *        --all lists every uncovered route, not just the prioritised head.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { parseRouteMethods, routePathFromFile } from '../lib/audit/k4Coverage';

const SHOW_ALL = process.argv.includes('--all');
const WRITE_VERBS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function walk(dir: string, match: RegExp, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    if (statSync(full).isDirectory()) walk(full, match, out);
    else if (match.test(entry)) out.push(full);
  }
  return out;
}

const rel = (f: string) => path.relative('.', f).replace(/\\/g, '/');

// ---- what exists -----------------------------------------------------------

const routeFiles = walk('app/api', /^route\.tsx?$/);
const routes = routeFiles.flatMap((file) => {
  const source = readFileSync(file, 'utf8');
  const urlPath = routePathFromFile(rel(file));
  return parseRouteMethods(source).map((method) => ({ method, urlPath, file: rel(file) }));
});

// ---- what calls it ---------------------------------------------------------

const testCorpus = walk('__tests__', /\.(ts|tsx)$/).map((f) => readFileSync(f, 'utf8'));
const harnessCorpus = walk('scripts', /\.(ts|mjs|js)$/)
  .filter((f) => !/qa-route-coverage/.test(f))
  .map((f) => readFileSync(f, 'utf8'));

/**
 * A route is named when a corpus mentions its URL (dynamic segments made
 * flexible, since callers substitute real ids) or imports its module path.
 * Deliberately generous: this script's job is to find routes NOTHING mentions,
 * and a false "covered" is safer here than a false "uncovered" that sends
 * somebody to write a duplicate test.
 */
function mentions(corpus: string[], urlPath: string, file: string): boolean {
  const modulePath = file.replace(/^app\//, '@/app/').replace(/\.tsx?$/, '');
  const urlRe = new RegExp(
    urlPath
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\[[^\\]*\\\]/g, '[^/\'"`\\s)]+')
      .replace(/\\\[/g, '[^/\'"`\\s)]+'),
  );
  return corpus.some((text) => text.includes(modulePath) || urlRe.test(text));
}

const rows = routes.map((r) => ({
  ...r,
  jest: mentions(testCorpus, r.urlPath, r.file),
  harness: mentions(harnessCorpus, r.urlPath, r.file),
}));

// ---- who gets hurt ---------------------------------------------------------

const surfaceOf = (urlPath: string) =>
  /^\/api\/(tour-rooms|tour-mode)\//.test(urlPath)
    ? 'guest/driver/guide'
    : /^\/api\/(ops|admin)\//.test(urlPath)
      ? 'staff'
      : /^\/api\/cron\//.test(urlPath)
        ? 'cron'
        : 'public';

const uncovered = rows.filter((r) => !r.jest && !r.harness);
const priority = (r: (typeof rows)[number]) => {
  const write = WRITE_VERBS.has(r.method) ? 0 : 1;
  const surface = { 'guest/driver/guide': 0, public: 1, staff: 2, cron: 3 }[surfaceOf(r.urlPath)] ?? 4;
  return write * 10 + surface;
};

console.log(`route files          ${routeFiles.length}`);
console.log(`(method, path) pairs ${rows.length}`);
console.log(`  named by jest      ${rows.filter((r) => r.jest).length}`);
console.log(`  named by a harness ${rows.filter((r) => r.harness).length}`);
console.log(`  🔴 named by NOTHING ${uncovered.length}\n`);

const byBucket = new Map<string, typeof uncovered>();
for (const r of uncovered) {
  const bucket = `${WRITE_VERBS.has(r.method) ? 'WRITE' : 'read '} · ${surfaceOf(r.urlPath)}`;
  if (!byBucket.has(bucket)) byBucket.set(bucket, []);
  byBucket.get(bucket)!.push(r);
}
console.log('uncovered, by what a failure costs:');
for (const [bucket, list] of [...byBucket].sort(
  (a, b) => priority(a[1][0]) - priority(b[1][0]),
)) {
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
