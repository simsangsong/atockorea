/**
 * qa-caller-absence — which modules and API routes has nobody wired up?
 * (full-app audit A4; plan §B-2 "존재 확인이 아니라 호출자 확인")
 *
 * This track's dominant defect five times running was a built thing with no
 * consumer: an engine with no caller, one of two data sources read, a 413-line
 * module nobody imported. `audit-dead-exports.mjs` answers the symbol-level
 * question. This answers the two the plan asks for:
 *
 *   1. MODULES with zero external importers — lib/tour-room/**, lib/ops/**,
 *      hooks/**, components/tour-mode/** (a component nobody renders is the
 *      same defect wearing a different hat).
 *   2. API ROUTES with zero fetch site in app code — a live endpoint the UI
 *      never calls. Test/harness/mobile references are reported SEPARATELY,
 *      because "only the harness calls it" is exactly how FA-016 stayed hidden.
 *
 * Text-level, deliberately: the TS-program detectors already exist and this
 * has to see string-built URLs (`/api/tour-rooms/${id}/messages`) that no type
 * graph contains.
 *
 * Usage: node scripts/qa-caller-absence.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'coverage', 'dist', 'build']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const p = path.join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js|jsx)$/.test(entry)) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const source = new Map();
for (const f of files) {
  try {
    source.set(rel(f), readFileSync(f, 'utf8'));
  } catch {
    /* unreadable file is not a finding */
  }
}

/**
 * Ledgers DECLARE routes; they do not call them. Counting one as an app caller
 * is how a route with only a harness reference reads as wired — the first run
 * of this scan made exactly that mistake on the /content route.
 *
 * 🔴 This was written as `p === 'lib/audit/k4Coverage.ts'`, one filename. Then
 * the feature audit added a SECOND ledger next to it (featureJourney.ts, every
 * route path as a string key) and the harness-only count silently fell 1 → 0.
 * The scan went blind and reported an improvement. Everything under lib/audit/
 * describes the app rather than calling it, so the rule is the directory —
 * and LEDGER_SHAPED below catches the next one written somewhere else.
 */
const isLedger = (p) => /^lib\/audit\//.test(p);

const isTestish = (p) =>
  /^(__tests__|e2e|scripts|mobile)\//.test(p) ||
  /\.(test|spec)\.[jt]sx?$/.test(p) ||
  /__tests__\//.test(p) ||
  isLedger(p);

// ── 1. modules with no external importer ────────────────────────────────────
const MODULE_ROOTS = [/^lib\/tour-room\//, /^lib\/ops\//, /^hooks\//, /^components\/tour-mode\//, /^components\/tour-ops\//];
const moduleFiles = [...source.keys()].filter(
  (p) => MODULE_ROOTS.some((r) => r.test(p)) && !isTestish(p) && !/\.d\.ts$/.test(p),
);

const importersOf = (modPath) => {
  const noExt = modPath.replace(/\.(ts|tsx|mjs|js|jsx)$/, '');
  const alias = '@/' + noExt;
  const base = path.basename(noExt);
  const app = [];
  const testOnly = [];
  for (const [p, src] of source) {
    if (p === modPath) continue;
    // alias import, or a relative import ending in the same basename
    const hit =
      src.includes(alias + "'") ||
      src.includes(alias + '"') ||
      src.includes(alias + '`') ||
      new RegExp(`from\\s+['"][^'"]*/${base}['"]`).test(src) ||
      new RegExp(`import\\(['"][^'"]*${base}['"]\\)`).test(src);
    if (!hit) continue;
    (isTestish(p) ? testOnly : app).push(p);
  }
  return { app, testOnly };
};

const orphanModules = [];
const testOnlyModules = [];
for (const m of moduleFiles) {
  // Next.js conventions are entry points, not modules: they are "called" by the framework.
  if (/^(app|components\/tour-mode\/(page|layout))/.test(m)) continue;
  const { app, testOnly } = importersOf(m);
  if (app.length === 0 && testOnly.length === 0) orphanModules.push(m);
  else if (app.length === 0) testOnlyModules.push({ m, testOnly: testOnly.slice(0, 3) });
}

// ── 2. API routes with no fetch site in app code ────────────────────────────
const routeFiles = [...source.keys()].filter((p) => /^app\/api\/.*\/route\.ts$/.test(p));
const routePath = (p) => '/' + p.replace(/^app\//, '').replace(/\/route\.ts$/, '');

/** A fetch site can be a template literal, so match on the stable segments. */
const referenced = (apiPath) => {
  const segs = apiPath.split('/').filter((s) => s && !s.startsWith('['));
  const tail = segs[segs.length - 1];
  const parent = segs[segs.length - 2];
  const app = [];
  const testOnly = [];
  for (const [p, src] of source) {
    if (p.startsWith('app/api/')) continue; // routes calling routes is not a UI entry point
    // needs the tail segment AND (parent or full literal) to avoid `/messages` collisions
    if (!src.includes('/' + tail)) continue;
    const strong =
      src.includes(apiPath) ||
      (parent && new RegExp(`${parent}[^'"\`]{0,80}/${tail}`).test(src)) ||
      new RegExp(`api/[^'"\`]{0,80}/${tail}`).test(src) ||
      // Room components call a base-prefixing helper with a bare suffix —
      // `api('/manual-arrival')`, `authedFetch('/my-seat')`. Without this the
      // scan called two live, wired routes orphans (first run did exactly that).
      new RegExp(`(api|authedFetch|roomFetch|call)\\(\\s*['"\`]/${tail}['"\`]`).test(src);
    if (!strong) continue;
    (isTestish(p) ? testOnly : app).push(p);
  }
  return { app, testOnly };
};

const orphanRoutes = [];
const harnessOnlyRoutes = [];
for (const rf of routeFiles) {
  const ap = routePath(rf);
  if (!/tour-rooms|tour-mode/.test(ap)) continue; // audit scope = the smart app
  const { app, testOnly } = referenced(ap);
  if (app.length === 0 && testOnly.length === 0) orphanRoutes.push(ap);
  else if (app.length === 0) harnessOnlyRoutes.push({ ap, testOnly: testOnly.slice(0, 3) });
}

console.log(`scanned ${source.size} source files\n`);
console.log(`# modules with NO importer at all: ${orphanModules.length}`);
orphanModules.forEach((m) => console.log('   ' + m));
console.log(`\n# modules imported ONLY by tests/scripts/mobile: ${testOnlyModules.length}`);
testOnlyModules.forEach(({ m, testOnly }) => console.log(`   ${m}  ←  ${testOnly.join(', ')}`));
console.log(`\n# smart-app API routes with NO reference anywhere: ${orphanRoutes.length}`);
orphanRoutes.forEach((r) => console.log('   ' + r));
console.log(`\n# smart-app API routes referenced ONLY by tests/scripts/mobile: ${harnessOnlyRoutes.length}`);
harnessOnlyRoutes.forEach(({ ap, testOnly }) => console.log(`   ${ap}  ←  ${testOnly.join(', ')}`));

const failures = orphanModules.length + orphanRoutes.length + harnessOnlyRoutes.length;
console.log(`\n${failures ? '🔴' : '✅'} caller-absence candidates: ${failures}`);

/**
 * Self-check: is this scan still able to see?
 *
 * A file that spells out many `'METHOD /api/…'` literals is a ledger, and every
 * literal in it looks exactly like a call site to a text-level scan. One such
 * file counted as app code makes EVERY route it lists read as wired, and the
 * scan reports zero problems — an improvement, in the only direction that
 * matters, produced by going blind.
 *
 * That is not hypothetical; it happened twice. So rather than trusting the
 * directory rule to be remembered, look for the shape.
 */
const LEDGER_LITERAL = /['"`](GET|POST|PUT|PATCH|DELETE) \/api\//g;
const blinding = [];
for (const [p, src] of source) {
  if (isTestish(p)) continue;
  const count = (src.match(LEDGER_LITERAL) ?? []).length;
  if (count >= 5) blinding.push({ p, count });
}
if (blinding.length > 0) {
  console.error('\n🔴 SCAN MAY BE BLIND — these count as app callers but look like ledgers:');
  for (const { p, count } of blinding) console.error(`   ${p}  (${count} route literals)`);
  console.error(
    '   A ledger declares routes; it does not call them. Move it under lib/audit/,\n' +
      '   or add it to isTestish — otherwise every route it names reads as wired.',
  );
  process.exit(2);
}
