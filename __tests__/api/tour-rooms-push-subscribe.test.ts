/**
 * @jest-environment node
 *
 * W4.1 / P-D7 — the booking-scoped push subscribe door.
 *
 * Two things this file pins (2026-08-04):
 *  - the stored-SSRF guard now covers THIS door too — the guest route stored
 *    endpoints unchecked while the ops route validated them, same table,
 *    same later send path
 *  - Samsung Internet's push host is accepted — its absence from the shared
 *    allow-list made every subscribe from the domestic default browser fail
 *  - the role gate: admin viewing a room is refused (403), which is what an
 *    owner tapping 알림 in an admin-opened room actually hits
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as subscribePOST } from '@/app/api/tour-rooms/[bookingId]/push-subscribe/route';
import { createServerClient } from '@/lib/supabase';
import { resolveRoomActor } from '@/lib/tour-room/access';
import { requestGate } from '@/lib/durable-rate-limit';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/tour-room/access', () => ({ resolveRoomActor: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({ requestGate: jest.fn() }));

const createServerClientMock = createServerClient as jest.Mock;
const resolveRoomActorMock = resolveRoomActor as jest.Mock;
const requestGateMock = requestGate as jest.Mock;

function fakeDb() {
  const inserts: Record<string, unknown>[] = [];
  // delete().eq('endpoint', …) is awaited directly in the subscribe path and
  // chained .eq().eq() in the unsubscribe path — the mock serves both.
  const del = {
    eq: jest.fn(() => Object.assign(Promise.resolve({ error: null }), { eq: jest.fn(async () => ({ error: null })) })),
  };
  const client = {
    from: jest.fn(() => ({
      delete: () => del,
      insert: async (row: Record<string, unknown>) => {
        inserts.push(row);
        return { error: null };
      },
    })),
  };
  return { client, inserts };
}

function req(body: unknown) {
  return {
    json: async () => body,
    headers: { get: () => 'jest-ua' },
  } as never;
}
const params = () => ({ params: Promise.resolve({ bookingId: 'booking-1' }) });

const actorOk = (role: string) => ({
  ok: true,
  booking: { id: 'booking-1' },
  actor: { role },
  authUserId: null,
});

const sub = (endpoint: string) => ({
  subscription: { endpoint, keys: { p256dh: 'k1', auth: 'a1' } },
});

beforeEach(() => {
  jest.clearAllMocks();
  requestGateMock.mockResolvedValue({ allowed: true });
});

describe('POST /api/tour-rooms/[bookingId]/push-subscribe', () => {
  it('201s a customer on a known push service — Samsung Internet included', async () => {
    for (const endpoint of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://useast.push.samsungosp.com/spp/pns/abc',
    ]) {
      const { client, inserts } = fakeDb();
      createServerClientMock.mockReturnValue(client);
      resolveRoomActorMock.mockResolvedValue(actorOk('customer'));
      const res = await subscribePOST(req(sub(endpoint)), params());
      expect(res.status).toBe(201);
      expect(inserts[0]).toMatchObject({ role: 'customer', booking_id: 'booking-1', endpoint });
    }
  });

  it('400s an endpoint outside the push-service allow-list (stored-SSRF guard)', async () => {
    const { client, inserts } = fakeDb();
    createServerClientMock.mockReturnValue(client);
    resolveRoomActorMock.mockResolvedValue(actorOk('customer'));
    for (const endpoint of ['http://169.254.169.254/latest', 'https://evil.example/x', 'http://fcm.googleapis.com/x']) {
      const res = await subscribePOST(req(sub(endpoint)), params());
      expect(res.status).toBe(400);
    }
    expect(inserts).toHaveLength(0);
  });

  it('403s an admin — the room push door is for the people on the tour', async () => {
    const { client } = fakeDb();
    createServerClientMock.mockReturnValue(client);
    resolveRoomActorMock.mockResolvedValue(actorOk('admin'));
    const res = await subscribePOST(req(sub('https://fcm.googleapis.com/fcm/send/abc')), params());
    expect(res.status).toBe(403);
  });
});
