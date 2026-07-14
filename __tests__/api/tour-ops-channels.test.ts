/**
 * @jest-environment node
 *
 * W2.1 — ops channel directory: admin-only, topics match the join API's
 * derivation (roomChannelTopic) exactly.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET as channelsGET } from '@/app/api/admin/tour-ops/channels/route';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { roomChannelTopic } from '@/lib/tour-room/realtime';

jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));

const requireAdminMock = requireAdmin as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;

const ROOMS = [
  { id: 'room-1', booking_id: 'booking-1', status: 'active' },
  { id: 'room-2', booking_id: 'booking-2', status: 'closed' },
];

function fakeDb(rooms = ROOMS) {
  return {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const method of ['select', 'eq']) {
        chain[method] = jest.fn(() => chain);
      }
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(table === 'tour_rooms' ? { data: rooms, error: null } : { data: null, error: null }).then(
          resolve,
        );
      return chain;
    },
  };
}

function fakeReq(query?: Record<string, string>) {
  return { nextUrl: { searchParams: new URLSearchParams(query ?? {}) } } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  createServerClientMock.mockReturnValue(fakeDb());
});

describe('GET /api/admin/tour-ops/channels (W2.1)', () => {
  it('403s non-admins', async () => {
    requireAdminMock.mockRejectedValue(new Error('Unauthorized'));
    const res = await channelsGET(fakeReq());
    expect(res.status).toBe(403);
  });

  it('400s a malformed date', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1' });
    const res = await channelsGET(fakeReq({ date: '2099/07/20' }));
    expect(res.status).toBe(400);
  });

  it('returns one channel per room with the exact join-derived topic', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1' });
    const res = await channelsGET(fakeReq({ date: '2099-07-20' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.channels).toHaveLength(2);
    // Topic must equal what the join API hands to room clients — same HMAC,
    // same status input (a closed room derives a different topic).
    expect(json.channels[0]).toEqual({
      room_id: 'room-1',
      booking_id: 'booking-1',
      status: 'active',
      topic: roomChannelTopic('room-1', 'active'),
    });
    expect(json.channels[1].topic).toBe(roomChannelTopic('room-2', 'closed'));
    expect(json.channels[1].topic).not.toBe(roomChannelTopic('room-2', 'active'));
  });
});
