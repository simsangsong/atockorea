/**
 * @jest-environment node
 *
 * §11.D D5 — guest add-time → server-authoritative cash overtime charge.
 *
 * MONEY SAFETY under test: the amount is ALWAYS recomputed server-side from
 * the tour's city × requested whole hours; any client-sent amount is ignored.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as extendPOST } from '@/app/api/tour-rooms/[bookingId]/extend/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { signRoomSession } from '@/lib/tour-room/access';
import { sendDriverRoomPush } from '@/lib/tour-room/guestPush';
import { overtimeAmount, rateForCity } from '@/lib/tour-room/overtime';
import { kstToday } from '@/lib/tour-room/time';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
}));
jest.mock('@/lib/tour-room/events', () => ({ recordRoomEvent: jest.fn(async () => ({ inserted: true, event: null })) }));
jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => ({ ok: true })) }));
jest.mock('@/lib/tour-room/guestPush', () => ({ sendDriverRoomPush: jest.fn(async () => ({ sent: 1, pruned: 0 })) }));
jest.mock('@/lib/openai-server', () => ({
  translateTextForLocales: jest.fn(async (text: string) => ({
    source_locale: 'ko',
    translations: { en: text, ko: text, ja: text, es: text, zh: text },
  })),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const sendDriverRoomPushMock = sendDriverRoomPush as jest.Mock;

const BOOKING = {
  id: 'booking-1',
  user_id: 'user-owner',
  tour_id: 'tour-1',
  merchant_id: 'merchant-1',
  tour_date: kstToday(),
  contact_name: 'Alex Kim',
  contact_email: 'alex@example.com',
  contact_phone: null,
  preferred_language: 'ja',
};

/** city drives the rate (부산 40k / 제주 30k / else 30k); price_type gates it. */
function fakeDb(config: { city?: string | null; priceType?: string | null } = {}) {
  const city = config.city ?? '부산';
  const priceType = config.priceType ?? 'vehicle';
  const inserts: Record<string, Array<Record<string, unknown>>> = {};
  const client = {
    inserts,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      chain.single = jest.fn(async () => {
        if (table === 'bookings') return { data: { ...BOOKING }, error: null };
        if (table === 'tours') return { data: { city, price_type: priceType }, error: null };
        return { data: null, error: null };
      });
      chain.maybeSingle = chain.single;
      chain.upsert = jest.fn(() => ({
        select: () => ({
          single: async () => ({ data: { id: 'room-1', booking_id: 'booking-1', status: 'active' }, error: null }),
        }),
      }));
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        (inserts[table] ??= []).push(values);
        return { select: () => ({ single: async () => ({ data: { id: `${table}-1`, ...values }, error: null }) }) };
      });
      return chain;
    },
  };
  return client;
}

function fakeReq(input?: { headers?: Record<string, string>; json?: unknown }) {
  const headers = new Map(Object.entries(input?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    json: async () => input?.json ?? {},
  } as never;
}

const routeParams = () => ({ params: Promise.resolve({ bookingId: 'booking-1' }) });
const session = (role: 'customer' | 'guide' | 'driver' | 'admin') =>
  signRoomSession({ roomId: 'room-1', bookingId: 'booking-1', participantId: `p-${role}`, role, displayName: 'X' }).session;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  createServerClientMock.mockReturnValue(fakeDb());
});

describe('POST /extend — guest add-time', () => {
  it('customer adds hours → server-computed amount (city × hours), ignores any client amount', async () => {
    const db = fakeDb({ city: '부산', priceType: 'vehicle' }); // rate 40,000/h
    createServerClientMock.mockReturnValue(db);
    const res = await extendPOST(
      fakeReq({
        headers: { 'x-tour-room-auth': session('customer') },
        // A malicious/stale client amount MUST be ignored.
        json: { hours: 2, amount_krw: 1 },
      }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const expected = overtimeAmount(2, rateForCity('부산')); // 2 × 40,000 = 80,000
    expect(expected).toBe(80000);
    expect(body).toMatchObject({ ok: true, hours: 2, amount_krw: expected });
    // The row + capsule carry the SERVER amount, not the client's 1.
    const row = db.inserts.tour_room_extras[0];
    expect(row).toMatchObject({ kind: 'overtime', payer: 'driver', status: 'logged', amount_krw: expected, item: '시간추가 2시간' });
    expect(row.amount_krw).not.toBe(1);
    const capsule = db.inserts.tour_room_messages[0];
    expect(capsule.metadata).toMatchObject({ kind: 'extra_ledger', status: 'logged', amount_krw: expected, extra_kind: 'overtime' });
    // Driver + guide were pushed.
    expect(sendDriverRoomPushMock).toHaveBeenCalledTimes(1);
    expect(sendDriverRoomPushMock.mock.calls[0][2].body).toContain('₩80,000');
  });

  it('Jeju rate is 30,000/h (server reads the city, not the body)', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ city: '제주', priceType: 'vehicle' }));
    const res = await extendPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('customer') }, json: { hours: 3 } }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ amount_krw: 90000 });
  });

  it('guide/admin may add on the guest behalf; a DRIVER is rejected (403)', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    const guide = await extendPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('guide') }, json: { hours: 1 } }),
      routeParams(),
    );
    expect(guide.status).toBe(201);
    createServerClientMock.mockReturnValue(fakeDb());
    const driver = await extendPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('driver') }, json: { hours: 1 } }),
      routeParams(),
    );
    expect(driver.status).toBe(403);
  });

  it('non-private (join) tour is rejected 400 private_only', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ priceType: 'person' }));
    const res = await extendPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('customer') }, json: { hours: 1 } }),
      routeParams(),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'private_only' });
  });

  it('rejects out-of-range / non-integer hours with 400', async () => {
    for (const hours of [0, 9, 1.5, -1, 'x', undefined]) {
      createServerClientMock.mockReturnValue(fakeDb());
      const res = await extendPOST(
        fakeReq({ headers: { 'x-tour-room-auth': session('customer') }, json: { hours } }),
        routeParams(),
      );
      expect(res.status).toBe(400);
    }
    // No ledger insert on any rejected request.
    expect(sendDriverRoomPushMock).not.toHaveBeenCalled();
  });

  it('the ledger insert survives a push failure (best-effort push)', async () => {
    sendDriverRoomPushMock.mockRejectedValueOnce(new Error('push down'));
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await extendPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('customer') }, json: { hours: 1 } }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    expect(db.inserts.tour_room_extras).toHaveLength(1);
  });
});
