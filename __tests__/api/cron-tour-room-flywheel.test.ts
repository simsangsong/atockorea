/**
 * @jest-environment node
 *
 * W5 — weekly flywheel: matrix learn math, digest scan, retention purge.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET as flywheelGET } from '@/app/api/cron/tour-room-flywheel/route';
import { createServerClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/email', () => ({ sendEmail: jest.fn(async () => ({ success: true })) }));

const createServerClientMock = createServerClient as jest.Mock;
const sendEmailMock = sendEmail as jest.Mock;

const NOW = Date.now();
const iso = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();

function fakeDb() {
  const upserts: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const deletes: string[] = [];
  const events = [
    { room_id: 'r1', created_at: iso(300), payload: { poi_key: 'a_spot' } },
    // 100min later; a_spot planned stay 60 → learned leg = 40min
    { room_id: 'r1', created_at: iso(200), payload: { poi_key: 'b_spot' } },
    { room_id: 'r1', created_at: iso(100), payload: { poi_key: null } }, // ignored
  ];
  const plans = [
    {
      booking_id: 'b1',
      tour_date: '2026-07-17',
      stops: [
        { poi_key: 'a_spot', duration_min: 60, status: 'done', source: 'poi', name_i18n: { en: 'A Spot' } },
        { poi_key: 'closed_spot', status: 'skipped', skip_reason: 'closed', source: 'poi', name_i18n: { en: 'Closed Spot' } },
        { place_id: 'g1', source: 'google', status: 'pending', name_i18n: { en: 'Hidden Cafe' } },
      ],
    },
  ];

  const client = {
    upserts,
    updates,
    deletes,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'gte', 'lt', 'not', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      const resolveList = async () => {
        if (table === 'tour_room_events') return { data: events, error: null };
        if (table === 'tour_day_plans') return { data: plans, error: null };
        return { data: [], error: null };
      };
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => resolveList().then(res, rej);
      chain.maybeSingle = jest.fn(async () => ({ data: null, error: null })); // no prior matrix row
      chain.upsert = jest.fn((values: Record<string, unknown>) => {
        if (table === 'poi_travel_matrix') upserts.push(values);
        return Promise.resolve({ error: null });
      });
      chain.update = jest.fn((values: Record<string, unknown>) => {
        updates.push({ table, values });
        const sub: Record<string, unknown> = {};
        for (const m of ['lt', 'not', 'eq']) sub[m] = jest.fn(() => sub);
        sub.select = jest.fn(async () => ({ data: table === 'tour_day_plans' ? [{ id: 'p1' }, { id: 'p2' }] : [], error: null }));
        return sub;
      });
      chain.delete = jest.fn(() => {
        deletes.push(table);
        const sub: Record<string, unknown> = {};
        for (const m of ['lt', 'eq']) sub[m] = jest.fn(() => sub);
        sub.select = jest.fn(async () => ({ data: [{ id: 'x' }], error: null }));
        return sub;
      });
      return chain;
    },
  };
  return client;
}

function fakeReq(headers: Record<string, string> = {}) {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { headers: { get: (name: string) => map.get(name.toLowerCase()) ?? null } } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = 'cron-test-secret';
  createServerClientMock.mockReturnValue(fakeDb());
});

describe('GET /api/cron/tour-room-flywheel', () => {
  it('rejects unauthenticated calls', async () => {
    const res = await flywheelGET(fakeReq());
    expect(res.status).toBe(401);
  });

  it('learns matrix legs (gap minus stay), digests skips/google picks, purges', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await flywheelGET(fakeReq({ authorization: 'Bearer cron-test-secret' }));
    expect(res.status).toBe(200);
    const body = await res.json();

    // ① matrix: one valid leg a_spot→b_spot, 100min gap − 60min stay = 40min
    expect(body.matrix).toMatchObject({ legs: 1, upserts: 1 });
    expect(db.upserts[0]).toMatchObject({ from_key: 'a_spot', to_key: 'b_spot', minutes_p50: 40, samples: 1 });

    // ② digest: 1 closure skip + 1 google pick → ops email fired
    expect(body.digest).toMatchObject({ closure_skips: 1, google_picks: 1 });
    expect(sendEmailMock).toHaveBeenCalled();
    const html = (sendEmailMock.mock.calls[0][0] as { html: string }).html;
    expect(html).toContain('Closed Spot');
    expect(html).toContain('Hidden Cafe');

    // ③ purge: needs nulled (2 rows in fake), pins + locations deleted
    expect(body.purge).toMatchObject({ needs: 2, pins: 1, locations: 1 });
    expect(db.deletes).toEqual(expect.arrayContaining(['tour_room_pins', 'tour_room_locations']));
  });
});
