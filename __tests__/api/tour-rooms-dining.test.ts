/**
 * @jest-environment node
 *
 * §5.7 R-2/R-5 — the dining route: auth + role gate on `post: true`, the
 * inline (no-post) answer path, the (room, cell, KST day) idempotency claim,
 * the shared-tour Model B fan-out, and the "no card is a 200, never an error"
 * contract.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as diningPOST } from '@/app/api/tour-rooms/[bookingId]/dining/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { signRoomSession } from '@/lib/tour-room/access';
import { recommendDining, recordShown } from '@/lib/ops/dining/recommend.server';
import type { DiningCardMeta } from '@/lib/ops/dining/card';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({ requestGate: jest.fn(), clientIpKey: jest.fn(() => 'ip:test') }));
jest.mock('@/lib/tour-room/events', () => ({ recordRoomEvent: jest.fn(async () => ({ inserted: true, event: null })) }));
jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => ({ ok: true })) }));
jest.mock('@/lib/ops/dining/recommend.server', () => ({
  recommendDining: jest.fn(),
  recordShown: jest.fn(async () => true),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const recordRoomEventMock = recordRoomEvent as jest.Mock;
const recommendMock = recommendDining as jest.Mock;
const recordShownMock = recordShown as jest.Mock;
const broadcastMock = jest.requireMock('@/lib/tour-room/realtime').broadcastToRoom as jest.Mock;

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

const SEONGSAN = { lat: 33.458, lng: 126.9425 };

const META: DiningCardMeta = {
  kind: 'dining_card',
  poi_key: 'seongsan',
  spot_title: 'Seongsan Ilchulbong',
  cell: 'wydm9q1',
  meal: 'lunch',
  dietary: [],
  source: 'cache',
  places: [
    {
      place_key: 'kakao:1',
      name: '성산 해물뚝배기',
      name_i18n: { en: 'Seongsan Seafood Pot' },
      cuisine: '해물,생선',
      category_name: '음식점 > 한식 > 해물,생선',
      lat: 33.4585,
      lng: 126.943,
      distance_m: 240,
      walk_min: 3,
      price_band: 2,
      rating: 4.4,
      review_count: 812,
      tags: ['kids_ok'],
      signature_menus: [{ name: '해물뚝배기' }],
      place_url: 'http://place.map.kakao.com/1',
      open_today: true,
      closes_at: '21:00',
    },
  ],
};

interface FakeDbOpts {
  poiCoords?: Record<string, { lat: number; lng: number }>;
  priceType?: string;
  dayBookings?: Array<Record<string, unknown>>;
}

function fakeDb(opts: FakeDbOpts = {}) {
  const inserts: Record<string, Array<Record<string, unknown>>> = {};
  const coords = opts.poiCoords ?? { seongsan: SEONGSAN };
  const client = {
    inserts,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const filters: Record<string, unknown> = {};
      for (const m of ['select', 'neq', 'in', 'gte', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      chain.eq = jest.fn((col: string, value: unknown) => {
        filters[col] = value;
        return chain;
      });
      const single = async () => {
        if (table === 'bookings') return { data: { ...BOOKING }, error: null };
        if (table === 'match_pois') return { data: coords[String(filters.poi_key)] ?? null, error: null };
        if (table === 'tours') return { data: { price_type: opts.priceType ?? 'private' }, error: null };
        return { data: null, error: null };
      };
      chain.single = jest.fn(single);
      chain.maybeSingle = jest.fn(single);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        (table === 'bookings' && opts.dayBookings
          ? Promise.resolve({ data: opts.dayBookings, error: null })
          : single()
        ).then(res, rej);
      chain.upsert = jest.fn((values: Record<string, unknown>) => ({
        select: () => ({
          single: async () => ({
            data: { id: `room-${values.booking_id}`, booking_id: values.booking_id, status: 'active' },
            error: null,
          }),
        }),
      }));
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        (inserts[table] ??= []).push(values);
        return {
          select: () => ({
            single: async () => ({ data: { id: `${table}-${inserts[table].length}`, ...values }, error: null }),
          }),
        };
      });
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
const sessionFor = (role: 'customer' | 'guide' | 'driver') =>
  signRoomSession({ roomId: 'room-b1', bookingId: 'b1', participantId: `p-${role}`, role, displayName: 'X' }).session;

const built = () => ({
  meta: { ...META },
  shown: [{ booking_id: 'b1', poi_key: 'seongsan', cell: META.cell, place_key: 'kakao:1', rank: 1, dietary_tags: [] }],
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  recordRoomEventMock.mockResolvedValue({ inserted: true, event: null });
  recommendMock.mockResolvedValue(built());
  recordShownMock.mockResolvedValue(true);
});

describe('POST /dining — auth, gates, validation', () => {
  it('rejects an unauthenticated request', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    const res = await diningPOST(fakeReq(null, { poiKey: 'seongsan' }), params());
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
    expect(recommendMock).not.toHaveBeenCalled();
  });

  it('a customer may NOT post to the room feed', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await diningPOST(fakeReq(sessionFor('customer'), { poiKey: 'seongsan', post: true }), params());
    expect(res.status).toBe(403);
    expect(db.inserts.tour_room_messages).toBeUndefined();
  });

  it('400s when neither coordinates nor a known poiKey resolve', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ poiCoords: {} }));
    const res = await diningPOST(fakeReq(sessionFor('customer'), { poiKey: 'nowhere' }), params());
    expect(res.status).toBe(400);
    expect(recommendMock).not.toHaveBeenCalled();
  });

  it('429s when the gate closes — before any external work', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 });
    const res = await diningPOST(fakeReq(sessionFor('customer'), { poiKey: 'seongsan' }), params());
    expect(res.status).toBe(429);
    expect(recommendMock).not.toHaveBeenCalled();
  });
});

describe('POST /dining — inline (post: false)', () => {
  it('returns the card without touching the feed, and still logs the exposure', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await diningPOST(fakeReq(sessionFor('customer'), { poiKey: 'seongsan' }), params());
    expect(res.status).toBe(200);
    const json = (await res.json()) as { card: DiningCardMeta; posted: boolean };
    expect(json.card.kind).toBe('dining_card');
    expect(json.posted).toBe(false);
    expect(db.inserts.tour_room_messages).toBeUndefined();
    expect(broadcastMock).not.toHaveBeenCalled();
    expect(recordShownMock).toHaveBeenCalledTimes(1);
  });

  it('a null recommendation is a 200 with card: null, never an error', async () => {
    recommendMock.mockResolvedValue(null);
    createServerClientMock.mockReturnValue(fakeDb());
    const res = await diningPOST(fakeReq(sessionFor('customer'), { poiKey: 'seongsan' }), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ card: null });
  });

  it('explicit lat/lng win over the poiKey lookup', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    await diningPOST(fakeReq(sessionFor('customer'), { lat: 35.1, lng: 129.0, spotTitle: 'Busan' }), params());
    expect(recommendMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ lat: 35.1, lng: 129.0, spotTitle: 'Busan' }),
    );
  });

  it('drops unknown dietary strings instead of filtering on them', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    await diningPOST(
      fakeReq(sessionFor('customer'), { poiKey: 'seongsan', dietary: ['halal', 'no_such_thing', 'kids'] }),
      params(),
    );
    expect(recommendMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dietary: ['halal', 'kids'] }),
    );
  });
});

describe('POST /dining — operator post: true', () => {
  it('posts one dining_card system message and claims the (cell, day) slot', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await diningPOST(
      fakeReq(sessionFor('guide'), { poiKey: 'seongsan', spotTitle: 'Seongsan Ilchulbong', post: true }),
      params(),
    );
    expect(res.status).toBe(201);
    expect(db.inserts.tour_room_messages).toHaveLength(1);

    const row = db.inserts.tour_room_messages[0];
    expect(row.sender_role).toBe('system');
    const meta = row.metadata as Record<string, unknown>;
    expect(meta.kind).toBe('dining_card');
    expect(meta.cell).toBe('wydm9q1');
    expect(meta.fanout).toBeUndefined();

    const translations = row.translations as Record<string, string>;
    expect(Object.keys(translations).sort()).toEqual(['en', 'es', 'ja', 'ko', 'zh']);
    expect(translations.ko).toContain('Seongsan Ilchulbong');

    expect(recordRoomEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'dining_card', subjectKey: 'wydm9q1:2099-07-24', roomId: 'room-b1' }),
    );
    expect(broadcastMock).toHaveBeenCalledTimes(1);
  });

  it('a driver may post too', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await diningPOST(fakeReq(sessionFor('driver'), { poiKey: 'seongsan', post: true }), params());
    expect(res.status).toBe(201);
    expect(db.inserts.tour_room_messages).toHaveLength(1);
  });

  it('the same cell on the same day never posts twice', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    recordRoomEventMock.mockResolvedValueOnce({ inserted: true, event: null });
    const first = await diningPOST(fakeReq(sessionFor('guide'), { poiKey: 'seongsan', post: true }), params());
    expect(first.status).toBe(201);

    recordRoomEventMock.mockResolvedValueOnce({ inserted: false, event: null });
    const second = await diningPOST(fakeReq(sessionFor('guide'), { poiKey: 'seongsan', post: true }), params());
    expect(second.status).toBe(200);
    expect((await second.json()).skipped).toBe('duplicate');
    expect(db.inserts.tour_room_messages).toHaveLength(1);
    expect(broadcastMock).toHaveBeenCalledTimes(1);
  });

  it('a shared tour fans out to every booking of the date (Model B)', async () => {
    const db = fakeDb({
      priceType: 'person',
      dayBookings: [
        { id: 'b1', tour_id: 'tour-1', tour_date: '2099-07-24', preferred_language: 'en' },
        { id: 'b2', tour_id: 'tour-1', tour_date: '2099-07-24', preferred_language: 'ja' },
        { id: 'b3', tour_id: 'tour-1', tour_date: '2099-07-24', preferred_language: 'ko' },
      ],
    });
    createServerClientMock.mockReturnValue(db);
    const res = await diningPOST(fakeReq(sessionFor('guide'), { poiKey: 'seongsan', post: true }), params());
    expect(res.status).toBe(201);
    expect((await res.json()).delivered).toBe(3);
    expect(db.inserts.tour_room_messages).toHaveLength(3);
    expect(db.inserts.tour_room_messages.map((r) => r.booking_id)).toEqual(['b1', 'b2', 'b3']);
    for (const row of db.inserts.tour_room_messages) {
      expect((row.metadata as Record<string, unknown>).fanout).toBe(true);
    }
    // The exposure ledger is written per room, against that room's booking.
    expect(recordShownMock).toHaveBeenCalledTimes(3);
    expect(recordShownMock.mock.calls[1][1]).toEqual([
      expect.objectContaining({ booking_id: 'b2', place_key: 'kakao:1', rank: 1 }),
    ]);
  });

  it('no card → 200 posted:false, nothing in the feed', async () => {
    recommendMock.mockResolvedValue(null);
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await diningPOST(fakeReq(sessionFor('guide'), { poiKey: 'seongsan', post: true }), params());
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe('no_card');
    expect(db.inserts.tour_room_messages).toBeUndefined();
    expect(recordRoomEventMock).not.toHaveBeenCalled();
  });

  it('a throwing recommendation never 500s the route', async () => {
    recommendMock.mockRejectedValue(new Error('kakao exploded'));
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await diningPOST(fakeReq(sessionFor('guide'), { poiKey: 'seongsan', post: true }), params());
    expect(res.status).toBe(200);
    expect(db.inserts.tour_room_messages).toBeUndefined();
  });
});
