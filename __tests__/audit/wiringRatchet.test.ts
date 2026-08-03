/**
 * @jest-environment node
 *
 * F8 — the two wiring inventories, ratcheted.
 *
 * `qa-caller-absence` and `qa-route-coverage` have always been inventories: they
 * print a number and exit 0. That was the right call — neither number is a defect
 * count, and F0 said so explicitly. But an inventory nobody watches is a number
 * that grows quietly, and the thing it counts is this track's dominant defect:
 * something built that nothing calls.
 *
 * So this holds them, without pretending the totals are bug counts.
 *
 * 🔴 Both scans were moved into `lib/audit/` for this. A gate that counted
 * separately would drift from what the scripts print, and then two numbers would
 * disagree about the same repo — which is the failure the scanners exist to
 * catch, performed by their own gate.
 *
 * 🔴 `qa-unfilled-props` is deliberately NOT ratcheted, and should not be added.
 * F5 classified all 49 of its findings and none was a defect: they are optional
 * props a call site does not use, and data that flows inside an object. A
 * ceiling on that number breaks the build for a harmless optional prop, and a
 * gate that fails for no reason gets switched off — taking the two real ones
 * here with it. It stays an inventory.
 *
 * 🔴 And this file names NO route paths on purpose. `__tests__/**` is
 * route-coverage's jest corpus: a route URL written here would mark that route
 * covered and lower the very number this file protects. The last assertion below
 * checks its own source for exactly that, because "remember not to" is not a
 * mechanism — this repo has been blinded by the file next to the gate twice.
 */
import { readFileSync } from 'node:fs';
import { scanCallerAbsence } from '@/lib/audit/callerAbsence';
import { scanRouteCoverage, surfaceOf, WRITE_VERBS } from '@/lib/audit/routeCoverage';

/**
 * The known, accepted caller-absence candidates — identity, not just a count.
 *
 * A count alone stays green when one is fixed and another appears, which is the
 * regression that matters most. Each entry has to say why it is acceptable, and
 * an entry that stops being a candidate has to be deleted (asserted below), so a
 * fixed one cannot rot here as a permanent excuse.
 */
const ACCEPTED_CANDIDATES: Record<string, string> = {
  'lib/ops/parse/client-sse.ts':
    'Real orphan: 165 lines, zero importers, and its own comment names a consumer ' +
    '(ImportWizard.tsx) that does not exist. It belongs to the ops import funnel, ' +
    'which the feature audit put out of scope (§A-4), so it is recorded rather than ' +
    "deleted — removing an ops module is the owner's call, not this audit's.",
  // 🔴 Keys for routes drop the leading api segment. Written in full it would be
  // a route URL sitting in the jest corpus, which is precisely how a route gets
  // marked "covered" by the file that is supposed to be watching it.
  '/tour-mode/booking/[id]/content':
    'Not a defect: the web app does not call it, the MOBILE app does ' +
    '(mobile/ is a real app with its own package.json and 49 TS files). The scanner ' +
    'buckets mobile with tests, which is correct for the web question it asks and ' +
    'wrong for this one route.',
};

/** Route keys are stored without the api segment — see the comment above. */
const candidateKey = (value: string) => value.replace(/^\/api(?=\/)/, '');

/** Today's total. Lower it when the work lands; never raise it casually. */
const ROUTE_COVERAGE_CEILING = 125;
/** How far below the ceiling the count may sit before the ceiling is stale. */
const ROUTE_COVERAGE_SLACK = 10;

const callerAbsence = scanCallerAbsence();
const routeCoverage = scanRouteCoverage();

describe('F8 — the scans are actually looking at the repo', () => {
  // B-3: a gate that measures nothing while green is a lie. If a walk breaks —
  // wrong cwd, a renamed directory — every count collapses to zero and every
  // ceiling below would pass.
  it('caller-absence read a whole repo, not an empty directory', () => {
    expect(callerAbsence.scannedFiles).toBeGreaterThan(2_000);
  });

  it('route-coverage found the API tree and both corpora', () => {
    expect(routeCoverage.routeFiles).toBeGreaterThan(200);
    expect(routeCoverage.rows.length).toBeGreaterThan(300);
    expect(routeCoverage.namedByJest).toBeGreaterThan(100);
    expect(routeCoverage.namedByHarness).toBeGreaterThan(50);
  });

  it('🔴 caller-absence is not blinded by a ledger sitting in app code', () => {
    // The scanner's own self-check, promoted from an exit code nobody reads to
    // a gate. A file full of 'METHOD /api/…' literals makes every route it names
    // read as wired, and the scan then reports an improvement by going blind.
    expect(callerAbsence.blinding).toEqual([]);
  });
});

describe('F8 — caller absence stays at its known set', () => {
  /**
   * Exactly the three buckets the script totals as "candidates". The
   * test-only MODULES bucket is deliberately not here: a QA module imported by
   * its harness is doing its job, and the script has always reported it
   * separately for that reason. Folding it in here would have made this gate
   * disagree with the number the script prints, which is the drift the whole
   * `lib/audit` move exists to prevent.
   */
  const found = [
    ...callerAbsence.orphanModules,
    ...callerAbsence.orphanRoutes,
    ...callerAbsence.harnessOnlyRoutes.map((r) => r.route),
  ].map(candidateKey);

  it('🔴 nothing new has appeared', () => {
    const unexpected = found.filter((key) => !(key in ACCEPTED_CANDIDATES));
    expect(unexpected).toEqual([]);
  });

  it('🔴 nothing accepted has been fixed without deleting its excuse', () => {
    // Without this the list becomes a graveyard: an entry that no longer
    // describes the repo still reads like a live decision to the next person.
    const stale = Object.keys(ACCEPTED_CANDIDATES).filter((key) => !found.includes(key));
    expect(stale).toEqual([]);
  });

  it('every accepted candidate says why', () => {
    expect(Object.keys(ACCEPTED_CANDIDATES).length).toBeGreaterThan(0);
    for (const [key, reason] of Object.entries(ACCEPTED_CANDIDATES)) {
      expect(`${key}: ${reason}`.length).toBeGreaterThan(key.length + 60);
    }
  });

  it('the headline count agrees with the set this gate holds', () => {
    // If these ever disagree, the gate and the script are describing different
    // repos and one of them is lying.
    expect(callerAbsence.candidates).toBe(found.length);
    expect(found.length).toBe(Object.keys(ACCEPTED_CANDIDATES).length);
  });
});

describe('F8 — route coverage does not quietly grow', () => {
  it('🔴 the smart app itself stays fully covered', () => {
    // The sharp invariant, and the one worth more than the total: every
    // (method, path) on the guest/driver/guide surface is named by a test or a
    // harness today. A new room route with neither fails here immediately,
    // which is the moment it is cheapest to fix.
    const uncoveredSmartApp = routeCoverage.uncovered
      .filter((r) => surfaceOf(r.urlPath) === 'guest/driver/guide')
      .map((r) => `${r.method} ${r.file}`);
    expect(uncoveredSmartApp).toEqual([]);
  });

  it('the surface it protects is non-empty', () => {
    // Otherwise the assertion above passes by describing nothing.
    const smartApp = routeCoverage.rows.filter((r) => surfaceOf(r.urlPath) === 'guest/driver/guide');
    expect(smartApp.length).toBeGreaterThan(50);
    expect(smartApp.filter((r) => WRITE_VERBS.has(r.method)).length).toBeGreaterThan(20);
  });

  it('🔴 the repo-wide total stays at or under its ceiling', () => {
    expect(routeCoverage.uncovered.length).toBeLessThanOrEqual(ROUTE_COVERAGE_CEILING);
  });

  it('and the ceiling is not left stale after the work lands', () => {
    // A ratchet only ratchets if it tightens. Slack, rather than exact equality,
    // so adding one covered route does not force a doc edit.
    expect(routeCoverage.uncovered.length).toBeGreaterThan(ROUTE_COVERAGE_CEILING - ROUTE_COVERAGE_SLACK);
  });
});

describe('F8 — this gate does not blind the scan it guards', () => {
  it('🔴 names no API route paths of its own', () => {
    // `__tests__/**` is the jest corpus route-coverage reads. A route URL in
    // this file would mark that route covered and lower the number the file
    // exists to protect — the same shape as the ledger that blinded
    // caller-absence twice. Checked mechanically, not remembered.
    //
    // 🔴 The pattern is assembled rather than written out, because a literal
    // here IS the thing being banned. The first version of this line failed on
    // itself — the same trap the SSE segment-config check documented.
    const banned = new RegExp(`['"\`]/${'api'}/`, 'g');
    const own = readFileSync(__filename, 'utf8');
    expect(own.match(banned) ?? []).toEqual([]);
  });
});
