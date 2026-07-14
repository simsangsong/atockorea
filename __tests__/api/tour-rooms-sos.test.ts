/**
 * @jest-environment node
 *
 * T7.1/T7.3 — SOS pipeline (session-only, one-shot location, ops mail,
 * degraded no-location path) and the ops rooms aggregation (SOS pinned).
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as sosPOST } from '@/app/api/tour-rooms/[bookingId]/sos/route';
import { GET as opsRoomsGET } from '@/app/api/admin/tour-ops/rooms/route';
import { getAuthUser, requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { sendEmail } from '@/lib/email';
import { signRoomSession } from '@/lib/tour-room/access';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn(), requireAdmin: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
}));
jest.mock('@/lib/email', () => ({ sendEmail: jest.fn(async () => ({ success: true })) }));
jest.mock('@/lib/tour-room/realtime', () => ({
  broadcastToRoom: jest.fn(async () => ({ ok: true })),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const requireAdminMock = requireAdmin as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const sendEmailMock = sendEmail as jest.Mock;

const BOOKING = {
  id: 'booking-1',
  user_id: null,
  tour_id: 'tour-1',
  merchant_id: 'merchant-1',
  tour_date: '2099-07-20',
  contact_name: 'Alex Kim',
  contact_email: 'alex@example.com',
  contact_phone: null,
  preferred_language: 'en',
};
const ROOM = { id: 'room-1', booking_id: 'booking-1', status: 'active' };

function fakeDb(config: { sosInFeed?: boolean } = {}) {
  const inserted: Array<Record<string, unknown>> = [];
  const client = {
    inserted,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const resolveSelect = async () => {
        if (table === 'bookings') {
          return { data: [{ id: 'booking-1', contact_name: 'Alex', number_of_guests: 2, preferred_language: 'en', status: 'confirmed' }], error: null };
        }
        if (table === 'tour_room_invites') return { data: null, error: null };
        if (table === 'tour_rooms') return { data: [ROOM], error: null };
        if (table === 'tours') return { data: [{ id: 'tour-1', title: 'Busan Top', city: 'Busan' }], error: null };
        if (table === 'tour_room_participants') return { data: [], error: null };
        if (table === 'tour_room_messages') {
          return {
            data: config.sosInFeed
              ? [
                  { id: 'm2', room_id: 'room-1', sender_role: 'customer', source_text: 'help', metadata: { kind: 'sos', latitude: 35.1, longitude: 129.0 }, created_at: '2099-07-20T02:00:00Z' },
                  { id: 'm1', room_id: 'room-1', sender_role: 'guide', source_text: 'hi', metadata: {}, created_at: '2099-07-20T01:00:00Z' },
                ]
              : [],
            error: null,
          };
        }
        return { data: null, error: null };
      };
      for (const method of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'is']) chain[method] = jest.fn(() => chain);
      chain.single = jest.fn(async () => {
        if (table === 'bookings') return { data: BOOKING, error: null };
        return resolveSelect();
      });
      chain.maybeSingle = jest.fn(async () => ({ data: null, error: null }));
      chain.then = (resolve: (v: unknown) => unknown) => resolveSelect().then(resolve);
      chain.upsert = jest.fn(() => ({ select: () => ({ single: async () => ({ data: ROOM, error: null }) }) }));
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        inserted.push(values);
        return { select: () => ({ single: async () => ({ data: { id: 'sos-msg-1', ...values }, error: null }) }) };
      });
      return chain;
    },
  };
  return client;
}

function fakeReq(input?: { headers?: Record<string, string>; json?: unknown; query?: Record<string, string> }) {
  const headers = new Map(Object.entries(input?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    nextUrl: { searchParams: new URLSearchParams(input?.query ?? {}) },
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    json: async () => input?.json ?? {},
  } as never;
}

const routeParams = () => ({ params: Promise.resolve({ bookingId: 'booking-1' }) });
const session = () =>
  signRoomSession({ roomId: 'room-1', bookingId: 'booking-1', participantId: 'p-9', role: 'customer', displayName: 'Alex' }).session;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  createServerClientMock.mockReturnValue(fakeDb());
});

describe('POST /api/tour-rooms/[bookingId]/sos (T7.3)', () => {
  it('403s without a joined room session', async () => {
    const res = await sosPOST(fakeReq({ json: {} }), routeParams());
    expect(res.status).toBe(403);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('records the one-shot location, broadcasts, and mails ops with a maps link', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await sosPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session() }, json: { latitude: 35.18, longitude: 129.22, note: 'lost near the temple' } }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    expect(db.inserted[0].metadata).toMatchObject({
      kind: 'sos',
      latitude: 35.18,
      longitude: 129.22,
      location_one_shot: true,
      note: 'lost near the temple',
    });
    // zero-LLM template with all 5 locales
    expect(Object.keys(db.inserted[0].translations as object).sort()).toEqual(['en', 'es', 'ja', 'ko', 'zh']);
    // ops mail fired (async fire-and-forget — flush microtasks)
    await new Promise((resolve) => setTimeout(resolve, 0));
    const mail = sendEmailMock.mock.calls[0][0];
    expect(mail.subject).toContain('SOS');
    expect(mail.html).toContain('maps.google.com/?q=35.18,129.22');
  });

  it('a location-less SOS still goes out (denied permission path)', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await sosPOST(fakeReq({ headers: { 'x-tour-room-auth': session() }, json: {} }), routeParams());
    expect(res.status).toBe(201);
    expect(db.inserted[0].metadata).not.toHaveProperty('latitude');
  });
});

describe('GET /api/admin/tour-ops/rooms (T7.1)', () => {
  const adminReq = (query?: Record<string, string>) => fakeReq({ query });

  it('403s non-admins', async () => {
    requireAdminMock.mockRejectedValue(new Error('Unauthorized'));
    const res = await opsRoomsGET(adminReq());
    expect(res.status).toBe(403);
  });

  it('aggregates rooms with the SOS flag pinned and counted', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1' });
    createServerClientMock.mockReturnValue(fakeDb({ sosInFeed: true }));
    const res = await opsRoomsGET(adminReq({ date: '2099-07-20' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sos_count).toBe(1);
    expect(json.rooms[0].sos.metadata).toMatchObject({ kind: 'sos', latitude: 35.1 });
    expect(json.rooms[0].message_count).toBe(2);
    expect(json.rooms[0].booking.contact_name).toBe('Alex');
  });
});
