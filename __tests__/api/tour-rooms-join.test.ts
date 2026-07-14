/**
 * @jest-environment node
 *
 * T1.1/T1.2 — join gate + snapshot bundle.
 */
// Must be first: restores real web primitives before next/server is evaluated.
import '@/test-utils/restoreWebPrimitives';
import { POST as joinPOST } from '@/app/api/tour-rooms/[bookingId]/join/route';
import { GET as snapshotGET } from '@/app/api/tour-mode/room/[bookingId]/snapshot/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { signCustomerRoomToken, signGuideRoomToken } from '@/lib/tour-room/token';
import { signRoomSession, verifyRoomSession } from '@/lib/tour-room/access';
import { roomChannelTopic } from '@/lib/tour-room/realtime';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;

const DEVICE_KEY = '5a7f0f6e-1111-4222-8333-944445555666';
// Fixed clock: 2026-07-14 12:00 KST.
const FIXED_NOW_MS = Date.UTC(2026, 6, 14, 3, 0, 0);

const BOOKING = {
  id: 'booking-1',
  user_id: 'user-owner',
  tour_id: 'tour-1',
  merchant_id: 'merchant-1',
  tour_date: '2026-07-14',
  contact_name: 'Alex Kim',
  contact_email: 'alex@example.com',
  contact_phone: null,
  preferred_language: 'ja',
};

interface DbConfig {
  booking?: typeof BOOKING | null;
  roomStatus?: string;
  participants?: Array<Record<string, unknown>>;
  messages?: Array<Record<string, unknown>>;
}

function fakeDb(config: DbConfig = {}) {
  const booking = config.booking === undefined ? BOOKING : config.booking;
  const room = {
    id: 'room-1',
    booking_id: 'booking-1',
    tour_id: 'tour-1',
    tour_date: booking?.tour_date ?? null,
    status: config.roomStatus ?? 'active',
  };
  const upserts: Record<string, Array<Record<string, unknown>>> = {};
  const updates: Record<string, Array<Record<string, unknown>>> = {};

  const client = {
    upserts,
    updates,
    from(table: string) {
      const resolveSelect = async () => {
        if (table === 'bookings') {
          return booking
            ? { data: { ...booking, tours: { id: 'tour-1', title: 'Busan Signature', schedule: [{ time: '09:00' }] }, pickup_points: null }, error: null }
            : { data: null, error: { message: 'not found' } };
        }
        if (table === 'tour_room_participants') return { data: config.participants ?? [], error: null };
        if (table === 'tour_room_messages') return { data: config.messages ?? [], error: null };
        return { data: null, error: null };
      };
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'gt', 'gte', 'in', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      chain.single = jest.fn(resolveSelect);
      chain.maybeSingle = jest.fn(resolveSelect);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => resolveSelect().then(res, rej);
      chain.upsert = jest.fn((values: Record<string, unknown>, options: Record<string, unknown>) => {
        (upserts[table] ??= []).push({ values, options });
        return {
          select: () => ({
            single: async () => {
              if (table === 'tour_rooms') return { data: room, error: null };
              if (table === 'tour_room_participants') return { data: { id: 'participant-1', ...values }, error: null };
              return { data: values, error: null };
            },
          }),
        };
      });
      chain.update = jest.fn((values: Record<string, unknown>) => {
        (updates[table] ??= []).push(values);
        return {
          eq: () => ({
            select: () => ({
              single: async () => ({ data: { ...room, ...values }, error: null }),
            }),
          }),
        };
      });
      return chain;
    },
  };
  return client;
}

function fakeReq(input?: { query?: Record<string, string>; headers?: Record<string, string>; json?: unknown }) {
  const params = new URLSearchParams(input?.query ?? {});
  const headers = new Map(Object.entries(input?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    nextUrl: { searchParams: params },
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    json: async () => input?.json ?? {},
  } as never;
}

const routeParams = (bookingId = 'booking-1') => ({ params: Promise.resolve({ bookingId }) });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  createServerClientMock.mockReturnValue(fakeDb());
  jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/tour-rooms/[bookingId]/join', () => {
  it('400s without a uuid deviceKey', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    const res = await joinPOST(fakeReq({ json: { deviceKey: 'not-a-uuid' } }), routeParams());
    expect(res.status).toBe(400);
  });

  it('registers the owner, issues a verifiable room session, secret channel topic, and snapshot', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    const db = fakeDb({ messages: [{ id: 'm1', created_at: '2026-07-14T00:00:00Z' }] });
    createServerClientMock.mockReturnValue(db);

    const res = await joinPOST(
      fakeReq({ json: { deviceKey: DEVICE_KEY, locale: 'ko', ttsCapable: true } }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    const json = await res.json();

    // Participant upsert keyed on (room_id, device_key) — §O-4.
    const upsert = db.upserts.tour_room_participants[0];
    expect(upsert.options).toMatchObject({ onConflict: 'room_id,device_key' });
    expect(upsert.values).toMatchObject({
      role: 'customer',
      device_key: DEVICE_KEY,
      locale: 'ko',
      tts_capable: true,
      user_id: 'user-owner',
      display_name: 'Alex Kim',
    });

    // Session round-trips through the verifier used by follow-up requests.
    const session = verifyRoomSession(json.session);
    expect(session).toMatchObject({ roomId: 'room-1', bookingId: 'booking-1', participantId: 'participant-1', role: 'customer' });

    // Channel topic is the secret-bearing one (R-23) and only issued here.
    expect(json.channel.topic).toBe(roomChannelTopic('room-1', 'active'));
    expect(json.channel.topic).toMatch(/^tour-room:room-1:[0-9a-f]{8}$/);

    expect(json.lifecycle).toBe('live');
    expect(json.snapshot.messages).toHaveLength(1);
    expect(json.snapshot.schedule).toEqual([{ time: '09:00' }]);
  });

  it('joins via customer invite token with the token displayName and guide via tour-date token', async () => {
    const { token } = signCustomerRoomToken({ bookingId: 'booking-1', displayName: 'Alex', tourDate: '2026-07-14' });
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await joinPOST(fakeReq({ json: { deviceKey: DEVICE_KEY, token } }), routeParams());
    expect(res.status).toBe(201);
    expect(db.upserts.tour_room_participants[0].values).toMatchObject({ role: 'customer', display_name: 'Alex', user_id: null });

    const guide = signGuideRoomToken({ tourId: 'tour-1', tourDate: '2026-07-14', displayName: 'Guide Lee' });
    const db2 = fakeDb();
    createServerClientMock.mockReturnValue(db2);
    const res2 = await joinPOST(fakeReq({ json: { deviceKey: DEVICE_KEY, token: guide.token } }), routeParams());
    expect(res2.status).toBe(201);
    expect(db2.upserts.tour_room_participants[0].values).toMatchObject({ role: 'guide', display_name: 'Guide Lee' });
  });

  it('auto-closes a room whose tour day + grace has passed (R-19) and reports lifecycle=ended', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    const staleBooking = { ...BOOKING, tour_date: '2026-07-10' };
    const db = fakeDb({ booking: staleBooking });
    createServerClientMock.mockReturnValue(db);

    const res = await joinPOST(fakeReq({ json: { deviceKey: DEVICE_KEY } }), routeParams());
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(db.updates.tour_rooms[0]).toMatchObject({ status: 'closed' });
    expect(json.room.status).toBe('closed');
    expect(json.lifecycle).toBe('ended');
    // Channel topic rotated with the closed status (R-23).
    expect(json.channel.topic).toBe(roomChannelTopic('room-1', 'closed'));
  });

  it('gates the guest path (429) and accepts a guest email match', async () => {
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 20000 });
    const denied = await joinPOST(
      fakeReq({ json: { deviceKey: DEVICE_KEY, contactEmail: 'alex@example.com' } }),
      routeParams(),
    );
    expect(denied.status).toBe(429);

    requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
    const ok = await joinPOST(
      fakeReq({ json: { deviceKey: DEVICE_KEY, contactEmail: 'alex@example.com' } }),
      routeParams(),
    );
    expect(ok.status).toBe(201);
  });
});

describe('GET /api/tour-mode/room/[bookingId]/snapshot', () => {
  it('403s without credentials and 200s with the room session issued by join', async () => {
    expect((await snapshotGET(fakeReq(), routeParams())).status).toBe(403);

    const { session } = signRoomSession({
      roomId: 'room-1',
      bookingId: 'booking-1',
      participantId: 'participant-1',
      role: 'customer',
      displayName: 'Alex',
    });
    const res = await snapshotGET(fakeReq({ headers: { 'x-tour-room-auth': session } }), routeParams());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.room).toMatchObject({ id: 'room-1' });
    expect(json.lifecycle).toBe('live');
    expect(Array.isArray(json.tour_guide_spots)).toBe(true);
    expect(json.booking).toMatchObject({ id: 'booking-1' });
  });
});
