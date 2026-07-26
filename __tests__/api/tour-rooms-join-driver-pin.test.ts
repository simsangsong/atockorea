/**
 * @jest-environment node
 *
 * P-D3 — the vehicle PIN gate, exercised through the join ROUTE.
 *
 * A pure-function test on checkDriverPin passed all along while the gate was
 * open in production, because the failure was in what the caller could see:
 * the plate lives in the dispatch and the resolver was reading an old sheet.
 * This suite drives POST /join so a wrong PIN has to be rejected end to end.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as joinPOST } from '@/app/api/tour-rooms/[bookingId]/join/route';
import { createServerClient } from '@/lib/supabase';
import { resolveRoomActor, ensureRoom } from '@/lib/tour-room/access';
import { buildRoomSnapshot } from '@/lib/tour-room/snapshot';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/tour-room/access', () => {
  const actual = jest.requireActual('@/lib/tour-room/access');
  return { ...actual, resolveRoomActor: jest.fn(), ensureRoom: jest.fn() };
});
jest.mock('@/lib/tour-room/snapshot', () => {
  const actual = jest.requireActual('@/lib/tour-room/snapshot');
  return { ...actual, buildRoomSnapshot: jest.fn() };
});
jest.mock('@/lib/tour-room/realtime', () => ({
  broadcastToRoom: jest.fn(async () => ({ ok: true })),
  roomChannelTopic: jest.fn(() => 'topic-1'),
}));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(async () => ({ ok: true })),
  clientIpKey: jest.fn(() => 'ip:test'),
}));

const createServerClientMock = createServerClient as jest.Mock;
const resolveRoomActorMock = resolveRoomActor as jest.Mock;
const ensureRoomMock = ensureRoom as jest.Mock;
const buildRoomSnapshotMock = buildRoomSnapshot as jest.Mock;

const DEVICE = '11111111-2222-4333-8444-555555555555';
const FUTURE_DATE = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
const BOOKING = {
  id: 'b1',
  user_id: null,
  tour_id: 'tour-1',
  tour_date: FUTURE_DATE,
  contact_name: 'Guest',
  preferred_language: 'en',
};

/** Serves only what the join route touches: rooms, dispatch, participants. */
function fakeDb(dispatches: Array<Record<string, unknown>>) {
  return {
    from(table: string) {
      if (table === 'tour_rooms') {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.then = (res: (v: unknown) => unknown) =>
          Promise.resolve({ data: [{ id: 'room-1' }], error: null }).then(res);
        return chain;
      }
      if (table === 'ops_room_vehicles') {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.in = () => chain;
        chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: dispatches, error: null }).then(res);
        return chain;
      }
      if (table === 'tour_room_participants') {
        return {
          upsert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'p1', is_lead: false }, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        }),
      };
    },
  };
}

function joinRequest(body: Record<string, unknown>) {
  return new Request('https://x/api/tour-rooms/b1/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

const params = Promise.resolve({ bookingId: 'b1' });

beforeEach(() => {
  jest.clearAllMocks();
  resolveRoomActorMock.mockResolvedValue({
    ok: true,
    booking: BOOKING,
    authUserId: null,
    actor: { kind: 'token', role: 'driver', displayName: '기사님', tokenPayload: { scope: 'tour-date', role: 'driver' } },
  });
  ensureRoomMock.mockResolvedValue({ id: 'room-1', booking_id: 'b1', status: 'active' });
  buildRoomSnapshotMock.mockResolvedValue({ lifecycle: {}, messages: [], participants: [] });
});

describe('driver join — vehicle PIN gate', () => {
  it('rejects a wrong PIN once a plate is dispatched', async () => {
    createServerClientMock.mockReturnValue(fakeDb([{ plate_number: '서울 12가 3456', vehicle: null }]));
    const res = await joinPOST(joinRequest({ deviceKey: DEVICE, token: 't', pin: '1111' }), { params });
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'pin_mismatch' });
  });

  it('asks for a PIN when none is supplied', async () => {
    createServerClientMock.mockReturnValue(fakeDb([{ plate_number: '서울 12가 3456', vehicle: null }]));
    const res = await joinPOST(joinRequest({ deviceKey: DEVICE, token: 't' }), { params });
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'pin_required' });
  });

  it('lets the matching PIN through', async () => {
    createServerClientMock.mockReturnValue(fakeDb([{ plate_number: '서울 12가 3456', vehicle: null }]));
    const res = await joinPOST(joinRequest({ deviceKey: DEVICE, token: 't', pin: '3456' }), { params });
    expect(res.status).toBe(201);
  });

  it('stays open while the dispatch is still type-only (plate unknown until the day)', async () => {
    createServerClientMock.mockReturnValue(fakeDb([{ plate_number: null, vehicle: null }]));
    const res = await joinPOST(joinRequest({ deviceKey: DEVICE, token: 't' }), { params });
    expect(res.status).toBe(201);
  });

  it('does not gate a guest — the PIN is a driver-link defence only', async () => {
    resolveRoomActorMock.mockResolvedValue({
      ok: true,
      booking: BOOKING,
      authUserId: null,
      actor: { kind: 'token', role: 'customer', displayName: 'Guest', tokenPayload: { scope: 'booking', role: 'customer' } },
    });
    createServerClientMock.mockReturnValue(fakeDb([{ plate_number: '서울 12가 3456', vehicle: null }]));
    const res = await joinPOST(joinRequest({ deviceKey: DEVICE, token: 't' }), { params });
    expect(res.status).toBe(201);
  });
});
