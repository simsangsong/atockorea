/**
 * @jest-environment node
 *
 * §5.7 R-6 — dining feedback: each action's ledger write, the upsert fallback
 * when the exposure row is missing, and the wrong→hidden threshold at 3.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as feedbackPOST } from '@/app/api/tour-rooms/[bookingId]/dining/feedback/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { signRoomSession } from '@/lib/tour-room/access';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({ requestGate: jest.fn(), clientIpKey: jest.fn(() => 'ip:test') }));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;

const BOOKING = {
  id: 'b1',
  user_id: 'u1',
  tour_id: 'tour-1',
  merchant_id: 'm1',
  tour_date: '2099-07-24',
  contact_name: 'A',
  contact_email: 'a@b.c',
  contact_phone: null,
  preferred_language: 'en',
};

interface FakeDbOpts {
  /** Rows the exposure UPDATE should report as touched. */
  updatedRows?: Array<Record<string, unknown>>;
  /** Current reported_wrong_count on the cached place. */
  wrongCount?: number;
}

function fakeDb(opts: FakeDbOpts = {}) {
  const inserts: Record<string, Array<Record<string, unknown>>> = {};
  const updates: Record<string, Array<Record<string, unknown>>> = {};
  const client = {
    inserts,
    updates,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['neq', 'in', 'gte', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      chain.select = jest.fn(() => chain);
      chain.eq = jest.fn(() => chain);
      const single = async () => {
        if (table === 'bookings') return { data: { ...BOOKING }, error: null };
        if (table === 'ops_kakao_place_cache') {
          return { data: { reported_wrong_count: opts.wrongCount ?? 0 }, error: null };
        }
        return { data: null, error: null };
      };
      chain.single = jest.fn(single);
      chain.maybeSingle = jest.fn(single);
      chain.upsert = jest.fn((values: Record<string, unknown>) => ({
        select: () => ({
          single: async () => ({
            data: { id: `room-${values.booking_id}`, booking_id: values.booking_id, status: 'active' },
            error: null,
          }),
        }),
      }));
      chain.insert = jest.fn(async (values: Record<string, unknown>) => {
        (inserts[table] ??= []).push(values);
        return { data: null, error: null };
      });
      chain.update = jest.fn((values: Record<string, unknown>) => {
        (updates[table] ??= []).push(values);
        const updateChain: Record<string, unknown> = {};
        updateChain.eq = jest.fn(() => updateChain);
        updateChain.select = jest.fn(async () => ({
          data: table === 'ops_restaurant_recommendations' ? (opts.updatedRows ?? []) : [],
          error: null,
        }));
        updateChain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(res, rej);
        return updateChain;
      });
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => single().then(res, rej);
      return chain;
    },
  };
  return client;
}

function fakeReq(session: string | null, json: unknown) {
  return {
    nextUrl: { searchParams: new URLSearchParams('') },
    headers: { get: (name: string) => (name.toLowerCase() === 'x-tour-room-auth' ? session : null) },
    json: async () => json,
  } as never;
}

const params = () => ({ params: Promise.resolve({ bookingId: 'b1' }) });
const customerSession = () =>
  signRoomSession({ roomId: 'room-b1', bookingId: 'b1', participantId: 'p-cust', role: 'customer', displayName: 'C' })
    .session;

const body = (action: string) => ({ placeKey: 'kakao:1', cell: 'wydm9q1', action });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
});

describe('POST /dining/feedback — auth + validation', () => {
  it('rejects an unauthenticated request', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    const res = await feedbackPOST(fakeReq(null, body('tap')), params());
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('400s on a missing field or an unknown action', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    for (const bad of [{ cell: 'c', action: 'tap' }, { placeKey: 'k', action: 'tap' }, body('nonsense')]) {
      const res = await feedbackPOST(fakeReq(customerSession(), bad), params());
      expect(res.status).toBe(400);
    }
  });

  it('429s when the gate closes', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 10_000 });
    const res = await feedbackPOST(fakeReq(customerSession(), body('tap')), params());
    expect(res.status).toBe(429);
  });
});

describe('POST /dining/feedback — the ledger', () => {
  it('tap stamps tapped_at only', async () => {
    const db = fakeDb({ updatedRows: [{ id: 'r1' }] });
    createServerClientMock.mockReturnValue(db);
    const res = await feedbackPOST(fakeReq(customerSession(), body('tap')), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, logged: true });
    const patch = db.updates.ops_restaurant_recommendations[0];
    expect(patch.tapped_at).toEqual(expect.any(String));
    expect(patch.visited_at).toBeUndefined();
    expect(patch.feedback).toBeUndefined();
  });

  it('visited stamps visited_at (and tapped_at — opening the card IS a tap)', async () => {
    const db = fakeDb({ updatedRows: [{ id: 'r1' }] });
    createServerClientMock.mockReturnValue(db);
    await feedbackPOST(fakeReq(customerSession(), body('visited')), params());
    const patch = db.updates.ops_restaurant_recommendations[0];
    expect(patch.visited_at).toEqual(expect.any(String));
    expect(patch.tapped_at).toEqual(expect.any(String));
  });

  it('inserts an exposure row when the guest never had one', async () => {
    const db = fakeDb({ updatedRows: [] });
    createServerClientMock.mockReturnValue(db);
    const res = await feedbackPOST(fakeReq(customerSession(), body('tap')), params());
    expect(res.status).toBe(200);
    expect(db.inserts.ops_restaurant_recommendations).toHaveLength(1);
    expect(db.inserts.ops_restaurant_recommendations[0]).toMatchObject({
      booking_id: 'b1',
      place_key: 'kakao:1',
      cell: 'wydm9q1',
      rank: 0,
    });
  });
});

describe('POST /dining/feedback — wrong / closed', () => {
  it('the first wrong report records the feedback but hides nothing', async () => {
    const db = fakeDb({ updatedRows: [{ id: 'r1' }], wrongCount: 0 });
    createServerClientMock.mockReturnValue(db);
    const res = await feedbackPOST(fakeReq(customerSession(), body('wrong')), params());
    expect(await res.json()).toEqual({ ok: true, logged: true, hidden: false });
    expect(db.updates.ops_restaurant_recommendations[0].feedback).toBe('wrong');
    expect(db.updates.ops_kakao_place_cache[0]).toMatchObject({ reported_wrong_count: 1 });
  });

  it('the THIRD wrong report auto-hides the place (K6)', async () => {
    const db = fakeDb({ updatedRows: [{ id: 'r1' }], wrongCount: 2 });
    createServerClientMock.mockReturnValue(db);
    const res = await feedbackPOST(fakeReq(customerSession(), body('wrong')), params());
    expect(await res.json()).toEqual({ ok: true, logged: true, hidden: true });
    expect(db.updates.ops_kakao_place_cache[0]).toMatchObject({ reported_wrong_count: 3 });
    expect(db.updates.ops_kakao_place_cache[0].is_closed).toBeUndefined();
  });

  it('closed hides immediately and flags the cache row', async () => {
    const db = fakeDb({ updatedRows: [{ id: 'r1' }], wrongCount: 0 });
    createServerClientMock.mockReturnValue(db);
    const res = await feedbackPOST(fakeReq(customerSession(), body('closed')), params());
    expect(await res.json()).toEqual({ ok: true, logged: true, hidden: true });
    expect(db.updates.ops_kakao_place_cache[0]).toMatchObject({ is_closed: true, reported_wrong_count: 1 });
  });
});
