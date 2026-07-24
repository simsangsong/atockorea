/**
 * @jest-environment node
 *
 * Admin dining-cache surface (§5.7 R-9).
 *
 * This is the only human control over a cache that has no per-row review gate
 * (spec K6), so the cases that matter are: nobody unauthenticated gets in, each
 * action reaches slice A's helper with the right arguments, the one action that
 * spends quota cannot fire without an explicit confirm, and the stats do not
 * count the `rank = 0` sentinel as an impression.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET as overviewGET } from '@/app/api/admin/dining-cache/route';
import { GET as cellGET, POST as cellPOST } from '@/app/api/admin/dining-cache/cells/[cell]/route';
import { PATCH as placePATCH } from '@/app/api/admin/dining-cache/places/[placeKey]/route';
import { requireAdmin, AdminAuthFailure } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { blockPlace, collectCell, invalidateCell } from '@/lib/ops/dining/cache.server';
import { quotaState } from '@/lib/ops/dining/kakao.server';
import { googleQuotaState } from '@/lib/ops/dining/google.server';

jest.mock('@/lib/auth', () => {
  const { NextResponse } = require('next/server');
  class AdminAuthFailure extends Error {
    status: number;
    code: string;
    constructor(status: number, message: string, code = 'AUTH') {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return {
    requireAdmin: jest.fn(),
    AdminAuthFailure,
    adminAuthJsonResponse: (e: { code: string; message: string; status: number }) =>
      NextResponse.json({ ok: false, code: e.code, message: e.message }, { status: e.status }),
  };
});
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/ops/dining/cache.server', () => ({
  DEFAULT_RADIUS_M: 800,
  blockPlace: jest.fn(),
  collectCell: jest.fn(),
  invalidateCell: jest.fn(),
}));
jest.mock('@/lib/ops/dining/kakao.server', () => ({ quotaState: jest.fn() }));
jest.mock('@/lib/ops/dining/google.server', () => ({ googleQuotaState: jest.fn() }));

const requireAdminMock = requireAdmin as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const blockPlaceMock = blockPlace as jest.Mock;
const collectCellMock = collectCell as jest.Mock;
const invalidateCellMock = invalidateCell as jest.Mock;
const quotaStateMock = quotaState as jest.Mock;
const googleQuotaStateMock = googleQuotaState as jest.Mock;

// ---------------------------------------------------------------------------
// A supabase double that records the query it was asked for and lets the test
// answer per-query — the overview fires a dozen reads at three tables, so a
// single canned payload could not tell `rated_places` from `blocked_places`.
// ---------------------------------------------------------------------------

interface QueryState {
  table: string;
  columns: string;
  head: boolean;
  mutation: 'update' | null;
  patch: unknown;
  filters: Array<{ op: string; args: unknown[] }>;
}

type Resolver = (q: QueryState) => { data?: unknown; count?: number | null; error?: { message: string } | null };

function hasFilter(q: QueryState, op: string, first?: unknown): boolean {
  return q.filters.some((f) => f.op === op && (first === undefined || f.args[0] === first));
}

function fakeDb(resolve: Resolver) {
  const queries: QueryState[] = [];
  const client = {
    queries,
    from(table: string) {
      const q: QueryState = { table, columns: '', head: false, mutation: null, patch: null, filters: [] };
      queries.push(q);
      const settle = () => {
        const r = resolve(q);
        return { data: r.data ?? null, count: r.count ?? null, error: r.error ?? null };
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      chain.select = (cols?: string, opts?: { head?: boolean }) => {
        q.columns = cols ?? '';
        if (opts?.head) q.head = true;
        return chain;
      };
      for (const op of ['eq', 'gt', 'lt', 'not', 'in', 'or', 'contains', 'order', 'limit']) {
        chain[op] = (...args: unknown[]) => {
          q.filters.push({ op, args });
          return chain;
        };
      }
      chain.update = (patch: unknown) => {
        q.mutation = 'update';
        q.patch = patch;
        return chain;
      };
      chain.maybeSingle = async () => settle();
      chain.single = async () => settle();
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(settle()).then(res, rej);
      return chain;
    },
  };
  return client;
}

function req({ search = '', body }: { search?: string; body?: unknown } = {}) {
  return {
    nextUrl: { searchParams: new URLSearchParams(search) },
    json: async () => body,
  } as never;
}

const cellCtx = (cell: string) => ({ params: Promise.resolve({ cell }) });
const placeCtx = (placeKey: string) => ({ params: Promise.resolve({ placeKey }) });

const QUOTA = { used: 120, cap: 30_000, ratio: 0.004, shouldAlert: false, exhausted: false };
const GOOGLE_QUOTA = { used: 40, cap: 5_000, ratio: 0.008, shouldAlert: false, exhausted: false };

/** The default overview world: 2 cells, 10 places, a small feedback ledger. */
const overviewResolver: Resolver = (q) => {
  if (q.table === 'ops_kakao_cell_index') {
    if (q.head) return { count: 2 };
    return {
      data: [
        {
          cell: 'wvfq2du',
          center_lat: '33.45806',
          center_lng: '126.94250',
          radius_m: 800,
          place_count: 7,
          kakao_calls: 2,
          google_calls: 1,
          fetched_at: '2026-07-25T00:00:00Z',
          expires_at: '2026-10-23T00:00:00Z',
        },
      ],
    };
  }
  if (q.table === 'ops_kakao_place_cache') {
    if (q.head) {
      if (hasFilter(q, 'not', 'rating')) return { count: 8 };
      if (hasFilter(q, 'eq', 'is_blocked')) return { count: 1 };
      return { count: 10 };
    }
    return {
      data: [
        {
          place_key: 'kakao:1',
          cell: 'wvfq2du',
          name: '성산 해물탕',
          rating: '4.4',
          review_count: 210,
          reported_wrong_count: 3,
          is_blocked: false,
          is_closed: false,
          place_url: 'http://place.map.kakao.com/1',
        },
      ],
    };
  }
  if (q.table === 'ops_restaurant_recommendations') {
    if (q.head) {
      if (hasFilter(q, 'gt', 'rank')) return { count: 40 };
      if (hasFilter(q, 'not', 'tapped_at')) return { count: 10 };
      if (hasFilter(q, 'not', 'visited_at')) return { count: 4 };
      return { count: 0 };
    }
    return {
      data: [
        { place_key: 'kakao:1', booking_id: 'booking-aaaaaaa1', feedback: 'wrong', shown_at: '2026-07-25T02:00:00Z' },
        { place_key: 'kakao:1', booking_id: 'booking-bbbbbbb2', feedback: 'closed', shown_at: '2026-07-25T03:00:00Z' },
      ],
    };
  }
  if (q.table === 'match_pois') {
    return { data: [{ poi_key: 'seongsan_ilchulbong', name_ko: '성산일출봉', name_en: 'Seongsan', lat: 33.4581, lng: 126.9425 }] };
  }
  return { data: [] };
};

beforeEach(() => {
  jest.clearAllMocks();
  requireAdminMock.mockResolvedValue({ id: 'admin-1' });
  quotaStateMock.mockResolvedValue(QUOTA);
  googleQuotaStateMock.mockResolvedValue(GOOGLE_QUOTA);
  blockPlaceMock.mockResolvedValue(true);
  invalidateCellMock.mockResolvedValue(true);
  collectCellMock.mockResolvedValue({ hit: true, places: [{ place_key: 'kakao:1' }, { place_key: 'kakao:2' }] });
  createServerClientMock.mockReturnValue(fakeDb(overviewResolver));
});

describe('admin dining-cache — auth', () => {
  it('rejects non-admin callers on every route', async () => {
    requireAdminMock.mockRejectedValue(new AdminAuthFailure(401, 'no', 'AUTH'));
    expect((await overviewGET(req())).status).toBe(401);
    expect((await cellGET(req(), cellCtx('wvfq2du'))).status).toBe(401);
    expect((await cellPOST(req({ body: { action: 'invalidate' } }), cellCtx('wvfq2du'))).status).toBe(401);
    expect((await placePATCH(req({ body: { action: 'block' } }), placeCtx('kakao:1'))).status).toBe(401);
  });

  it('does not touch the cache when the caller is rejected', async () => {
    requireAdminMock.mockRejectedValue(new AdminAuthFailure(403, 'nope', 'FORBIDDEN'));
    await cellPOST(req({ body: { action: 'recollect', confirm: true } }), cellCtx('wvfq2du'));
    await placePATCH(req({ body: { action: 'block' } }), placeCtx('kakao:1'));
    expect(collectCellMock).not.toHaveBeenCalled();
    expect(blockPlaceMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/dining-cache — stats', () => {
  it('reports cells, places and the rated share', async () => {
    const res = await overviewGET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.stats.total_cells).toBe(2);
    expect(json.stats.total_places).toBe(10);
    expect(json.stats.rated_places).toBe(8);
    expect(json.stats.rated_pct).toBe(80);
    expect(json.stats.blocked_places).toBe(1);
  });

  it('excludes the rank=0 sentinel from impressions', async () => {
    const db = fakeDb(overviewResolver);
    createServerClientMock.mockReturnValue(db);
    const json = await (await overviewGET(req())).json();

    // 40 impressions is the `rank > 0` count, not every ledger row: rank 0 is
    // what the feedback route writes when a guest acts on a card whose
    // exposure row never landed.
    expect(json.stats.impressions).toBe(40);
    expect(json.stats.taps).toBe(10);
    expect(json.stats.visits).toBe(4);
    expect(json.stats.tap_rate_pct).toBe(25);

    const impressionQuery = db.queries.find(
      (q) => q.table === 'ops_restaurant_recommendations' && q.head && hasFilter(q, 'gt', 'rank'),
    );
    expect(impressionQuery).toBeDefined();
    expect(impressionQuery?.filters.find((f) => f.op === 'gt')?.args).toEqual(['rank', 0]);
  });

  it('surfaces today’s quota from the shared counters', async () => {
    const json = await (await overviewGET(req())).json();
    expect(json.stats.kakao_calls_today).toBe(120);
    expect(json.stats.kakao_cap).toBe(30_000);
    expect(json.stats.google_calls_today).toBe(40);
    expect(json.stats.quota_alert).toBe(false);
  });

  it('raises quota_alert when either provider crosses its threshold', async () => {
    googleQuotaStateMock.mockResolvedValue({ ...GOOGLE_QUOTA, ratio: 0.8, shouldAlert: true });
    const json = await (await overviewGET(req())).json();
    expect(json.stats.quota_alert).toBe(true);
  });

  it('counts only cells expiring inside the 14-day window', async () => {
    const db = fakeDb(overviewResolver);
    createServerClientMock.mockReturnValue(db);
    const json = await (await overviewGET(req())).json();
    expect(json.stats.expiring_soon_days).toBe(14);

    const expiringQuery = db.queries.find(
      (q) => q.table === 'ops_kakao_cell_index' && q.head && hasFilter(q, 'lt', 'expires_at'),
    );
    expect(expiringQuery).toBeDefined();
    expect(hasFilter(expiringQuery as QueryState, 'gt', 'expires_at')).toBe(true);
  });

  it('does not divide by zero on an empty cache', async () => {
    createServerClientMock.mockReturnValue(fakeDb((q) => (q.head ? { count: 0 } : { data: [] })));
    const json = await (await overviewGET(req())).json();
    expect(json.stats.rated_pct).toBe(0);
    expect(json.stats.tap_rate_pct).toBe(0);
    expect(json.reports).toEqual([]);
  });
});

describe('GET /api/admin/dining-cache — report queue', () => {
  it('queues places reported wrong or marked closed, with who reported them', async () => {
    const db = fakeDb(overviewResolver);
    createServerClientMock.mockReturnValue(db);
    const json = await (await overviewGET(req())).json();

    expect(json.reports).toHaveLength(1);
    expect(json.reports[0].place_key).toBe('kakao:1');
    expect(json.reports[0].reported_wrong_count).toBe(3);
    expect(json.reports[0].rating).toBe(4.4); // numeric arrives as a string
    expect(json.reports[0].reported_by).toHaveLength(2);
    expect(json.reports[0].reported_by[0].booking_id).toBe('booking-aaaaaaa1');

    const queueQuery = db.queries.find((q) => q.table === 'ops_kakao_place_cache' && !q.head && hasFilter(q, 'or'));
    expect(queueQuery?.filters.find((f) => f.op === 'or')?.args[0]).toBe(
      'reported_wrong_count.gt.0,is_closed.eq.true',
    );
  });

  it('labels each cell with its nearest catalogue POI', async () => {
    const json = await (await overviewGET(req())).json();
    expect(json.cells[0].nearest_poi.poi_key).toBe('seongsan_ilchulbong');
    expect(json.cells[0].nearest_poi.distance_m).toBeLessThan(100);
    expect(json.cells[0].center_lat).toBeCloseTo(33.45806);
  });

  it('surfaces a read failure instead of pretending the cache is empty', async () => {
    createServerClientMock.mockReturnValue(
      fakeDb((q) => (q.table === 'ops_kakao_cell_index' && !q.head ? { error: { message: 'boom' } } : { count: 0, data: [] })),
    );
    const res = await overviewGET(req());
    expect(res.status).toBe(500);
  });
});

describe('GET /api/admin/dining-cache/cells/[cell]', () => {
  it('requires a cell', async () => {
    expect((await cellGET(req(), cellCtx(''))).status).toBe(400);
  });

  it('matches places on search_cells, not cell', async () => {
    const db = fakeDb((q) =>
      q.table === 'ops_kakao_place_cache'
        ? { data: [{ place_key: 'kakao:1', name: 'A', lat: '33.4581', lng: '126.9425', rating: '4.2', quality_score: '9.7' }] }
        : { data: { cell: 'wvfq2du', center_lat: '33.45806', center_lng: '126.94250', radius_m: 800 } },
    );
    createServerClientMock.mockReturnValue(db);

    const res = await cellGET(req(), cellCtx('wvfq2du'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(1);
    expect(json.places[0].rating).toBe(4.2);

    const placeQuery = db.queries.find((q) => q.table === 'ops_kakao_place_cache');
    expect(placeQuery?.filters.find((f) => f.op === 'contains')?.args).toEqual(['search_cells', ['wvfq2du']]);
  });

  it('annotates distance from the stored search centre', async () => {
    createServerClientMock.mockReturnValue(
      fakeDb((q) =>
        q.table === 'ops_kakao_place_cache'
          ? { data: [{ place_key: 'kakao:1', name: 'A', lat: 33.4681, lng: 126.9425 }] }
          : { data: { cell: 'wvfq2du', center_lat: 33.4581, center_lng: 126.9425, radius_m: 800 } },
      ),
    );
    const json = await (await cellGET(req(), cellCtx('wvfq2du'))).json();
    expect(json.places[0].distance_m).toBeGreaterThan(1000);
    expect(json.places[0].distance_m).toBeLessThan(1200);
  });

  it('leaves distance null when the cell has no stored centre', async () => {
    createServerClientMock.mockReturnValue(
      fakeDb((q) =>
        q.table === 'ops_kakao_place_cache' ? { data: [{ place_key: 'kakao:1', name: 'A', lat: 33.4, lng: 126.9 }] } : { data: null },
      ),
    );
    const json = await (await cellGET(req(), cellCtx('wvfq2du'))).json();
    expect(json.places[0].distance_m).toBeNull();
  });
});

describe('POST /api/admin/dining-cache/cells/[cell]', () => {
  it('rejects an unknown action', async () => {
    const res = await cellPOST(req({ body: { action: 'nuke' } }), cellCtx('wvfq2du'));
    expect(res.status).toBe(400);
    expect(invalidateCellMock).not.toHaveBeenCalled();
  });

  it('[셀 무효화] delegates to invalidateCell', async () => {
    const res = await cellPOST(req({ body: { action: 'invalidate' } }), cellCtx('wvfq2du'));
    expect(res.status).toBe(200);
    expect(invalidateCellMock).toHaveBeenCalledWith(expect.anything(), 'wvfq2du');
  });

  it('reports a failed invalidation rather than claiming success', async () => {
    invalidateCellMock.mockResolvedValue(false);
    expect((await cellPOST(req({ body: { action: 'invalidate' } }), cellCtx('wvfq2du'))).status).toBe(500);
  });

  it('refuses to [재수집] without an explicit confirm — it spends quota', async () => {
    const res = await cellPOST(req({ body: { action: 'recollect' } }), cellCtx('wvfq2du'));
    expect(res.status).toBe(400);
    expect(collectCellMock).not.toHaveBeenCalled();
  });

  it('[재수집] collects at the cell’s stored centre and radius', async () => {
    createServerClientMock.mockReturnValue(
      fakeDb(() => ({ data: { center_lat: '33.4581', center_lng: '126.9425', radius_m: 1500 } })),
    );
    const res = await cellPOST(req({ body: { action: 'recollect', confirm: true } }), cellCtx('wvfq2du'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, collected: 2 });
    expect(collectCellMock).toHaveBeenCalledWith(expect.anything(), {
      lat: 33.4581,
      lng: 126.9425,
      radiusM: 1500,
    });
  });

  it('falls back to the default radius when the ledger row has none', async () => {
    createServerClientMock.mockReturnValue(fakeDb(() => ({ data: { center_lat: 33.4581, center_lng: 126.9425 } })));
    await cellPOST(req({ body: { action: 'recollect', confirm: true } }), cellCtx('wvfq2du'));
    expect(collectCellMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ radiusM: 800 }));
  });

  it('404s a cell with no stored centre instead of guessing one', async () => {
    createServerClientMock.mockReturnValue(fakeDb(() => ({ data: null })));
    const res = await cellPOST(req({ body: { action: 'recollect', confirm: true } }), cellCtx('unknown'));
    expect(res.status).toBe(404);
    expect(collectCellMock).not.toHaveBeenCalled();
  });

  it('502s when collection comes back empty', async () => {
    collectCellMock.mockResolvedValue({ hit: false, places: [] });
    createServerClientMock.mockReturnValue(fakeDb(() => ({ data: { center_lat: 33.4, center_lng: 126.9, radius_m: 800 } })));
    expect((await cellPOST(req({ body: { action: 'recollect', confirm: true } }), cellCtx('wvfq2du'))).status).toBe(502);
  });
});

describe('PATCH /api/admin/dining-cache/places/[placeKey]', () => {
  it('rejects an unknown action', async () => {
    expect((await placePATCH(req({ body: { action: 'delete' } }), placeCtx('kakao:1'))).status).toBe(400);
  });

  it('[장소 차단] and [차단 해제] delegate to blockPlace', async () => {
    await placePATCH(req({ body: { action: 'block' } }), placeCtx('kakao:1'));
    expect(blockPlaceMock).toHaveBeenCalledWith(expect.anything(), 'kakao:1', true);

    await placePATCH(req({ body: { action: 'unblock' } }), placeCtx('kakao:1'));
    expect(blockPlaceMock).toHaveBeenLastCalledWith(expect.anything(), 'kakao:1', false);
  });

  it('decodes a url-encoded place key', async () => {
    await placePATCH(req({ body: { action: 'block' } }), placeCtx('kakao%3A21499361'));
    expect(blockPlaceMock).toHaveBeenCalledWith(expect.anything(), 'kakao:21499361', true);
  });

  it('reports a failed block rather than claiming success', async () => {
    blockPlaceMock.mockResolvedValue(false);
    expect((await placePATCH(req({ body: { action: 'block' } }), placeCtx('kakao:1'))).status).toBe(500);
  });

  it('[신고 해소] resets the count and leaves is_closed alone', async () => {
    const db = fakeDb(() => ({ data: { place_key: 'kakao:1', reported_wrong_count: 0 } }));
    createServerClientMock.mockReturnValue(db);

    const res = await placePATCH(req({ body: { action: 'resolve-report' } }), placeCtx('kakao:1'));
    expect(res.status).toBe(200);

    const patch = db.queries.find((q) => q.mutation === 'update')?.patch as Record<string, unknown>;
    expect(patch.reported_wrong_count).toBe(0);
    expect(patch.updated_at).toBeDefined();
    // A guest who saw a shuttered restaurant outranks an operator's guess.
    expect(patch).not.toHaveProperty('is_closed');
  });

  it('clears is_closed only when reopen is asked for explicitly', async () => {
    const db = fakeDb(() => ({ data: { place_key: 'kakao:1' } }));
    createServerClientMock.mockReturnValue(db);
    await placePATCH(req({ body: { action: 'resolve-report', reopen: true } }), placeCtx('kakao:1'));
    const patch = db.queries.find((q) => q.mutation === 'update')?.patch as Record<string, unknown>;
    expect(patch.is_closed).toBe(false);
  });

  it('404s a place that is not in the cache', async () => {
    createServerClientMock.mockReturnValue(fakeDb(() => ({ data: null })));
    expect((await placePATCH(req({ body: { action: 'resolve-report' } }), placeCtx('kakao:404'))).status).toBe(404);
  });

  it('surfaces a write failure', async () => {
    createServerClientMock.mockReturnValue(fakeDb(() => ({ error: { message: 'boom' } })));
    expect((await placePATCH(req({ body: { action: 'resolve-report' } }), placeCtx('kakao:1'))).status).toBe(500);
  });
});
