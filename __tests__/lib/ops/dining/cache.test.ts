/**
 * Cell cache — the zero-call contract (§5.7 R-3, spec K4).
 *
 * The property that pays for this whole design: a collected, unexpired cell
 * NEVER calls Kakao or Google again, however few restaurants it holds. The
 * counter-design ("HIT when ≥10 rows are cached") is exactly what K4 rejects,
 * so the three-restaurant cell test below is the regression guard for it.
 *
 * The supabase client is a hand-rolled chainable stub — same approach as the
 * other lib/ops suites, and it keeps the assertions about OUR logic rather than
 * postgrest's.
 */

import {
  DEFAULT_RADIUS_M,
  applyFeedbackScores,
  cellFor,
  collectCell,
  readCellCache,
  rowToCachedPlace,
} from '@/lib/ops/dining/cache.server';
import type { RoomDbClient } from '@/lib/tour-room/access';

const CENTER = { lat: 33.4586, lng: 126.9425 };

interface StubResult {
  data: unknown;
  error?: unknown;
}

type Resolver = (table: string, calls: Array<[string, unknown]>) => StubResult;

/** Minimal postgrest-shaped chainable stub. Every builder call is recorded. */
function stubClient(resolver: Resolver): { client: RoomDbClient; tables: string[] } {
  const tables: string[] = [];

  function builder(table: string) {
    const calls: Array<[string, unknown]> = [];
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'lt', 'gt', 'limit', 'order', 'update', 'upsert', 'delete']) {
      chain[method] = (...args: unknown[]) => {
        calls.push([method, args]);
        return chain;
      };
    }
    chain.maybeSingle = () => Promise.resolve(resolver(table, calls));
    chain.single = () => Promise.resolve(resolver(table, calls));
    chain.then = (onFulfilled: (value: StubResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(resolver(table, calls)).then(onFulfilled, onRejected);
    return chain;
  }

  return {
    client: {
      from(table: string) {
        tables.push(table);
        return builder(table);
      },
    } as RoomDbClient,
    tables,
  };
}

function placeRow(overrides: Record<string, unknown> = {}) {
  return {
    place_key: 'kakao:1',
    cell: cellFor(CENTER.lat, CENTER.lng),
    search_cells: ['wvfq2du'],
    name: '올레국수',
    name_i18n: { en: 'Olle Guksu' },
    category_group: 'FD6',
    category_name: '음식점 > 한식 > 국수',
    cuisine: '국수',
    place_url: 'http://place.map.kakao.com/1',
    // postgrest hands numerics back as strings — the row mapper must cope.
    lat: String(CENTER.lat),
    lng: String(CENTER.lng),
    rating: '4.4',
    review_count: 312,
    price_band: '2',
    tags: ['dine_in'],
    signature_menus: [{ name: '고기국수' }],
    open_hours: null,
    quality_score: '11.0',
    is_blocked: false,
    is_closed: false,
    reported_wrong_count: 0,
    expires_at: '2099-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const FUTURE = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
const PAST = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

describe('cellFor', () => {
  it('is the geohash7 of the point', () => {
    expect(cellFor(CENTER.lat, CENTER.lng)).toHaveLength(7);
    expect(cellFor(CENTER.lat, CENTER.lng)).toBe(cellFor(CENTER.lat + 0.00001, CENTER.lng));
  });
});

describe('rowToCachedPlace', () => {
  it('coerces postgrest numerics and defaults the optional columns', () => {
    const place = rowToCachedPlace(placeRow());
    expect(place).not.toBeNull();
    expect(place?.lat).toBeCloseTo(CENTER.lat, 6);
    expect(place?.rating).toBe(4.4);
    expect(place?.price_band).toBe(2);
    expect(place?.quality_score).toBe(11);
    expect(place?.tags).toEqual(['dine_in']);
  });

  it('rejects rows that cannot be rendered (no key, no deep link, no coords)', () => {
    expect(rowToCachedPlace(placeRow({ place_key: null }))).toBeNull();
    expect(rowToCachedPlace(placeRow({ place_url: '' }))).toBeNull();
    expect(rowToCachedPlace(placeRow({ lat: 'not-a-number' }))).toBeNull();
  });

  it('keeps a null rating as null rather than 0', () => {
    expect(rowToCachedPlace(placeRow({ rating: null, review_count: null }))?.rating).toBeNull();
  });
});

describe('readCellCache', () => {
  it('HITs on a live cell index row and returns distance-annotated places', async () => {
    const { client } = stubClient((table) =>
      table === 'ops_kakao_cell_index'
        ? { data: { cell: cellFor(CENTER.lat, CENTER.lng), expires_at: FUTURE, place_count: 3 } }
        : { data: [placeRow()] },
    );

    const result = await readCellCache(client, { lat: CENTER.lat, lng: CENTER.lng });
    expect(result.hit).toBe(true);
    expect(result.places).toHaveLength(1);
    expect(result.places[0].distance_m).toBe(0);
  });

  it('🔴 K4: HIT is decided by the index row, not by how many places exist', async () => {
    // A rural cell with a single restaurant is still a HIT — the count-based
    // rule this replaces would have re-swept Kakao on every request forever.
    const { client } = stubClient((table) =>
      table === 'ops_kakao_cell_index'
        ? { data: { cell: 'wvfq2du', expires_at: FUTURE, place_count: 1 } }
        : { data: [placeRow()] },
    );
    await expect(readCellCache(client, { lat: CENTER.lat, lng: CENTER.lng })).resolves.toMatchObject({ hit: true });

    // …and even zero places is a HIT ("we looked here, there is nothing").
    const empty = stubClient((table) =>
      table === 'ops_kakao_cell_index' ? { data: { cell: 'wvfq2du', expires_at: FUTURE } } : { data: [] },
    );
    await expect(readCellCache(empty.client, { lat: CENTER.lat, lng: CENTER.lng })).resolves.toEqual({
      hit: true,
      places: [],
      index: expect.anything(),
    });
  });

  it('MISSes when the cell was never collected or has expired', async () => {
    const never = stubClient((table) => (table === 'ops_kakao_cell_index' ? { data: null } : { data: [] }));
    await expect(readCellCache(never.client, { lat: CENTER.lat, lng: CENTER.lng })).resolves.toMatchObject({
      hit: false,
      places: [],
    });

    const expired = stubClient((table) =>
      table === 'ops_kakao_cell_index' ? { data: { cell: 'wvfq2du', expires_at: PAST } } : { data: [placeRow()] },
    );
    await expect(readCellCache(expired.client, { lat: CENTER.lat, lng: CENTER.lng })).resolves.toMatchObject({
      hit: false,
    });
  });

  it('applies the exact haversine filter over the approximate cell set', async () => {
    // A row that lives in a returned cell but sits outside the radius must be
    // dropped — the cell set is only an index-friendly approximation.
    const far = placeRow({ place_key: 'kakao:far', lat: String(CENTER.lat + 0.05), lng: String(CENTER.lng) });
    const { client } = stubClient((table) =>
      table === 'ops_kakao_cell_index'
        ? { data: { cell: 'wvfq2du', expires_at: FUTURE } }
        : { data: [placeRow(), far] },
    );
    const result = await readCellCache(client, { lat: CENTER.lat, lng: CENTER.lng, radiusM: DEFAULT_RADIUS_M });
    expect(result.places.map((p) => p.place_key)).toEqual(['kakao:1']);
  });

  it('degrades to a MISS instead of throwing when the DB errors', async () => {
    const client = {
      from() {
        throw new Error('db down');
      },
    } as unknown as RoomDbClient;
    await expect(readCellCache(client, { lat: CENTER.lat, lng: CENTER.lng })).resolves.toEqual({
      hit: false,
      places: [],
      index: null,
    });
  });
});

describe('collectCell', () => {
  const originalKey = process.env.KAKAO_REST_API_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.KAKAO_REST_API_KEY;
    else process.env.KAKAO_REST_API_KEY = originalKey;
  });

  it('🔴 makes no external call and touches no table without a Kakao key', async () => {
    delete process.env.KAKAO_REST_API_KEY;
    const { client, tables } = stubClient(() => ({ data: null }));
    await expect(collectCell(client, { lat: CENTER.lat, lng: CENTER.lng })).resolves.toEqual({
      hit: false,
      places: [],
    });
    expect(tables).toEqual([]);
  });

  it('returns a miss shape for unusable coordinates', async () => {
    const { client } = stubClient(() => ({ data: null }));
    await expect(collectCell(client, { lat: Number.NaN, lng: CENTER.lng })).resolves.toEqual({
      hit: false,
      places: [],
    });
  });

  it('🔴 never records a REFUSED sweep as an empty area', async () => {
    // The measured incident (2026-07-25): Kakao answered "API limit has been
    // exceeded" (HTTP 400, code -10), the fetch helper returned [], and
    // collectCell happily wrote place_count: 0 with a 90-day TTL. Four real
    // Jeju tourist areas — Cheonjeyeon Falls, Camellia Hill, Osulloc, Hallasan
    // 1100 Wetland — were cached as restaurant-free until October off the back
    // of a transient quota error. Nothing may be written when the sweep failed.
    process.env.KAKAO_REST_API_KEY = 'test-key';
    const realFetch = globalThis.fetch;
    const fetchSpy = jest.fn(async () =>
      new Response('{"errorType":"BadRequest","message":"API limit has been exceeded.","code":-10}', {
        status: 400,
      }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    try {
      const { client, tables } = stubClient(() => ({ data: null }));
      await expect(collectCell(client, { lat: CENTER.lat, lng: CENTER.lng })).resolves.toEqual({
        hit: false,
        places: [],
      });
      // The cell must stay COLD so the next request retries it.
      expect(tables).toEqual([]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('does not widen the radius after a refused sweep', async () => {
    // Widening spends two more calls that will be refused for the same reason.
    process.env.KAKAO_REST_API_KEY = 'test-key';
    const realFetch = globalThis.fetch;
    const fetchSpy = jest.fn(async () => new Response('{"code":-10}', { status: 400 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    try {
      const { client } = stubClient(() => ({ data: null }));
      await collectCell(client, { lat: CENTER.lat, lng: CENTER.lng });
      // FD6 + CE7 at the initial radius only — no widened second sweep.
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe('applyFeedbackScores', () => {
  it('folds the recommendation ledger into per-place aggregates', () => {
    const aggregates = applyFeedbackScores([
      { place_key: 'kakao:1', tapped_at: '2026-07-20T00:00:00Z', visited_at: null, feedback: null },
      { place_key: 'kakao:1', tapped_at: '2026-07-21T00:00:00Z', visited_at: '2026-07-21T01:00:00Z', feedback: 'good' },
      { place_key: 'kakao:2', tapped_at: null, visited_at: null, feedback: 'wrong' },
      { place_key: 'kakao:2', tapped_at: null, visited_at: null, feedback: 'closed' },
    ]);
    expect(aggregates['kakao:1']).toEqual({ tapped: 2, visited: 1, wrong: 0 });
    expect(aggregates['kakao:2']).toEqual({ tapped: 0, visited: 0, wrong: 2 });
  });

  it('ignores rows without a place_key and non-array input', () => {
    expect(applyFeedbackScores([{ feedback: 'wrong' }])).toEqual({});
    expect(applyFeedbackScores(null)).toEqual({});
    expect(applyFeedbackScores(undefined)).toEqual({});
  });
});
