/**
 * @jest-environment node
 *
 * T2 slice 3 — the driver's one-tap signals fan out to EVERY booking on a
 * SHARED tour (bus / small-group, price_type person/group), but stay a single
 * room for a PRIVATE charter (vehicle).
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as signalPOST } from '@/app/api/tour-rooms/[bookingId]/driver-signal/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { signRoomSession } from '@/lib/tour-room/access';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({ requestGate: jest.fn(), clientIpKey: jest.fn(() => 'ip:test') }));
jest.mock('@/lib/tour-room/events', () => ({ recordRoomEvent: jest.fn(async () => ({ inserted: true, event: null })) }));
jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => ({ ok: true })) }));
jest.mock('@/lib/tour-ops/push', () => ({ sendOpsPush: jest.fn(async () => ({})) }));
jest.mock('@/lib/tour-room/guestPush', () => ({ sendGuestRoomPush: jest.fn(async () => ({ sent: 0, pruned: 0 })) }));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const broadcastMock = jest.requireMock('@/lib/tour-room/realtime').broadcastToRoom as jest.Mock;

const BOOKING = {
  id: 'b1',
  user_id: 'u1',
  tour_id: 'tour-1',
  merchant_id: 'm1',
  tour_date: '2099-07-20',
  contact_name: 'A',
  contact_email: 'a@b.c',
  contact_phone: null,
  preferred_language: 'ja',
};
const DAY_BOOKINGS = [
  { id: 'b1', tour_id: 'tour-1', tour_date: '2099-07-20', preferred_language: 'ja' },
  { id: 'b2', tour_id: 'tour-1', tour_date: '2099-07-20', preferred_language: 'es' },
  { id: 'b3', tour_id: 'tour-1', tour_date: '2099-07-20', preferred_language: 'en' },
];

function fakeDb(priceType: string) {
  const inserts: Record<string, Array<Record<string, unknown>>> = {};
  const client = {
    inserts,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      const single = async () => {
        if (table === 'bookings') return { data: { ...BOOKING }, error: null };
        if (table === 'tours') return { data: { price_type: priceType }, error: null };
        if (table === 'tour_room_pins') return { data: { id: `pin-${(inserts.tour_room_pins?.length ?? 0)}` }, error: null };
        return { data: null, error: null };
      };
      chain.single = jest.fn(single);
      chain.maybeSingle = jest.fn(single);
      // `await chain` (dayBookings) resolves the fan-out booking list.
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        (table === 'bookings' ? Promise.resolve({ data: DAY_BOOKINGS, error: null }) : single()).then(res, rej);
      chain.upsert = jest.fn((values: Record<string, unknown>) => ({
        select: () => ({
          single: async () => ({ data: { id: `room-${values.booking_id}`, booking_id: values.booking_id, status: 'active' }, error: null }),
        }),
      }));
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        (inserts[table] ??= []).push(values);
        return { select: () => ({ single: async () => ({ data: { id: `${table}-${inserts[table].length}`, ...values }, error: null }) }) };
      });
      return chain;
    },
  };
  return client;
}

function fakeReq(session: string, json: unknown) {
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    headers: { get: (name: string) => (name.toLowerCase() === 'x-tour-room-auth' ? session : null) },
    json: async () => json,
  } as never;
}

const params = () => ({ params: Promise.resolve({ bookingId: 'b1' }) });
const driverSession = () =>
  signRoomSession({ roomId: 'room-b1', bookingId: 'b1', participantId: 'p-driver', role: 'driver', displayName: 'D' }).session;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
});

describe('driver-signal fan-out (T2 slice 3)', () => {
  it('a SHARED tour delivers 타세요 to every booking on the day', async () => {
    const db = fakeDb('person');
    createServerClientMock.mockReturnValue(db);
    const res = await signalPOST(fakeReq(driverSession(), { type: 'vehicle_arrived' }), params());
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.delivered).toBe(3);
    expect(db.inserts.tour_room_messages).toHaveLength(3);
    expect(db.inserts.tour_room_messages.map((m) => m.booking_id).sort()).toEqual(['b1', 'b2', 'b3']);
    expect(broadcastMock).toHaveBeenCalledTimes(3);
  });

  it('a PRIVATE charter stays a single room', async () => {
    const db = fakeDb('vehicle');
    createServerClientMock.mockReturnValue(db);
    const res = await signalPOST(fakeReq(driverSession(), { type: 'vehicle_arrived' }), params());
    expect(res.status).toBe(201);
    expect((await res.json()).delivered).toBe(1);
    expect(db.inserts.tour_room_messages).toHaveLength(1);
    expect(broadcastMock).toHaveBeenCalledTimes(1);
  });

  it('a parking pin fans out one pin + message per room on a shared tour', async () => {
    const db = fakeDb('person');
    createServerClientMock.mockReturnValue(db);
    const res = await signalPOST(fakeReq(driverSession(), { type: 'parking_pin', lat: 33.5, lng: 126.5 }), params());
    expect(res.status).toBe(201);
    expect(db.inserts.tour_room_pins).toHaveLength(3);
    expect(db.inserts.tour_room_messages).toHaveLength(3);
    // The pin URL is embedded in every locale's message so each room renders it.
    expect((db.inserts.tour_room_messages[0].translations as Record<string, string>).en).toContain('maps.google.com');
  });
});
