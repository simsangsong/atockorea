/**
 * qa-caller-absence, as a module a test can read.
 * (full-app audit A4; feature-audit plan §B-2 "존재 확인이 아니라 호출자 확인")
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
 * Text-level, deliberately: the TS-program detectors already exist and this has
 * to see string-built URLs (`/api/tour-rooms/${id}/messages`) that no type graph
 * contains.
 *
 * 🔴 It lives here, rather than inside the script, because F8 puts a ratchet on
 * the number it produces. A gate that re-implemented the count would drift from
 * the scanner and start measuring something else, quietly — which is the exact
 * failure this scanner exists to catch. One implementation, two readers:
 * `scripts/qa-caller-absence.ts` prints it and
 * `__tests__/audit/wiringRatchet.test.ts` holds it to a ceiling.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'coverage', 'dist', 'build']);

export interface TestOnlyModule {
  module: string;
  testOnly: string[];
}
export interface HarnessOnlyRoute {
  route: string;
  testOnly: string[];
}
export interface BlindingFile {
  file: string;
  count: number;
}

export interface CallerAbsenceScan {
  scannedFiles: number;
  /** Nothing imports these, not even a test. */
  orphanModules: string[];
  /** Only tests / scripts / mobile import these. */
  testOnlyModules: TestOnlyModule[];
  /** Smart-app routes nothing references at all. */
  orphanRoutes: string[];
  /** Smart-app routes only tests / scripts / mobile reference. */
  harnessOnlyRoutes: HarnessOnlyRoute[];
  /** App-code files shaped like a ledger — see `blinding` below. */
  blinding: BlindingFile[];
  /** The headline: what a human has to look at. */
  candidates: number;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const p = path.join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js|jsx)$/.test(entry)) out.push(p);
  }
  return out;
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
 * and LEDGER_LITERAL below catches the next one written somewhere else.
 */
const isLedger = (p: string) => /^lib\/audit\//.test(p);

const isTestish = (p: string) =>
  /^(__tests__|e2e|scripts|mobile)\//.test(p) ||
  /\.(test|spec)\.[jt]sx?$/.test(p) ||
  /__tests__\//.test(p) ||
  isLedger(p);

const MODULE_ROOTS = [
  /^lib\/tour-room\//,
  /^lib\/ops\//,
  /^hooks\//,
  /^components\/tour-mode\//,
  /^components\/tour-ops\//,
];

/**
 * A file that spells out many `'METHOD /api/…'` literals is a ledger, and every
 * literal in it looks exactly like a call site to a text-level scan. One such
 * file counted as app code makes EVERY route it lists read as wired, and the
 * scan reports zero problems — an improvement, in the only direction that
 * matters, produced by going blind. That is not hypothetical; it happened twice.
 */
const LEDGER_LITERAL = /['"`](GET|POST|PUT|PATCH|DELETE) \/api\//g;
const LEDGER_LITERAL_LIMIT = 5;

export function scanCallerAbsence(root: string = process.cwd()): CallerAbsenceScan {
  const files = walk(root);
  const rel = (p: string) => path.relative(root, p).split(path.sep).join('/');
  const source = new Map<string, string>();
  for (const f of files) {
    try {
      source.set(rel(f), readFileSync(f, 'utf8'));
    } catch {
      /* unreadable file is not a finding */
    }
  }

  // ── 1. modules with no external importer ──────────────────────────────────
  const moduleFiles = [...source.keys()].filter(
    (p) => MODULE_ROOTS.some((r) => r.test(p)) && !isTestish(p) && !/\.d\.ts$/.test(p),
  );

  const importersOf = (modPath: string) => {
    const noExt = modPath.replace(/\.(ts|tsx|mjs|js|jsx)$/, '');
    const alias = '@/' + noExt;
    const base = path.basename(noExt);
    const app: string[] = [];
    const testOnly: string[] = [];
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

  const orphanModules: string[] = [];
  const testOnlyModules: TestOnlyModule[] = [];
  for (const m of moduleFiles) {
    // Next.js conventions are entry points, not modules: the framework calls them.
    if (/^(app|components\/tour-mode\/(page|layout))/.test(m)) continue;
    const { app, testOnly } = importersOf(m);
    if (app.length === 0 && testOnly.length === 0) orphanModules.push(m);
    else if (app.length === 0) testOnlyModules.push({ module: m, testOnly: testOnly.slice(0, 3) });
  }

  // ── 2. API routes with no fetch site in app code ──────────────────────────
  const routeFiles = [...source.keys()].filter((p) => /^app\/api\/.*\/route\.ts$/.test(p));
  const routePath = (p: string) => '/' + p.replace(/^app\//, '').replace(/\/route\.ts$/, '');

  /** A fetch site can be a template literal, so match on the stable segments. */
  const referenced = (apiPath: string) => {
    const segs = apiPath.split('/').filter((s) => s && !s.startsWith('['));
    const tail = segs[segs.length - 1];
    const parent = segs[segs.length - 2];
    const app: string[] = [];
    const testOnly: string[] = [];
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

  const orphanRoutes: string[] = [];
  const harnessOnlyRoutes: HarnessOnlyRoute[] = [];
  for (const rf of routeFiles) {
    const ap = routePath(rf);
    if (!/tour-rooms|tour-mode/.test(ap)) continue; // audit scope = the smart app
    const { app, testOnly } = referenced(ap);
    if (app.length === 0 && testOnly.length === 0) orphanRoutes.push(ap);
    else if (app.length === 0) harnessOnlyRoutes.push({ route: ap, testOnly: testOnly.slice(0, 3) });
  }

  // ── 3. self-check: is this scan still able to see? ────────────────────────
  const blinding: BlindingFile[] = [];
  for (const [p, src] of source) {
    if (isTestish(p)) continue;
    const count = (src.match(LEDGER_LITERAL) ?? []).length;
    if (count >= LEDGER_LITERAL_LIMIT) blinding.push({ file: p, count });
  }

  return {
    scannedFiles: source.size,
    orphanModules,
    testOnlyModules,
    orphanRoutes,
    harnessOnlyRoutes,
    blinding,
    candidates: orphanModules.length + orphanRoutes.length + harnessOnlyRoutes.length,
  };
}
