/**
 * @jest-environment node
 *
 * §5.7 R-1 intake ① — card ④'s dietary write, and the END-TO-END path it opens:
 *
 *   chip tap → PUT /dietary → tour_day_plans.needs.dietary
 *            → resolveDietary() (the dining card's first intake)
 *            → rankPlaces() hard exclusion
 *
 * The last three steps are exercised against the REAL modules (only the DB is
 * faked), because "the lunch card ignored the vegetarian filter on one path
 * only" is exactly the bug this card exists to prevent.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET as dietaryGET, PUT as dietaryPUT } from '@/app/api/tour-rooms/[bookingId]/dietary/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { signRoomSession } from '@/lib/tour-room/access';
import { resolveDietary } from '@/lib/ops/dining/recommend.server';
import { rankPlaces, type CachedPlace } from '@/lib/ops/dining/places';
import type { RoomDbClient } from '@/lib/tour-room/access';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({ requestGate: jest.fn(), clientIpKey: jest.fn(() => 'ip:test') }));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;

const TOUR_DATE = '2099-07-24';
const BOOKING = {
  id: 'b1',
  user_id: 'u1',
  tour_id: 'tour-1',
  merchant_id: 'm1',
  tour_date: TOUR_DATE,
  contact_name: 'A',
  contact_email: 'a@b.c',
  contact_phone: null,
  preferred_language: 'en',
};

/**
 * One fake DB shared by the route and by resolveDietary — so what the route
 * writes is literally what the dining intake later reads.
 */
function fakeDb(seed: { needs?: Record<string, unknown> | null; hasRow?: boolean; specialRequests?: string } = {}) {
  const store: { needs: Record<string, unknown> | null; hasRow: boolean } = {
    needs: seed.needs ?? null,
    hasRow: seed.hasRow ?? false,
  };
  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];

  const client = {
    store,
    inserts,
    updates,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['neq', 'in', 'gte', 'gt', 'lt', 'order', 'is', 'not']) chain[m] = jest.fn(() => chain);
      chain.select = jest.fn(() => chain);
      chain.eq = jest.fn(() => chain);
      chain.limit = jest.fn(() => chain);

      const rows = () => {
        if (table === 'tour_day_plans') {
          return store.hasRow
            ? [{ id: 'plan-1', needs: store.needs, updated_at: '2099-07-24T00:00:00Z' }]
            : [];
        }
        return [];
      };
      const one = async () => {
        if (table === 'bookings') {
          return { data: { ...BOOKING, special_requests: seed.specialRequests ?? null, notes: null }, error: null };
        }
        return { data: null, error: null };
      };
      chain.single = jest.fn(one);
      chain.maybeSingle = jest.fn(one);
      chain.upsert = jest.fn((values: Record<string, unknown>) => ({
        select: () => ({
          single: async () => ({
            data: { id: 'room-1', booking_id: values.booking_id, status: 'active' },
            error: null,
          }),
        }),
      }));
      chain.insert = jest.fn(async (values: Record<string, unknown>) => {
        inserts.push({ table, ...values });
        if (table === 'tour_day_plans') {
          store.hasRow = true;
          store.needs = (values.needs ?? null) as Record<string, unknown> | null;
        }
        return { data: { id: 'ev-1' }, error: null };
      });
      // tour_room_events insert goes through .select().single()
      const insertChain = chain.insert as jest.Mock;
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        const promise = insertChain(values);
        const wrapper: Record<string, unknown> = {
          select: () => ({ single: async () => promise }),
          then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => promise.then(res, rej),
        };
        return wrapper;
      });
      chain.update = jest.fn((values: Record<string, unknown>) => {
        updates.push({ table, ...values });
        if (table === 'tour_day_plans') store.needs = (values.needs ?? null) as Record<string, unknown> | null;
        const u: Record<string, unknown> = {};
        u.eq = jest.fn(() => u);
        u.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(res, rej);
        return u;
      });
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(res, rej);
      return chain;
    },
  };
  return client;
}

function fakeReq(session: string | null, json: unknown = {}) {
  return {
    nextUrl: { searchParams: new URLSearchParams('') },
    headers: { get: (name: string) => (name.toLowerCase() === 'x-tour-room-auth' ? session : null) },
    json: async () => json,
  } as never;
}

const params = () => ({ params: Promise.resolve({ bookingId: 'b1' }) });
const session = (role: 'customer' | 'driver' | 'guide' = 'customer') =>
  signRoomSession({ roomId: 'room-1', bookingId: 'b1', participantId: 'p1', role, displayName: 'C' }).session;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
});

describe('PUT /dietary — auth, validation, rate limit', () => {
  it('rejects an unauthenticated request', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    const res = await dietaryPUT(fakeReq(null, { dietary: ['vegan'] }), params());
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('403s the driver (guests and staff own dietary needs, drivers do not)', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    const res = await dietaryPUT(fakeReq(session('driver'), { dietary: ['vegan'] }), params());
    expect(res.status).toBe(403);
  });

  it('400s when dietary is not an array', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    const res = await dietaryPUT(fakeReq(session(), { dietary: 'vegan' }), params());
    expect(res.status).toBe(400);
  });

  it('429s when the gate closes', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 5000 });
    const res = await dietaryPUT(fakeReq(session(), { dietary: ['vegan'] }), params());
    expect(res.status).toBe(429);
  });
});

describe('PUT /dietary — the write', () => {
  it('creates a guest_draft day plan when the booking never had one (join-tour guest)', async () => {
    const db = fakeDb({ hasRow: false });
    createServerClientMock.mockReturnValue(db);
    const res = await dietaryPUT(fakeReq(session(), { dietary: ['vegan', 'no_nuts'] }), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ dietary: ['vegan', 'no_nuts'] });

    const plan = db.inserts.find((row) => row.table === 'tour_day_plans')!;
    expect(plan).toMatchObject({ booking_id: 'b1', tour_date: TOUR_DATE, status: 'guest_draft', stops: [] });
    expect((plan.needs as { dietary: string[] }).dietary).toEqual(['vegan', 'no_nuts']);
  });

  it('merges into an existing needs blob without touching the other keys', async () => {
    const db = fakeDb({ hasRow: true, needs: { adults: 2, children: 1, pace: 'relaxed', dietary: ['halal'] } });
    createServerClientMock.mockReturnValue(db);
    await dietaryPUT(fakeReq(session(), { dietary: ['vegetarian'] }), params());
    const patch = db.updates.find((row) => row.table === 'tour_day_plans')!;
    expect(patch.needs).toEqual({ adults: 2, children: 1, pace: 'relaxed', dietary: ['vegetarian'] });
  });

  it('unticking removes the restriction (the write is a replace, not a merge of tags)', async () => {
    const db = fakeDb({ hasRow: true, needs: { dietary: ['vegan', 'halal'] } });
    createServerClientMock.mockReturnValue(db);
    await dietaryPUT(fakeReq(session(), { dietary: [] }), params());
    expect((db.updates[0].needs as { dietary: string[] }).dietary).toEqual([]);
  });

  it('drops junk and the derived `kids` tag, de-duplicates, and keeps vocabulary order', async () => {
    const db = fakeDb({ hasRow: true, needs: {} });
    createServerClientMock.mockReturnValue(db);
    const res = await dietaryPUT(
      fakeReq(session(), { dietary: ['no_nuts', 'kids', 'vegan', 'vegan', 'astrology', 42] }),
      params(),
    );
    expect(await res.json()).toMatchObject({ dietary: ['vegan', 'no_nuts'] });
  });

  it('stores an optional free-text allergy note (capped)', async () => {
    const db = fakeDb({ hasRow: true, needs: {} });
    createServerClientMock.mockReturnValue(db);
    await dietaryPUT(fakeReq(session(), { dietary: ['no_nuts'], allergyNote: '  peanut — severe  ' }), params());
    expect((db.updates[0].needs as { allergy_note: string }).allergy_note).toBe('peanut — severe');
  });

  it('leaves an audit event but posts NO capsule (a shared room must not leak it)', async () => {
    const db = fakeDb({ hasRow: true, needs: {} });
    createServerClientMock.mockReturnValue(db);
    await dietaryPUT(fakeReq(session(), { dietary: ['halal'] }), params());
    expect(db.inserts.some((row) => row.table === 'tour_room_events' && row.type === 'dietary_intake')).toBe(true);
    expect(db.inserts.some((row) => row.table === 'tour_room_messages')).toBe(false);
  });
});

describe('GET /dietary', () => {
  it('returns what is on file', async () => {
    createServerClientMock.mockReturnValue(
      fakeDb({ hasRow: true, needs: { dietary: ['halal', 'kids'], allergy_note: 'shrimp' } }),
    );
    const res = await dietaryGET(fakeReq(session()), params());
    expect(await res.json()).toEqual({ dietary: ['halal'], allergyNote: 'shrimp' });
  });

  it('returns an empty list when the booking has no plan row', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ hasRow: false }));
    const res = await dietaryGET(fakeReq(session()), params());
    expect(await res.json()).toEqual({ dietary: [], allergyNote: null });
  });
});

describe('🔴 end-to-end: chip tap → needs → dining filters', () => {
  const places: CachedPlace[] = [
    {
      place_key: 'kakao:pork',
      name: '흑돼지 맛집',
      cuisine: '돼지고기구이',
      category_name: '음식점 > 한식 > 육류,고기 > 돼지고기구이',
      lat: 33.51,
      lng: 126.53,
      tags: [],
      signature_menus: [],
      place_url: 'http://place.map.kakao.com/1',
      rating: 4.8,
      review_count: 900,
    } as unknown as CachedPlace,
    {
      place_key: 'kakao:veg',
      name: '채식 비빔밥',
      cuisine: '한식',
      category_name: '음식점 > 한식 > 채식',
      lat: 33.511,
      lng: 126.531,
      tags: ['vegetarian_friendly'],
      signature_menus: [],
      place_url: 'http://place.map.kakao.com/2',
      rating: 4.2,
      review_count: 200,
    } as unknown as CachedPlace,
  ];

  it('a guest who taps 비건 on card ④ never sees the pork place again', async () => {
    const db = fakeDb({ hasRow: false });
    createServerClientMock.mockReturnValue(db);

    // Before the tap: no restriction on file, the pork place is rankable.
    const before = await resolveDietary(db as unknown as RoomDbClient, 'b1');
    expect(before.tags).toEqual([]);
    expect(
      rankPlaces(places, { centerLat: 33.51, centerLng: 126.53, dietary: before.tags, nowMs: Date.now() }).map((p) => p.place_key),
    ).toContain('kakao:pork');

    // The tap. Same DB, real route.
    const res = await dietaryPUT(fakeReq(session(), { dietary: ['vegan'] }), params());
    expect(res.status).toBe(200);

    // After: the dining intake reads it back with no extra wiring…
    const after = await resolveDietary(db as unknown as RoomDbClient, 'b1');
    expect(after.tags).toContain('vegan');

    // …and the ranking hard-excludes the conflicting place.
    const ranked = rankPlaces(places, { centerLat: 33.51, centerLng: 126.53, dietary: after.tags, nowMs: Date.now() }).map((p) => p.place_key);
    expect(ranked).not.toContain('kakao:pork');
    expect(ranked).toContain('kakao:veg');
  });

  it('needs written here outrank the booking-note scan (intake ① beats intake ②)', async () => {
    const db = fakeDb({ hasRow: false, specialRequests: 'gluten free please' });
    createServerClientMock.mockReturnValue(db);
    await dietaryPUT(fakeReq(session(), { dietary: ['halal'] }), params());
    const resolved = await resolveDietary(db as unknown as RoomDbClient, 'b1');
    expect(resolved.tags).toEqual(['halal']);
    expect(resolved.tags).not.toContain('gluten_free');
  });
});
