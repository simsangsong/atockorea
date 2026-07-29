/**
 * 🔴 The K4 coverage ledger cannot go stale.
 *
 * A coverage report is only worth anything if "everything is covered" stays
 * true as routes are added. Two failure modes, and this file blocks both:
 *
 *   1. A NEW route appears and nobody classifies it. The run then silently
 *      never touches it, and the report still says 100%.
 *   2. A route is DELETED and its declaration lingers. The report then claims
 *      coverage of something that does not exist.
 *
 * The doc is a build artifact, so it is checked byte-for-byte rather than
 * spot-checked — a hand edit is itself a defect, because the next generation
 * silently reverts it.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  K4_DECLARATIONS,
  K4_JOIN_PATH,
  K4_NOT_MEASURED,
  K4_ROOMS,
  assignRooms,
  buildLedger,
  collectK4Pairs,
  key,
  parseRouteMethods,
  renderLedgerMarkdown,
  routePathFromFile,
  summarize,
} from '@/lib/audit/k4Coverage';

const ROOT = path.resolve(__dirname, '..', '..');
const pairs = collectK4Pairs(ROOT);

describe('the scanner actually read the repo', () => {
  it('found the tour-room and tour-mode route trees', () => {
    // A path typo here would make every assertion below vacuously pass.
    expect(pairs.length).toBeGreaterThan(40);
    expect(pairs.some((p) => p.path.startsWith('/api/tour-rooms/'))).toBe(true);
    expect(pairs.some((p) => p.path.startsWith('/api/tour-mode/'))).toBe(true);
  });

  it('parses both export forms and ignores commented-out handlers', () => {
    expect(parseRouteMethods('export async function GET() {}')).toEqual(['GET']);
    expect(parseRouteMethods('export function POST() {}')).toEqual(['POST']);
    expect(parseRouteMethods('export const PATCH = handler;')).toEqual(['PATCH']);
    expect(parseRouteMethods('export async function GET(){}\nexport async function POST(){}')).toEqual([
      'GET',
      'POST',
    ]);
    // A route that documents a handler it no longer has must not be counted.
    expect(parseRouteMethods('// export async function DELETE() {}')).toEqual([]);
    expect(parseRouteMethods('/* export async function DELETE() {} */')).toEqual([]);
    // GETTER / POSTAL must not match on a word-boundary-free regex.
    expect(parseRouteMethods('export async function GETTER() {}')).toEqual([]);
  });

  it('maps a route file to its API path', () => {
    expect(routePathFromFile('app/api/tour-rooms/[bookingId]/join/route.ts')).toBe(
      '/api/tour-rooms/[bookingId]/join',
    );
    expect(routePathFromFile('app\\api\\tour-mode\\bookings\\route.ts')).toBe(
      '/api/tour-mode/bookings',
    );
  });
});

describe('🔴 every discovered pair is declared', () => {
  it('has no unclassified route', () => {
    const missing = pairs.filter((p) => !K4_DECLARATIONS[key(p)]).map(key);
    // The message matters more than the assertion: whoever added the route
    // needs to know they must decide actor, cost, and skip-or-not.
    expect(missing).toEqual([]);
  });

  it('has no declaration for a route that no longer exists', () => {
    const live = new Set(pairs.map(key));
    const stale = Object.keys(K4_DECLARATIONS).filter((k) => !live.has(k));
    expect(stale).toEqual([]);
  });

  it('builds without throwing and covers every pair exactly once', () => {
    const rows = buildLedger(pairs, K4_ROOMS);
    expect(rows).toHaveLength(pairs.length);
    expect(new Set(rows.map(key)).size).toBe(rows.length);
  });
});

describe('skips are results, not omissions', () => {
  const rows = buildLedger(pairs, K4_ROOMS);

  it('every skipped pair states a reason', () => {
    for (const row of rows.filter((r) => r.skip)) {
      expect(String(row.skip).length).toBeGreaterThan(20);
    }
  });

  it('a skipped pair gets no room, and a run pair always does', () => {
    for (const row of rows) {
      if (row.skip) expect(row.room).toBeNull();
      else expect(typeof row.room).toBe('number');
    }
  });

  /**
   * The owner's decision, pinned. `POST /sos` reaches an on-call human; this
   * autonomous run must not ring it, and the reason must be printed rather than
   * the row quietly vanishing.
   */
  it('POST /sos is the people-tier pair and is skipped by design', () => {
    const sos = rows.find((r) => r.path.endsWith('/sos') && r.method === 'POST');
    expect(sos).toBeDefined();
    expect(sos!.tier).toBe('people');
    expect(sos!.skip).toMatch(/SKIPPED BY DESIGN/);
    expect(rows.filter((r) => r.tier === 'people')).toHaveLength(1);
  });
});

describe('room assignment is deterministic', () => {
  it('produces the same layout twice — a coverage report you cannot reproduce cannot be bisected', () => {
    const a = assignRooms(pairs, K4_ROOMS);
    const b = assignRooms(pairs, K4_ROOMS);
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });

  it('sends every room through join, because join is the door', () => {
    expect(assignRooms(pairs, K4_ROOMS).get(K4_JOIN_PATH)).toBe(0);
  });

  it('spreads the rest across all rooms without exceeding the room count', () => {
    const assigned = [...assignRooms(pairs, K4_ROOMS).values()].filter(
      (v): v is number => typeof v === 'number' && v > 0,
    );
    expect(Math.min(...assigned)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...assigned)).toBeLessThanOrEqual(K4_ROOMS);
    // With 50+ pairs over 20 rooms, every room must get work.
    expect(new Set(assigned).size).toBe(K4_ROOMS);
  });
});

describe('the report says what it did not measure', () => {
  it('names the load properties a sequential route sweep cannot reach', () => {
    expect(K4_NOT_MEASURED.length).toBeGreaterThanOrEqual(3);
    const text = JSON.stringify(K4_NOT_MEASURED);
    // The two §K walls that a green route sweep would otherwise imply are fine.
    expect(text).toMatch(/realtime/i);
    expect(text).toMatch(/SSE/i);
    for (const item of K4_NOT_MEASURED) {
      expect(item.why.length).toBeGreaterThan(40);
    }
  });

  it('renders them into the document, not just into the module', () => {
    const md = renderLedgerMarkdown(buildLedger(pairs, K4_ROOMS), K4_ROOMS);
    for (const item of K4_NOT_MEASURED) {
      expect(md).toContain(item.what);
    }
  });
});

describe('🔴 docs/audit/K4-coverage.md is not stale', () => {
  const OUT = path.join(ROOT, 'docs', 'audit', 'K4-coverage.md');

  it('exists', () => {
    expect(fs.existsSync(OUT)).toBe(true);
  });

  it('matches what the generator would write, byte for byte', () => {
    const expected = renderLedgerMarkdown(buildLedger(pairs, K4_ROOMS), K4_ROOMS);
    const actual = fs.readFileSync(OUT, 'utf8');
    if (actual !== expected) {
      throw new Error('K4-coverage.md is stale — run: npx tsx scripts/gen-k4-coverage.ts');
    }
    expect(actual).toBe(expected);
  });

  it('reports a count that matches the tree', () => {
    const s = summarize(buildLedger(pairs, K4_ROOMS));
    expect(fs.readFileSync(OUT, 'utf8')).toContain(`**${s.total}**`);
  });
});
