/**
 * @jest-environment node
 *
 * T3.1 — location relay: session-only identity (anti-forgery), 30s snapshot
 * throttle, 6/min gate, stop-sharing DELETE.
 */
// Must be first: restores real web primitives before next/server is evaluated.
import '@/test-utils/restoreWebPrimitives';
import { POST as locationPOST, DELETE as locationDELETE } from '@/app/api/tour-rooms/[bookingId]/location/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { signCustomerRoomToken } from '@/lib/tour-room/token';
import { signRoomSession } from '@/lib/tour-room/access';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
}));
jest.mock('@/lib/tour-room/realtime', () => ({
  broadcastToRoom: jest.fn(async () => ({ ok: true })),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const broadcastToRoomMock = jest.requireMock('@/lib/tour-room/realtime').broadcastToRoom as jest.Mock;

const BOOKING = {
  id: 'booking-1',
  user_id: 'user-owner',
  tour_id: 'tour-1',
  merchant_id: 'merchant-1',
  tour_date: '2026-07-15',
  contact_name: 'Alex Kim',
  contact_email: 'alex@example.com',
  contact_phone: null,
  preferred_language: 'en',
};
const ROOM = { id: 'room-1', booking_id: 'booking-1', tour_id: 'tour-1', tour_date: '2026-07-15', status: 'active' };

function fakeDb(config: { existingLocationUpdatedAt?: string | null } = {}) {
  const upserts: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const deletes: string[] = [];
  const client = {
    upserts,
    updates,
    deletes,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const resolveSelect = async () => {
        if (table === 'bookings') return { data: BOOKING, error: null };
        if (table === 'tour_room_invites') return { data: null, error: null };
        if (table === 'tour_room_locations') {
          return {
            data:
              config.existingLocationUpdatedAt === undefined || config.existingLocationUpdatedAt === null
                ? null
                : { updated_at: config.existingLocationUpdatedAt },
            error: null,
          };
        }
        return { data: null, error: null };
      };
      for (const method of ['select', 'eq', 'in', 'order', 'limit']) chain[method] = jest.fn(() => chain);
      chain.single = jest.fn(resolveSelect);
      chain.maybeSingle = jest.fn(resolveSelect);
      chain.then = (resolve: (v: unknown) => unknown) => resolveSelect().then(resolve);
      chain.upsert = jest.fn((values: Record<string, unknown>) => {
        upserts.push({ table, ...values });
        if (table === 'tour_rooms') {
          return { select: () => ({ single: async () => ({ data: ROOM, error: null }) }) };
        }
        return { then: (r: (v: unknown) => unknown) => r({ data: null, error: null }) };
      });
      chain.update = jest.fn((values: Record<string, unknown>) => {
        updates.push({ table, ...values });
        return { eq: () => ({ then: (r: (v: unknown) => unknown) => r({ data: null, error: null }) }) };
      });
      chain.delete = jest.fn(() => {
        deletes.push(table);
        return { eq: () => ({ then: (r: (v: unknown) => unknown) => r({ data: null, error: null }) }) };
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
    signal: { aborted: true },
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

const PING = { latitude: 35.18, longitude: 129.22, accuracyM: 12, speedMps: 1.1 };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  createServerClientMock.mockReturnValue(fakeDb());
});

describe('POST /api/tour-rooms/[bookingId]/location (T3.1)', () => {
  it('403s everything but a joined room session — even a valid invite token', async () => {
    const { token } = signCustomerRoomToken({ bookingId: 'booking-1', displayName: 'Alex', tourDate: '2026-07-15' });
    const res = await locationPOST(fakeReq({ query: { rt: token }, json: PING }), routeParams());
    expect(res.status).toBe(403);
  });

  it('ignores a forged body participant_id — identity comes from the session', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await locationPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session() }, json: { ...PING, participant_id: 'victim-1' } }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    const frame = broadcastToRoomMock.mock.calls[0][2].location;
    expect(frame.participant_id).toBe('participant-77');
    expect(requestGateMock).toHaveBeenCalledWith(expect.objectContaining({ key: 'participant:participant-77' }));
  });

  it('400s malformed coordinates', async () => {
    const res = await locationPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session() }, json: { latitude: 999, longitude: 0 } }),
      routeParams(),
    );
    expect(res.status).toBe(400);
  });

  it('429s when the participant gate denies', async () => {
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 8000 });
    const res = await locationPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session() }, json: PING }),
      routeParams(),
    );
    expect(res.status).toBe(429);
    expect(broadcastToRoomMock).not.toHaveBeenCalled();
  });

  it('writes the snapshot when none exists and flags location_sharing', async () => {
    const db = fakeDb({ existingLocationUpdatedAt: null });
    createServerClientMock.mockReturnValue(db);
    const res = await locationPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session() }, json: PING }),
      routeParams(),
    );
    const json = await res.json();
    expect(json.snapshotWritten).toBe(true);
    expect(db.upserts.find((u) => u.table === 'tour_room_locations')).toMatchObject({
      participant_id: 'participant-77',
      latitude: PING.latitude,
    });
    expect(db.updates.find((u) => u.table === 'tour_room_participants')).toMatchObject({ location_sharing: true });
  });

  it('skips the snapshot write inside the 30s window (§O-5) but still broadcasts', async () => {
    const db = fakeDb({ existingLocationUpdatedAt: new Date(Date.now() - 10_000).toISOString() });
    createServerClientMock.mockReturnValue(db);
    const res = await locationPOST(
      fakeReq({ headers: { 'x-tour-room-auth': session() }, json: PING }),
      routeParams(),
    );
    const json = await res.json();
    expect(json.snapshotWritten).toBe(false);
    expect(db.upserts.find((u) => u.table === 'tour_room_locations')).toBeUndefined();
    expect(broadcastToRoomMock).toHaveBeenCalledWith(expect.anything(), 'location', expect.anything());
  });
});

describe('DELETE /api/tour-rooms/[bookingId]/location (T3.4 opt-out)', () => {
  it('removes the snapshot row, clears the flag, and broadcasts the removal', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await locationDELETE(fakeReq({ headers: { 'x-tour-room-auth': session() } }), routeParams());
    expect(res.status).toBe(200);
    expect(db.deletes).toContain('tour_room_locations');
    expect(db.updates.find((u) => u.table === 'tour_room_participants')).toMatchObject({ location_sharing: false });
    expect(broadcastToRoomMock).toHaveBeenCalledWith(
      expect.anything(),
      'location',
      expect.objectContaining({ location: expect.objectContaining({ participant_id: 'participant-77', removed: true }) }),
    );
  });

  it('403s without a session', async () => {
    const res = await locationDELETE(fakeReq(), routeParams());
    expect(res.status).toBe(403);
  });
});
