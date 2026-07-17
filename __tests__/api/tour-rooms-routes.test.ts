/**
 * @jest-environment node
 *
 * T0.8 — request-contract regression tests for the three kursoflow-ported
 * room routes after the lib/tour-room/access refactor. The refactor must be
 * behaviour-preserving for the pre-existing paths (admin/owner/merchant/guest)
 * and additive for tokens/room sessions.
 */
// Must be first: restores real web primitives before next/server is evaluated.
import '@/test-utils/restoreWebPrimitives';
import { GET as messagesGET, POST as messagesPOST } from '@/app/api/tour-rooms/[bookingId]/messages/route';
import { POST as spotEventsPOST } from '@/app/api/tour-rooms/[bookingId]/spot-events/route';
import { GET as eventsGET } from '@/app/api/tour-rooms/[bookingId]/events/route';
import { GET as tourModeBookingsGET } from '@/app/api/tour-mode/bookings/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { translateTextForLocales } from '@/lib/openai-server';
import { signCustomerRoomToken } from '@/lib/tour-room/token';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
}));
jest.mock('@/lib/openai-server', () => ({
  translateTextForLocales: jest.fn(),
  transcribeAudioFile: jest.fn(),
}));
jest.mock('@/lib/tour-room/realtime', () => ({
  broadcastToRoom: jest.fn(async () => ({ ok: true })),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const translateMock = translateTextForLocales as jest.Mock;
const broadcastToRoomMock = jest.requireMock('@/lib/tour-room/realtime').broadcastToRoom as jest.Mock;

// Fixture date must stay in the future - room tokens expire at tour-day-end KST + 24h.
const FIXTURE_TOUR_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const BOOKING = {
  id: 'booking-1',
  user_id: 'user-owner',
  tour_id: 'tour-1',
  merchant_id: 'merchant-1',
  tour_date: FIXTURE_TOUR_DATE,
  contact_name: 'Alex Kim',
  contact_email: 'alex@example.com',
  contact_phone: null,
  preferred_language: 'ja',
};

const ROOM = { id: 'room-1', booking_id: 'booking-1', tour_id: 'tour-1', tour_date: FIXTURE_TOUR_DATE, status: 'active' };
const SPOT = {
  id: 'spot-1',
  tour_id: 'tour-1',
  title: 'Haedong Yonggungsa',
  description: null,
  audio_url: null,
  latitude: 35.18,
  longitude: 129.22,
  trigger_radius_m: 80,
};

interface DbConfig {
  booking?: typeof BOOKING | null;
  spot?: typeof SPOT | null;
  existingSpotEvent?: Record<string, unknown> | null;
  messages?: Array<Record<string, unknown>>;
  participants?: Array<Record<string, unknown>>;
}

/** Chainable fake supabase covering every query the three routes issue. */
function fakeDb(config: DbConfig = {}) {
  const inserted: Record<string, Array<Record<string, unknown>>> = {};
  const client = {
    inserted,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const resolveSelect = async () => {
        if (table === 'bookings') {
          const b = config.booking === undefined ? BOOKING : config.booking;
          return b ? { data: b, error: null } : { data: null, error: { message: 'not found' } };
        }
        if (table === 'tour_guide_spots') {
          const s = config.spot === undefined ? SPOT : config.spot;
          return s ? { data: s, error: null } : { data: null, error: { message: 'not found' } };
        }
        if (table === 'tour_room_invites') return { data: null, error: null };
        if (table === 'tour_room_spot_events') {
          return { data: config.existingSpotEvent ?? null, error: null };
        }
        if (table === 'tour_room_messages') return { data: config.messages ?? [], error: null };
        if (table === 'tour_room_participants') return { data: config.participants ?? [], error: null };
        return { data: null, error: null };
      };
      const selfReturning = [
        'select', 'eq', 'gt', 'gte', 'order', 'limit',
      ];
      for (const method of selfReturning) {
        chain[method] = jest.fn(() => chain);
      }
      chain.single = jest.fn(resolveSelect);
      chain.maybeSingle = jest.fn(resolveSelect);
      chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        resolveSelect().then(resolve, reject);
      chain.upsert = jest.fn(() => ({
        select: () => ({ single: async () => ({ data: ROOM, error: null }) }),
      }));
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        (inserted[table] ??= []).push(values);
        return {
          select: () => ({
            single: async () => ({ data: { id: `${table}-row-1`, ...values }, error: null }),
          }),
        };
      });
      return chain;
    },
  };
  return client;
}

function fakeReq(input?: {
  query?: Record<string, string>;
  headers?: Record<string, string>;
  json?: unknown;
  aborted?: boolean;
}) {
  const params = new URLSearchParams(input?.query ?? {});
  const headers = new Map(Object.entries(input?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    nextUrl: { searchParams: params },
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    json: async () => input?.json ?? {},
    signal: { aborted: input?.aborted ?? true },
  } as never;
}

const routeParams = (bookingId = 'booking-1') => ({ params: Promise.resolve({ bookingId }) });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  translateMock.mockResolvedValue({ source_locale: 'en', translations: { ja: '訳' } });
  createServerClientMock.mockReturnValue(fakeDb());
});

describe('GET /api/tour-rooms/[bookingId]/messages', () => {
  it('404s on unknown booking', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ booking: null }));
    const res = await messagesGET(fakeReq(), routeParams());
    expect(res.status).toBe(404);
  });

  it('403s anonymous requests (no guest path on GET, pre-refactor contract)', async () => {
    const res = await messagesGET(fakeReq(), routeParams());
    expect(res.status).toBe(403);
  });

  it('200s for the booking owner with {room, messages}', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    createServerClientMock.mockReturnValue(fakeDb({ messages: [{ id: 'm1' }] }));
    const res = await messagesGET(fakeReq(), routeParams());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.room).toMatchObject({ id: 'room-1' });
    expect(json.messages).toHaveLength(1);
  });

  it('200s for a valid customer invite token (new additive path)', async () => {
    const { token } = signCustomerRoomToken({
      bookingId: 'booking-1',
      displayName: 'Alex',
      tourDate: FIXTURE_TOUR_DATE,
    });
    const res = await messagesGET(fakeReq({ query: { rt: token } }), routeParams());
    expect(res.status).toBe(200);
  });
});

describe('POST /api/tour-rooms/[bookingId]/messages', () => {
  it('403s an unrelated logged-in user without guest creds', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'someone-else', role: 'customer' });
    const res = await messagesPOST(fakeReq({ json: { text: 'hi' } }), routeParams());
    expect(res.status).toBe(403);
  });

  it('201s an owner text message with server-authoritative customer role', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await messagesPOST(fakeReq({ json: { text: 'hello' } }), routeParams());
    expect(res.status).toBe(201);
    expect(db.inserted.tour_room_messages[0]).toMatchObject({
      sender_role: 'customer',
      sender_user_id: 'user-owner',
      source_text: 'hello',
      translations: { ja: '訳' },
    });
  });

  it('201s a guest message via contact email match and defaults 5 locales', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await messagesPOST(
      fakeReq({ json: { text: 'hi', contactEmail: 'alex@example.com' } }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    expect(db.inserted.tour_room_messages[0]).toMatchObject({ sender_role: 'customer', sender_user_id: null });
    expect(translateMock).toHaveBeenCalledWith('hi', ['en', 'ko', 'zh', 'ja', 'es']);
  });

  it("merchant guide messages default to the customer's preferred language", async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-m', role: 'merchant', merchantId: 'merchant-1' });
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await messagesPOST(fakeReq({ json: { text: 'meet at 3' } }), routeParams());
    expect(res.status).toBe(201);
    expect(db.inserted.tour_room_messages[0]).toMatchObject({ sender_role: 'guide' });
    expect(translateMock).toHaveBeenCalledWith('meet at 3', ['ja']);
  });

  it('400s empty text', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    const res = await messagesPOST(fakeReq({ json: { text: '   ' } }), routeParams());
    expect(res.status).toBe(400);
  });

  it('T1.3/D-8: targets only the locales of the participants actually in the room', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    const db = fakeDb({ participants: [{ locale: 'ko' }, { locale: 'ja' }, { locale: 'ko' }] });
    createServerClientMock.mockReturnValue(db);
    const res = await messagesPOST(fakeReq({ json: { text: 'where is the bus?' } }), routeParams());
    expect(res.status).toBe(201);
    expect(translateMock).toHaveBeenCalledWith('where is the bus?', ['ko', 'ja']);
  });

  it('T1.3/R-6: still 201s with the original text when translation fails (pending status)', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    translateMock.mockRejectedValue(new Error('all providers down'));
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await messagesPOST(fakeReq({ json: { text: 'urgent: meet now' } }), routeParams());
    expect(res.status).toBe(201);
    expect(db.inserted.tour_room_messages[0]).toMatchObject({
      source_text: 'urgent: meet now',
      translations: {},
      metadata: { translation_status: 'pending' },
    });
    expect(broadcastToRoomMock).toHaveBeenCalled();
  });

  it('T1.7/§M-2 ②: quick-reply presets insert pre-translated content with zero LLM calls', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await messagesPOST(fakeReq({ json: { presetKey: 'where_bus' } }), routeParams());
    expect(res.status).toBe(201);
    expect(translateMock).not.toHaveBeenCalled();
    expect(db.inserted.tour_room_messages[0]).toMatchObject({
      source_text: 'Where is the bus?',
      source_locale: 'en',
      translations: expect.objectContaining({ ko: '버스가 어디에 있나요?', ja: 'バスはどこですか？' }),
      metadata: expect.objectContaining({ kind: 'quick_reply', preset_key: 'where_bus' }),
    });
  });

  it('400s an unknown preset key', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    const res = await messagesPOST(fakeReq({ json: { presetKey: 'bogus' } }), routeParams());
    expect(res.status).toBe(400);
  });

  it('T1.3/D-1: broadcasts the committed message to the room channel', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    const res = await messagesPOST(fakeReq({ json: { text: 'hello' } }), routeParams());
    expect(res.status).toBe(201);
    expect(broadcastToRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'room-1' }),
      'message',
      expect.objectContaining({ message: expect.objectContaining({ source_text: 'hello' }) }),
    );
  });
});

describe('POST /api/tour-rooms/[bookingId]/spot-events', () => {
  it('400s an invalid eventType and a missing spotId', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    expect((await spotEventsPOST(fakeReq({ json: { eventType: 'nope', spotId: 's' } }), routeParams())).status).toBe(400);
    expect((await spotEventsPOST(fakeReq({ json: { eventType: 'arrived' } }), routeParams())).status).toBe(400);
  });

  it('403s meeting_notice_sent from a customer, allows it from a merchant guide', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    const denied = await spotEventsPOST(
      fakeReq({ json: { eventType: 'meeting_notice_sent', spotId: 'spot-1' } }),
      routeParams(),
    );
    expect(denied.status).toBe(403);

    getAuthUserMock.mockResolvedValue({ id: 'user-m', role: 'merchant', merchantId: 'merchant-1' });
    const allowed = await spotEventsPOST(
      fakeReq({ json: { eventType: 'meeting_notice_sent', spotId: 'spot-1', meetingTime: '15:00' } }),
      routeParams(),
    );
    expect(allowed.status).toBe(201);
  });

  it('201s an owner arrival inside the radius and records message + event', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await spotEventsPOST(
      fakeReq({ json: { eventType: 'arrived', spotId: 'spot-1', distanceM: 42 } }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    expect(db.inserted.tour_room_messages[0]).toMatchObject({ sender_role: 'system' });
    expect(db.inserted.tour_room_spot_events[0]).toMatchObject({
      spot_id: 'spot-1',
      event_type: 'arrived',
      distance_m: 42,
    });
  });

  it('400s an arrival outside the radius', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    const res = await spotEventsPOST(
      fakeReq({ json: { eventType: 'arrived', spotId: 'spot-1', distanceM: 999999 } }),
      routeParams(),
    );
    expect(res.status).toBe(400);
  });

  it('200s duplicate:true when the UNIQUE event already exists', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    createServerClientMock.mockReturnValue(fakeDb({ existingSpotEvent: { id: 'evt-1' } }));
    const res = await spotEventsPOST(
      fakeReq({ json: { eventType: 'arrived', spotId: 'spot-1', distanceM: 10 } }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
  });

  it('429s the guest path when the PA-4 gate denies', async () => {
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 30000 });
    const res = await spotEventsPOST(
      fakeReq({ json: { eventType: 'arrived', spotId: 'spot-1', contactEmail: 'alex@example.com' } }),
      routeParams(),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  it('never rate-limits role-authenticated requests (gate bypass)', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    await spotEventsPOST(
      fakeReq({ json: { eventType: 'arrived', spotId: 'spot-1', distanceM: 5 } }),
      routeParams(),
    );
    expect(requestGateMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/tour-rooms/[bookingId]/events (SSE)', () => {
  it('403s without any credential, 429s when gated', async () => {
    expect((await eventsGET(fakeReq(), routeParams())).status).toBe(403);
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 10000 });
    expect((await eventsGET(fakeReq(), routeParams())).status).toBe(429);
  });

  it('streams for the guest email match with SSE headers', async () => {
    const res = await eventsGET(
      fakeReq({ query: { contactEmail: 'alex@example.com' }, aborted: true }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
  });
});

describe('GET /api/tour-mode/bookings (KST fix, R-7)', () => {
  it('401s without auth and queries with the KST date when authed', async () => {
    expect((await tourModeBookingsGET(fakeReq())).status).toBe(401);

    // 2026-07-13 16:30 UTC == 2026-07-14 01:30 KST → filter must be 2026-07-14.
    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 6, 13, 16, 30, 0));
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    const gteSpy = jest.fn();
    createServerClientMock.mockReturnValue({
      from: () => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: gteSpy.mockReturnValue({
          order: async () => ({ data: [], error: null }),
        }),
      }),
    });
    const res = await tourModeBookingsGET(fakeReq());
    expect(res.status).toBe(200);
    expect(gteSpy).toHaveBeenCalledWith('tour_date', '2026-07-14');
    jest.restoreAllMocks();
  });
});
