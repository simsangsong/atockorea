/**
 * X7 — which API routes has nothing ever called? — as a module a test can read.
 *
 * The plan carried the figures "257 routes · 171 in a production harness · 90 in
 * jest · 59 in neither" through several rounds, but nothing in the repo could
 * reproduce them: they were counted by hand, once. A number nobody can re-derive
 * stops being a measurement and becomes a slogan.
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
 * only claim this makes, and it is the one that picks the work.
 *
 * 🔴 Why it is a module and not just a script: F8 ratchets the uncovered count,
 * and a gate that counted separately would drift from what the script prints.
 * One implementation, two readers — `scripts/qa-route-coverage.ts` and
 * `__tests__/audit/wiringRatchet.test.ts`.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { parseRouteMethods, routePathFromFile } from '@/lib/audit/k4Coverage';

export const WRITE_VERBS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export type RouteSurface = 'guest/driver/guide' | 'staff' | 'cron' | 'public';

export interface RouteRow {
  method: string;
  urlPath: string;
  file: string;
  jest: boolean;
  harness: boolean;
}

export interface RouteCoverageScan {
  routeFiles: number;
  rows: RouteRow[];
  namedByJest: number;
  namedByHarness: number;
  uncovered: RouteRow[];
}

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

export const surfaceOf = (urlPath: string): RouteSurface =>
  /^\/api\/(tour-rooms|tour-mode)\//.test(urlPath)
    ? 'guest/driver/guide'
    : /^\/api\/(ops|admin)\//.test(urlPath)
      ? 'staff'
      : /^\/api\/cron\//.test(urlPath)
        ? 'cron'
        : 'public';

/** Write verbs first, and among those the surfaces a guest or driver touches. */
export const priority = (r: Pick<RouteRow, 'method' | 'urlPath'>): number => {
  const write = WRITE_VERBS.has(r.method) ? 0 : 1;
  const surface = { 'guest/driver/guide': 0, public: 1, staff: 2, cron: 3 }[surfaceOf(r.urlPath)] ?? 4;
  return write * 10 + surface;
};

/**
 * A route is named when a corpus mentions its URL (dynamic segments made
 * flexible, since callers substitute real ids) or imports its module path.
 * Deliberately generous: the job is to find routes NOTHING mentions, and a
 * false "covered" is safer than a false "uncovered" that sends somebody to
 * write a duplicate test.
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

export function scanRouteCoverage(root: string = process.cwd()): RouteCoverageScan {
  const rel = (f: string) => path.relative(root, f).replace(/\\/g, '/');

  const routeFiles = walk(path.join(root, 'app/api'), /^route\.tsx?$/);
  const routes = routeFiles.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    const urlPath = routePathFromFile(rel(file));
    return parseRouteMethods(source).map((method) => ({ method, urlPath, file: rel(file) }));
  });

  const testCorpus = walk(path.join(root, '__tests__'), /\.(ts|tsx)$/).map((f) => readFileSync(f, 'utf8'));
  const harnessCorpus = walk(path.join(root, 'scripts'), /\.(ts|mjs|js)$/)
    .filter((f) => !/qa-route-coverage/.test(f))
    .map((f) => readFileSync(f, 'utf8'));

  const rows: RouteRow[] = routes.map((r) => ({
    ...r,
    jest: mentions(testCorpus, r.urlPath, r.file),
    harness: mentions(harnessCorpus, r.urlPath, r.file),
  }));

  return {
    routeFiles: routeFiles.length,
    rows,
    namedByJest: rows.filter((r) => r.jest).length,
    namedByHarness: rows.filter((r) => r.harness).length,
    uncovered: rows.filter((r) => !r.jest && !r.harness),
  };
}
