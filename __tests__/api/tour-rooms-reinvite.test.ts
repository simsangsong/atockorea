/**
 * @jest-environment node
 *
 * 현장 재합류 (2026-08-04) — the staff-side door for a guest who lost their
 * invite link. Staff-only, audited in tour_room_invites, tour-day expiry.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as reinvitePOST } from '@/app/api/tour-rooms/[bookingId]/reinvite/route';
import { createServerClient } from '@/lib/supabase';
import { resolveRoomActor, ensureRoom } from '@/lib/tour-room/access';
import { requestGate } from '@/lib/durable-rate-limit';
import { verifyRoomToken } from '@/lib/tour-room/token';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/tour-room/access', () => ({
  resolveRoomActor: jest.fn(),
  ensureRoom: jest.fn(async () => ({ id: 'room-1' })),
}));
jest.mock('@/lib/durable-rate-limit', () => ({ requestGate: jest.fn(async () => ({ allowed: true })) }));

const createServerClientMock = createServerClient as jest.Mock;
const resolveRoomActorMock = resolveRoomActor as jest.Mock;

function fakeDb() {
  const inserts: Record<string, unknown>[] = [];
  return {
    inserts,
    client: {
      from: () => ({
        insert: async (row: Record<string, unknown>) => {
          inserts.push(row);
          return { error: null };
        },
      }),
    },
  };
}

const req = () => ({ json: async () => ({}), headers: { get: () => null }, nextUrl: { origin: 'https://atockorea.com' } }) as never;
const params = () => ({ params: Promise.resolve({ bookingId: 'booking-1' }) });
const actor = (role: string) => ({
  ok: true,
  booking: { id: 'booking-1', tour_id: 'tour-1', tour_date: '2099-01-02' },
  actor: { role },
  authUserId: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  (requestGate as jest.Mock).mockResolvedValue({ allowed: true });
  process.env.TOUR_ROOM_TOKEN_SECRET = process.env.TOUR_ROOM_TOKEN_SECRET || 'test-secret';
});

describe('POST /api/tour-rooms/[bookingId]/reinvite', () => {
  it('driver mints a scannable customer join URL and the mint is audited', async () => {
    const { client, inserts } = fakeDb();
    createServerClientMock.mockReturnValue(client);
    resolveRoomActorMock.mockResolvedValue(actor('driver'));
    const res = await reinvitePOST(req(), params());
    expect(res.status).toBe(201);
    const { url } = await res.json();
    expect(url).toContain('/tour-mode/room/booking-1?rt=');
    // The minted token is a real customer token for THIS booking, no wider.
    const token = decodeURIComponent(url.split('rt=')[1]);
    const payload = verifyRoomToken(token);
    expect(payload).toMatchObject({ role: 'customer', scope: 'booking', bookingId: 'booking-1' });
    // Audit row — revocable like any other invite.
    expect(inserts[0]).toMatchObject({ booking_id: 'booking-1', role: 'customer', sent_via: 'onsite-qr' });
    expect(ensureRoom).toHaveBeenCalled();
  });

  it('403s a customer — guests re-enter through a guest-held door, not this one', async () => {
    const { client } = fakeDb();
    createServerClientMock.mockReturnValue(client);
    resolveRoomActorMock.mockResolvedValue(actor('customer'));
    const res = await reinvitePOST(req(), params());
    expect(res.status).toBe(403);
  });

  it('429s when the mint gate closes — no link farming', async () => {
    const { client } = fakeDb();
    createServerClientMock.mockReturnValue(client);
    resolveRoomActorMock.mockResolvedValue(actor('driver'));
    (requestGate as jest.Mock).mockResolvedValue({ allowed: false });
    const res = await reinvitePOST(req(), params());
    expect(res.status).toBe(429);
  });
});
