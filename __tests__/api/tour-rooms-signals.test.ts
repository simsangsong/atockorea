/**
 * @jest-environment node
 *
 * W2.4 — guest one-tap signals: templates, lost_me pin, rally_overdue dedupe.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as signalsPOST } from '@/app/api/tour-rooms/[bookingId]/signals/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { signRoomSession } from '@/lib/tour-room/access';
import { recordRoomEvent } from '@/lib/tour-room/events';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
}));
jest.mock('@/lib/tour-room/events', () => ({ recordRoomEvent: jest.fn(async () => ({ inserted: true, event: null })) }));
jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => ({ ok: true })) }));
jest.mock('@/lib/tour-room/guestPush', () => ({ sendGuestRoomPush: jest.fn(async () => ({ sent: 0, pruned: 0 })) }));
jest.mock('@/lib/email', () => ({ sendEmail: jest.fn(async () => ({ success: true })) }));
jest.mock('@/lib/tour-ops/push', () => ({ sendOpsPush: jest.fn(async () => ({ sent: 0, pruned: 0 })), isGonePushStatus: jest.fn(() => false) }));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const recordRoomEventMock = recordRoomEvent as jest.Mock;

const FIXED_NOW_MS = Date.UTC(2026, 6, 14, 3, 0, 0);

const BOOKING = {
  id: 'booking-1',
  user_id: 'user-owner',
  tour_id: 'tour-1',
  merchant_id: 'merchant-1',
  tour_date: new Date(FIXED_NOW_MS).toISOString().slice(0, 10),
  contact_name: 'Alex Kim',
  contact_email: 'alex@example.com',
  contact_phone: null,
  preferred_language: 'ja',
};

function fakeDb() {
  const inserts: Record<string, Array<Record<string, unknown>>> = {};
  const client = {
    inserts,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      const resolve = async () => (table === 'bookings' ? { data: { ...BOOKING }, error: null } : { data: null, error: null });
      chain.single = jest.fn(resolve);
      chain.maybeSingle = jest.fn(resolve);
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

const session = (role: 'customer' | 'driver', participantId = 'p-1') =>
  signRoomSession({ roomId: 'room-1', bookingId: 'booking-1', participantId, role, displayName: 'Alex' }).session;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  createServerClientMock.mockReturnValue(fakeDb());
  jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
});

afterEach(() => {
  (Date.now as jest.Mock).mockRestore?.();
});

describe('POST /api/tour-rooms/[bookingId]/signals', () => {
  it('rest_stop fans out the 5-locale capsule with the sender name', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await signalsPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('customer') }, json: { type: 'rest_stop' } }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    const msg = db.inserts.tour_room_messages[0];
    expect(msg.metadata).toMatchObject({ kind: 'guest_rest_stop', signal_type: 'rest_stop' });
    expect((msg.translations as Record<string, string>).ko).toContain('정차');
    expect((msg.translations as Record<string, string>).en).toContain('Alex');
    expect(recordRoomEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'signal', payload: expect.objectContaining({ signal: 'rest_stop' }) }),
    );
  });

  it('lost with coords writes a lost_me pin with a 30min TTL + maps link', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await signalsPOST(
      fakeReq({
        headers: { 'x-tour-room-auth': session('customer') },
        json: { type: 'lost', lat: 33.45, lng: 126.9 },
      }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    const pin = db.inserts.tour_room_pins[0];
    expect(pin).toMatchObject({ kind: 'lost_me', lat: 33.45, lng: 126.9 });
    expect(new Date(pin.expires_at as string).getTime()).toBe(FIXED_NOW_MS + 30 * 60 * 1000);
    const msg = db.inserts.tour_room_messages[0];
    expect((msg.translations as Record<string, string>).en).toContain('maps.google.com');
    expect((await res.json()).pin_id).toBe('tour_room_pins-1');
  });

  it('rally_overdue inserts once and dedupes after (P-D6)', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const first = await signalsPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('customer') }, json: { type: 'rally_overdue', noticeId: 'n-1' } }),
      routeParams(),
    );
    expect(first.status).toBe(201);
    expect(recordRoomEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'rally_stage', subjectKey: 'rally:n-1:overdue' }),
    );
    expect(db.inserts.tour_room_messages).toHaveLength(1);

    recordRoomEventMock.mockResolvedValueOnce({ inserted: false, event: null });
    const second = await signalsPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('customer') }, json: { type: 'rally_overdue', noticeId: 'n-1' } }),
      routeParams(),
    );
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ deduped: true });
    expect(db.inserts.tour_room_messages).toHaveLength(1); // still one
  });

  it('rejects drivers and unknown types', async () => {
    const asDriver = await signalsPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('driver') }, json: { type: 'rest_stop' } }),
      routeParams(),
    );
    expect(asDriver.status).toBe(403);
    const badType = await signalsPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('customer') }, json: { type: 'nap' } }),
      routeParams(),
    );
    expect(badType.status).toBe(400);
  });

  it('lost_item works in the post_tour window, freezes after 48h (I3/P-D12)', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const live = await signalsPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('customer') }, json: { type: 'lost_item' } }),
      routeParams(),
    );
    expect(live.status).toBe(201);
    expect(db.inserts.tour_room_messages[0].metadata).toMatchObject({ kind: 'guest_lost_item' });

    // 5 days after the tour: past end + 48h -> frozen
    (Date.now as jest.Mock).mockReturnValue(FIXED_NOW_MS + 5 * 24 * 60 * 60 * 1000);
    const frozen = await signalsPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session('customer') }, json: { type: 'lost_item' } }),
      routeParams(),
    );
    expect(frozen.status).toBe(403);
    expect(await frozen.json()).toMatchObject({ error: 'post_tour_window_closed' });
  });
});
