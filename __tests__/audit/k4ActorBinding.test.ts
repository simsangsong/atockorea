/**
 * @jest-environment node
 *
 * 🔴 FA-019 + FA-023 (full-app audit 2026-07-30) — the ledger's actor column had
 * no gate, and "covered 55" was really 53.
 *
 * `k4Coverage.test.ts` guards pair completeness, deletions, skip reasons, room
 * assignment and doc/source sync. It says nothing about `actor`, and
 * `scripts/k4-run.ts` never reads `declaration.actor` — each pair hardcodes its
 * own credential. So a label could disagree with what the run actually sent,
 * forever, in green. Three did:
 *
 *   POST /extend             labelled guide → the route allows customer/guide/
 *                            admin and refuses the driver, so the GUEST path (a
 *                            guest buying their own extra time) was never driven.
 *   POST /driver/link        labelled admin → the harness sends the GUIDE token,
 *                            in the same repo, three lines away.
 *   GET  /tour-mode/bookings labelled admin → filters `user_id = user.id`; it is
 *                            "my bookings", and the harness holds no login.
 *
 * Two invariants now hold the column honest:
 *
 *   1. every covered pair travels with the credential its actor names — in the
 *      header, the query string or the body, since those routes differ in how
 *      they accept one
 *   2. every pair the run is expected to cover HAS a request — the two SG-4/SG-5
 *      photo routes were declared and unwritten, and the run printed
 *      `UNWRITTEN 2` while every gate stayed green. Printing is not failing.
 *
 * The harness is read as TEXT on purpose: importing it would execute a runner
 * that talks to a dev server and the live database.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { K4_DECLARATIONS, K4_ROOMS, buildLedger, collectK4Pairs } from '@/lib/audit/k4Coverage';

const HARNESS = readFileSync(path.join(process.cwd(), 'scripts', 'k4-run.ts'), 'utf8');

/** The join pair is driven by `joinAll`, not by a SPECS entry (all 20 rooms). */
const JOIN_KEY = 'POST /api/tour-rooms/[bookingId]/join';

/**
 * The ledger the generator and the run both build.
 *
 * ⚠ Non-vacuity is asserted HERE, not left to the cases. The first version of
 * this suite passed everything while this returned an empty array — a gate that
 * measures nothing is worse than no gate, because it reads as proof. (It failed
 * because `collectK4Pairs` takes the repo root and walks the route trees itself.)
 */
function ledger() {
  const rows = buildLedger(collectK4Pairs(path.resolve(__dirname, '..', '..')), K4_ROOMS);
  if (rows.length < 50) {
    throw new Error(`the ledger collected only ${rows.length} pairs — expected ~56; the root did not resolve`);
  }
  return rows;
}

/** The body of one SPECS entry, or null when the pair has no request at all. */
function specBody(key: string): string | null {
  const at = HARNESS.indexOf(`'${key}': {`);
  if (at < 0) return null;
  const end = HARNESS.indexOf('\n  },', at);
  return HARNESS.slice(at, end < 0 ? HARNESS.length : end);
}

/**
 * Which actor the harness actually authenticates as for this pair.
 *
 * Credentials do not all ride in headers: `guide/overview` takes `?rt=`,
 * `driver/link` takes a body token, and admin pairs use a Bearer header. Reading
 * only `headers:` called five correctly-driven pairs mismatched — the extractor
 * has to look at the whole entry.
 */
function harnessActorFor(key: string): string | null {
  const body = specBody(key);
  if (body === null) return null;
  if (/adminH|[Bb]earer|authorization/.test(body)) return 'admin';
  if (/driverH|driverToken|c\.driver\b/.test(body)) return 'driver';
  if (/guideH|guideToken|c\.guide\b/.test(body)) return 'guide';
  if (/guestH|room\.session/.test(body)) return 'guest';
  return 'public';
}

describe('FA-019 — the ledger actor and the credential the run sends agree', () => {
  it('🔴 every covered pair travels as the actor it declares', () => {
    const mismatched: string[] = [];
    for (const row of ledger()) {
      if (row.skip) continue;
      const key = `${row.method} ${row.path}`;
      if (key === JOIN_KEY) continue;
      const sent = harnessActorFor(key);
      if (sent === null) continue; // FA-023's business, not this case's
      if (sent !== row.actor) {
        mismatched.push(`${key}\n    ledger says '${row.actor}', the run authenticates as '${sent}'`);
      }
    }
    expect(mismatched.join('\n\n')).toBe('');
  });

  it('🔴 every declared actor is one this gate knows how to check', () => {
    const known = ['guest', 'guide', 'driver', 'admin', 'public'];
    const rows = Object.entries(K4_DECLARATIONS);
    expect(rows.length).toBeGreaterThan(50);
    for (const [, decl] of rows) expect(known).toContain(decl.actor);
  });
});

describe('FA-023 — a declared pair with no request is a failure, not a footnote', () => {
  it('🔴 every non-skipped pair has a request in the harness', () => {
    const unwritten = ledger()
      .filter((row) => !row.skip)
      .map((row) => `${row.method} ${row.path}`)
      .filter((key) => key !== JOIN_KEY && specBody(key) === null);

    expect(unwritten).toEqual([]);
  });

  it('the join pair is covered by joinAll rather than a SPECS entry', () => {
    // Exempted above, so prove the exemption is real instead of assumed.
    expect(HARNESS).toContain('joinAll');
    expect(HARNESS).toContain(JOIN_KEY);
  });

  it('a skipped pair states why, so silence is never the reason', () => {
    for (const row of ledger()) {
      if (!row.skip) continue;
      expect(row.skip.length).toBeGreaterThan(20);
    }
  });
});
