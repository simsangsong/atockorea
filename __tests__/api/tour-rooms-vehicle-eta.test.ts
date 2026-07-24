/**
 * @jest-environment node
 *
 * §11.C C3 — GET /vehicle-eta: room-membership auth, the driver>guide pick,
 * the Kakao→synthetic ladder (and every Kakao failure mode degrading to
 * synthetic), destination validation, and the no-vehicle 200.
 */
// Must be first: restores real web primitives before next/server is evaluated.
import '@/test-utils/restoreWebPrimitives';
import { GET as vehicleEtaGET } from '@/app/api/tour-rooms/[bookingId]/vehicle-eta/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { signRoomSession } from '@/lib/tour-room/access';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;

const BOOKING = {
  id: 'booking-1',
  user_id: 'user-owner',
  tour_id: 'tour-1',
  merchant_id: 'merchant-1',
  tour_date: '2099-07-24',
  contact_name: 'Alex Kim',
  contact_email: 'alex@example.com',
  contact_phone: null,
  preferred_language: 'en',
};
const ROOM = { id: 'room-1', booking_id: 'booking-1', tour_id: 'tour-1', tour_date: '2099-07-24', status: 'active' };

/** Seongsan (vehicle) → Udo (pickup): ~5 km apart. */
const DRIVER = { participant_id: 'p-driver', role: 'driver', latitude: 33.458, longitude: 126.9425, recorded_at: '2099-07-24T00:00:00Z' };
const GUIDE = { participant_id: 'p-guide', role: 'guide', latitude: 33.2, longitude: 126.2, recorded_at: '2099-07-24T00:05:00Z' };
const PICKUP = { lat: 33.5045, lng: 126.9523 };

function fakeDb(config: { locations?: Array<Record<string, unknown>>; pickup?: { lat: number; lng: number } | null } = {}) {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const resolve = async () => {
        if (table === 'bookings') {
          // The pickup lookup selects only the join; auth selects the columns.
          return { data: { ...BOOKING, pickup_points: config.pickup === null ? null : [config.pickup ?? PICKUP] }, error: null };
        }
        if (table === 'tour_room_invites') return { data: null, error: null };
        if (table === 'tour_room_locations') return { data: config.locations ?? [], error: null };
        return { data: null, error: null };
      };
      for (const method of ['select', 'eq', 'in', 'order', 'limit']) chain[method] = jest.fn(() => chain);
      chain.single = jest.fn(resolve);
      chain.maybeSingle = jest.fn(resolve);
      chain.then = (onFulfilled: (v: unknown) => unknown) => resolve().then(onFulfilled);
      chain.upsert = jest.fn(() => ({
        select: () => ({ single: async () => ({ data: ROOM, error: null }) }),
      }));
      return chain;
    },
  };
}

function fakeReq(input?: { query?: Record<string, string>; headers?: Record<string, string> }) {
  const params = new URLSearchParams(input?.query ?? {});
  const headers = new Map(Object.entries(input?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    nextUrl: { searchParams: params },
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    json: async () => ({}),
  } as never;
}

const routeParams = () => ({ params: Promise.resolve({ bookingId: 'booking-1' }) });

const session = () =>
  signRoomSession({
    roomId: 'room-1',
    bookingId: 'booking-1',
    participantId: 'participant-77',
    role: 'customer',
    displayName: 'Alex',
  }).session;

const authed = (query?: Record<string, string>) =>
  fakeReq({ query, headers: { 'x-tour-room-auth': session() } });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  delete process.env.KAKAO_REST_API_KEY;
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  createServerClientMock.mockReturnValue(fakeDb({ locations: [DRIVER] }));
});

afterEach(() => {
  delete process.env.KAKAO_REST_API_KEY;
  // @ts-expect-error — tests install a fetch mock ad hoc.
  delete global.fetch;
});

describe('GET /api/tour-rooms/[bookingId]/vehicle-eta (§11.C C3)', () => {
  it('403s a request with no room credential at all', async () => {
    const res = await vehicleEtaGET(fakeReq(), routeParams());
    expect(res.status).toBe(403);
  });

  it('429s when the booking gate denies', async () => {
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 5000 });
    const res = await vehicleEtaGET(authed(), routeParams());
    expect(res.status).toBe(429);
  });

  it('200s with nulls when nobody in the vehicle is sharing', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ locations: [] }));
    const res = await vehicleEtaGET(authed(), routeParams());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ vehicle: null, eta: null });
  });

  it('picks the driver over the guide and falls back to the booking pickup point', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ locations: [GUIDE, DRIVER] }));
    const res = await vehicleEtaGET(authed(), routeParams());
    const json = await res.json();
    expect(json.vehicle).toMatchObject({ role: 'driver', latitude: DRIVER.latitude });
    expect(json.eta.source).toBe('synthetic');
    expect(json.eta.minutes).toBeGreaterThan(0);
    expect(json.eta.distanceM).toBeGreaterThan(4000);
  });

  it('400s a malformed or half-supplied destination', async () => {
    expect((await vehicleEtaGET(authed({ toLat: '999', toLng: '126' }), routeParams())).status).toBe(400);
    expect((await vehicleEtaGET(authed({ toLat: '33.5' }), routeParams())).status).toBe(400);
    expect((await vehicleEtaGET(authed({ toLat: 'abc', toLng: '126' }), routeParams())).status).toBe(400);
  });

  it('null eta when there is no destination anywhere', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ locations: [DRIVER], pickup: null }));
    const res = await vehicleEtaGET(authed(), routeParams());
    const json = await res.json();
    expect(json.vehicle).not.toBeNull();
    expect(json.eta).toBeNull();
  });

  it('uses Kakao Mobility when a key is configured', async () => {
    process.env.KAKAO_REST_API_KEY = 'test-kakao-key';
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ routes: [{ summary: { duration: 1_260, distance: 14_200 } }] }),
    }));
    global.fetch = fetchMock as never;

    const res = await vehicleEtaGET(authed({ toLat: '33.5045', toLng: '126.9523' }), routeParams());
    const json = await res.json();
    expect(json.eta).toEqual({ minutes: 21, distanceM: 14200, source: 'kakao' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toContain('apis-navi.kakaomobility.com');
    expect(url).toContain('origin=126.9425,33.458');
    expect(init.headers.Authorization).toBe('KakaoAK test-kakao-key');
  });

  it('degrades to synthetic on a Kakao non-200', async () => {
    process.env.KAKAO_REST_API_KEY = 'test-kakao-key';
    global.fetch = jest.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })) as never;
    const res = await vehicleEtaGET(authed(), routeParams());
    expect((await res.json()).eta.source).toBe('synthetic');
  });

  it('degrades to synthetic when Kakao times out (abort) or returns no route', async () => {
    process.env.KAKAO_REST_API_KEY = 'test-kakao-key';
    global.fetch = jest.fn(async () => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }) as never;
    expect((await (await vehicleEtaGET(authed(), routeParams())).json()).eta.source).toBe('synthetic');

    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ routes: [{ result_code: 104 }] }) })) as never;
    expect((await (await vehicleEtaGET(authed(), routeParams())).json()).eta.source).toBe('synthetic');
  });
});
