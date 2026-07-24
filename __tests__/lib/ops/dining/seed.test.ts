/**
 * Seed planning (§5.7 R-8).
 *
 * Everything here decides how external quota gets spent, so every case is a
 * closed-form assertion over injected inputs: no clock, no env, no `cellFor`
 * from the io layer (it is injected, so a cell is whatever the test says).
 * The failures this pins are the expensive ones — re-collecting a warm cell,
 * collecting the same cell twice in one run, and running past the 70 % brake.
 */

import {
  DEFAULT_SEED_LIMIT,
  parseSeedArgs,
  planSeed,
  poiLabel,
  resolveSeedLimit,
  seedCandidates,
  shouldAbortForQuota,
  visitCountsFromStops,
  type SeedPoiRow,
} from '@/lib/ops/dining/seed';

/** Cells are the identity under test, so make them trivially predictable. */
const cellFor = (lat: number, lng: number) => `c${lat.toFixed(2)}_${lng.toFixed(2)}`;

function poi(overrides: Partial<SeedPoiRow> & { poi_key: string }): SeedPoiRow {
  return {
    name_ko: null,
    name_en: null,
    region: 'jeju',
    lat: 33.5,
    lng: 126.5,
    is_attraction: true,
    stop_role: null,
    is_operational: false,
    ...overrides,
  };
}

describe('visitCountsFromStops', () => {
  it('counts appearances per poi_key and ignores junk rows', () => {
    const counts = visitCountsFromStops([
      { poi_key: 'seongsan' },
      { poi_key: 'seongsan' },
      { poi_key: 'manjanggul' },
      { poi_key: '' },
      { poi_key: null },
      {},
    ]);
    expect(counts).toEqual({ seongsan: 2, manjanggul: 1 });
  });

  it('survives a null/undefined result set', () => {
    expect(visitCountsFromStops(null)).toEqual({});
    expect(visitCountsFromStops(undefined)).toEqual({});
  });
});

describe('poiLabel', () => {
  it('prefers Korean, then English, then the key', () => {
    expect(poiLabel(poi({ poi_key: 'a', name_ko: '성산일출봉', name_en: 'Seongsan' }))).toBe('성산일출봉');
    expect(poiLabel(poi({ poi_key: 'a', name_en: 'Seongsan' }))).toBe('Seongsan');
    expect(poiLabel(poi({ poi_key: 'a' }))).toBe('a');
  });
});

describe('seedCandidates — filtering', () => {
  it('keeps only the requested region', () => {
    const rows = [poi({ poi_key: 'jeju_a' }), poi({ poi_key: 'busan_a', region: 'busan' })];
    const out = seedCandidates(rows, { region: 'jeju' }, cellFor);
    expect(out.map((c) => c.poi_key)).toEqual(['jeju_a']);
  });

  it('matches the region case-insensitively', () => {
    const rows = [poi({ poi_key: 'a', region: 'Jeju' })];
    expect(seedCandidates(rows, { region: 'jeju' }, cellFor)).toHaveLength(1);
  });

  it('excludes OPS_ logistics rows — they are never meal stops', () => {
    const rows = [poi({ poi_key: 'seongsan' }), poi({ poi_key: 'OPS_jeju_airport', is_operational: true })];
    const out = seedCandidates(rows, { region: 'jeju' }, cellFor);
    expect(out.map((c) => c.poi_key)).toEqual(['seongsan']);
  });

  it('drops rows without usable coordinates', () => {
    const rows = [
      poi({ poi_key: 'ok' }),
      poi({ poi_key: 'no_lat', lat: null }),
      poi({ poi_key: 'no_lng', lng: null }),
      poi({ poi_key: 'nan', lat: 'not-a-number' }),
    ];
    expect(seedCandidates(rows, { region: 'jeju' }, cellFor).map((c) => c.poi_key)).toEqual(['ok']);
  });

  it('accepts numeric coordinates that arrive as strings from postgrest', () => {
    const out = seedCandidates([poi({ poi_key: 'a', lat: '33.25', lng: '126.42' })], { region: 'jeju' }, cellFor);
    expect(out[0].lat).toBeCloseTo(33.25);
    expect(out[0].cell).toBe('c33.25_126.42');
  });
});

describe('seedCandidates — ordering', () => {
  it('puts the most-visited POIs first (the §R-8 방문빈도 signal)', () => {
    const rows = [poi({ poi_key: 'rare' }), poi({ poi_key: 'popular' }), poi({ poi_key: 'mid' })];
    const out = seedCandidates(
      rows,
      { region: 'jeju', visitCounts: { popular: 6, mid: 3, rare: 0 } },
      cellFor,
    );
    expect(out.map((c) => c.poi_key)).toEqual(['popular', 'mid', 'rare']);
    expect(out[0].visits).toBe(6);
  });

  it('breaks a visit tie with stop_role, then is_attraction, then poi_key', () => {
    const rows = [
      poi({ poi_key: 'z_plain', is_attraction: false }),
      poi({ poi_key: 'b_attraction' }),
      poi({ poi_key: 'a_stop', stop_role: 'attraction' }),
      poi({ poi_key: 'a_plain', is_attraction: false }),
    ];
    const out = seedCandidates(rows, { region: 'jeju' }, cellFor);
    expect(out.map((c) => c.poi_key)).toEqual(['a_stop', 'b_attraction', 'a_plain', 'z_plain']);
  });

  it('is deterministic — two runs plan identically', () => {
    const rows = [poi({ poi_key: 'c' }), poi({ poi_key: 'a' }), poi({ poi_key: 'b' })];
    const first = seedCandidates(rows, { region: 'jeju' }, cellFor).map((c) => c.poi_key);
    const second = seedCandidates([...rows].reverse(), { region: 'jeju' }, cellFor).map((c) => c.poi_key);
    expect(first).toEqual(second);
  });
});

describe('seedCandidates — explicit --poi', () => {
  it('honours the caller order and ignores the region filter', () => {
    const rows = [poi({ poi_key: 'jeju_a' }), poi({ poi_key: 'busan_b', region: 'busan' })];
    const out = seedCandidates(rows, { region: 'jeju', poiKeys: ['busan_b', 'jeju_a'] }, cellFor);
    expect(out.map((c) => c.poi_key)).toEqual(['busan_b', 'jeju_a']);
  });

  it('silently drops named keys that are not in the catalogue', () => {
    const out = seedCandidates([poi({ poi_key: 'real' })], { poiKeys: ['real', 'ghost'] }, cellFor);
    expect(out.map((c) => c.poi_key)).toEqual(['real']);
  });

  it('still takes an explicitly named OPS_ row — that is the operator asking', () => {
    const rows = [poi({ poi_key: 'OPS_hotel', is_operational: true })];
    expect(seedCandidates(rows, { poiKeys: ['OPS_hotel'] }, cellFor)).toHaveLength(1);
  });
});

describe('planSeed — skips', () => {
  const candidates = [
    { poi_key: 'a', label: 'A', lat: 33.1, lng: 126.1, cell: 'cell-a', visits: 3 },
    { poi_key: 'b', label: 'B', lat: 33.2, lng: 126.2, cell: 'cell-b', visits: 2 },
    { poi_key: 'c', label: 'C', lat: 33.3, lng: 126.3, cell: 'cell-c', visits: 1 },
  ];

  it('skips a cell that is already cached, with the expiry for the log', () => {
    const plan = planSeed(candidates, { cachedCells: { 'cell-b': '2026-10-01T00:00:00Z' } });
    expect(plan.collect.map((t) => t.poi_key)).toEqual(['a', 'c']);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0]).toMatchObject({ poi_key: 'b', skip: 'cached', cachedUntil: '2026-10-01T00:00:00Z' });
  });

  it('re-collects a cached cell under --force', () => {
    const plan = planSeed(candidates, { cachedCells: { 'cell-b': '2026-10-01T00:00:00Z' }, force: true });
    expect(plan.collect.map((t) => t.poi_key)).toEqual(['a', 'b', 'c']);
    expect(plan.skipped).toHaveLength(0);
  });

  it('collects a cell only once when two POIs share it', () => {
    const shared = [
      { poi_key: 'a', label: 'A', lat: 33.1, lng: 126.1, cell: 'same', visits: 3 },
      { poi_key: 'b', label: 'B', lat: 33.1, lng: 126.1, cell: 'same', visits: 2 },
    ];
    const plan = planSeed(shared, {});
    expect(plan.collect.map((t) => t.poi_key)).toEqual(['a']);
    expect(plan.skipped[0]).toMatchObject({ poi_key: 'b', skip: 'duplicate-cell' });
  });

  it('does not re-collect a cached cell that a later POI also maps to', () => {
    const shared = [
      { poi_key: 'a', label: 'A', lat: 33.1, lng: 126.1, cell: 'same', visits: 3 },
      { poi_key: 'b', label: 'B', lat: 33.1, lng: 126.1, cell: 'same', visits: 2 },
    ];
    const plan = planSeed(shared, { cachedCells: { same: null } });
    expect(plan.collect).toHaveLength(0);
    expect(plan.skipped.map((t) => t.skip)).toEqual(['cached', 'duplicate-cell']);
  });
});

describe('planSeed — limit', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({
    poi_key: `p${i}`,
    label: `P${i}`,
    lat: 33 + i / 100,
    lng: 126,
    cell: `cell-${i}`,
    visits: 10 - i,
  }));

  it('caps the number of cells collected', () => {
    const plan = planSeed(many, { limit: 3 });
    expect(plan.collect).toHaveLength(3);
    expect(plan.collect.map((t) => t.poi_key)).toEqual(['p0', 'p1', 'p2']);
  });

  it('does NOT let a skipped cell consume the budget', () => {
    // p0 and p1 are warm; a limit of 3 must still collect three cold cells,
    // otherwise a second pass over a seeded catalogue collects almost nothing.
    const plan = planSeed(many, { limit: 3, cachedCells: { 'cell-0': null, 'cell-1': null } });
    expect(plan.collect.map((t) => t.poi_key)).toEqual(['p2', 'p3', 'p4']);
    expect(plan.skipped.map((t) => t.poi_key)).toEqual(['p0', 'p1']);
  });

  it('falls back to the §R-8 default of 30', () => {
    expect(planSeed(many, {}).limit).toBe(DEFAULT_SEED_LIMIT);
    expect(planSeed(many, { limit: 0 }).limit).toBe(DEFAULT_SEED_LIMIT);
    expect(planSeed(many, { limit: null }).limit).toBe(DEFAULT_SEED_LIMIT);
  });

  it('handles an empty candidate set', () => {
    expect(planSeed([], {}).collect).toHaveLength(0);
    expect(planSeed(null, {}).collect).toHaveLength(0);
  });
});

describe('shouldAbortForQuota', () => {
  it('stops at or above the threshold', () => {
    expect(shouldAbortForQuota(0.7, 0.7)).toBe(true);
    expect(shouldAbortForQuota(0.95, 0.7)).toBe(true);
  });

  it('runs below it', () => {
    expect(shouldAbortForQuota(0.69, 0.7)).toBe(false);
    expect(shouldAbortForQuota(0, 0.7)).toBe(false);
  });

  it('never aborts on an unreadable counter — a broken read must not block seeding', () => {
    expect(shouldAbortForQuota(NaN, 0.7)).toBe(false);
    expect(shouldAbortForQuota(0.9, 0)).toBe(false);
  });
});

describe('parseSeedArgs', () => {
  it('defaults to a dry run over the pilot region', () => {
    const opts = parseSeedArgs([]);
    expect(opts).toMatchObject({ dry: true, apply: false, force: false, region: 'jeju', limit: null, radiusM: null });
    expect(opts.poiKeys).toEqual([]);
  });

  it('collects only with --apply', () => {
    expect(parseSeedArgs(['--apply'])).toMatchObject({ dry: false, apply: true });
  });

  it('lets an explicit --dry veto --apply — quota is never spent by accident', () => {
    expect(parseSeedArgs(['--apply', '--dry'])).toMatchObject({ dry: true, apply: false });
  });

  it('reads --limit / --radius / --region / --force', () => {
    const opts = parseSeedArgs(['--limit=5', '--radius=1500', '--region=busan', '--force']);
    expect(opts).toMatchObject({ limit: 5, radiusM: 1500, region: 'busan', force: true });
  });

  it('ignores a non-positive --limit rather than collecting nothing silently', () => {
    expect(parseSeedArgs(['--limit=0']).limit).toBeNull();
    expect(parseSeedArgs(['--limit=abc']).limit).toBeNull();
  });

  it('accepts --poi repeated and comma-separated', () => {
    expect(parseSeedArgs(['--poi=a,b', '--poi=c']).poiKeys).toEqual(['a', 'b', 'c']);
    expect(parseSeedArgs(['--poi= a , b ']).poiKeys).toEqual(['a', 'b']);
  });
});

describe('resolveSeedLimit', () => {
  it('uses an explicit --limit above everything', () => {
    expect(resolveSeedLimit({ limit: 5, poiKeys: ['a', 'b'] })).toBe(5);
  });

  it('defaults to the number of named POIs, so --poi collects all of them', () => {
    expect(resolveSeedLimit({ limit: null, poiKeys: ['a', 'b', 'c'] })).toBe(3);
  });

  it('otherwise uses the §R-8 default', () => {
    expect(resolveSeedLimit({ limit: null, poiKeys: [] })).toBe(DEFAULT_SEED_LIMIT);
  });
});
