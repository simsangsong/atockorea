/**
 * @jest-environment node
 *
 * Unsend (2026-08-04) — tombstone with a 15-minute window. Staff own their
 * role's messages; a guest owns only rows stamped with their participant id.
 */
import '@/test-utils/restoreWebPrimitives';
import { DELETE as unsendDELETE } from '@/app/api/tour-rooms/[bookingId]/messages/[messageId]/route';
import { createServerClient } from '@/lib/supabase';
import { resolveRoomActor, ensureRoom } from '@/lib/tour-room/access';
import { broadcastToRoom } from '@/lib/tour-room/realtime';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/tour-room/access', () => ({
  resolveRoomActor: jest.fn(),
  ensureRoom: jest.fn(async () => ({ id: 'room-1' })),
}));
jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => undefined) }));

const createServerClientMock = createServerClient as jest.Mock;
const resolveRoomActorMock = resolveRoomActor as jest.Mock;

function fakeDb(message: Record<string, unknown> | null) {
  const updates: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: message }) }) }),
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return {
          eq: () => ({
            select: () => ({ single: async () => ({ data: { ...message, ...patch }, error: null }) }),
          }),
        };
      },
    }),
  };
  return { client, updates };
}

const req = () => ({ headers: { get: () => null } }) as never;
const params = () => ({ params: Promise.resolve({ bookingId: 'booking-1', messageId: 'm-1' }) });
const actor = (role: string, participantId = 'p-1') => ({
  ok: true,
  booking: { id: 'booking-1' },
  actor: { kind: 'session', role, sessionPayload: { participantId } },
  authUserId: null,
});
const freshMsg = (over: Record<string, unknown> = {}) => ({
  id: 'm-1',
  room_id: 'room-1',
  sender_role: 'driver',
  created_at: new Date(Date.now() - 60 * 1000).toISOString(),
  metadata: {},
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('DELETE /messages/[messageId] (unsend)', () => {
  it('driver tombstones their own fresh message and it rebroadcasts', async () => {
    const { client, updates } = fakeDb(freshMsg());
    createServerClientMock.mockReturnValue(client);
    resolveRoomActorMock.mockResolvedValue(actor('driver'));
    const res = await unsendDELETE(req(), params());
    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({ source_text: '', translations: {} });
    expect((updates[0].metadata as Record<string, unknown>).deleted).toBe(true);
    expect(broadcastToRoom).toHaveBeenCalled();
    expect(ensureRoom).toHaveBeenCalled();
  });

  it('a guest deletes only a message stamped with THEIR participant id', async () => {
    const mine = freshMsg({ sender_role: 'customer', metadata: { sender_participant_id: 'p-1' } });
    const { client } = fakeDb(mine);
    createServerClientMock.mockReturnValue(client);
    resolveRoomActorMock.mockResolvedValue(actor('customer', 'p-1'));
    expect((await unsendDELETE(req(), params())).status).toBe(200);

    const someoneElses = freshMsg({ sender_role: 'customer', metadata: { sender_participant_id: 'p-2' } });
    const { client: client2 } = fakeDb(someoneElses);
    createServerClientMock.mockReturnValue(client2);
    resolveRoomActorMock.mockResolvedValue(actor('customer', 'p-1'));
    expect((await unsendDELETE(req(), params())).status).toBe(403);
  });

  it('the window closes at 15 minutes — a stale regret is permanent', async () => {
    const old = freshMsg({ created_at: new Date(Date.now() - 16 * 60 * 1000).toISOString() });
    const { client } = fakeDb(old);
    createServerClientMock.mockReturnValue(client);
    resolveRoomActorMock.mockResolvedValue(actor('driver'));
    expect((await unsendDELETE(req(), params())).status).toBe(403);
  });

  it('staff role must match the message role — a driver cannot unsend the guide', async () => {
    const guides = freshMsg({ sender_role: 'guide' });
    const { client } = fakeDb(guides);
    createServerClientMock.mockReturnValue(client);
    resolveRoomActorMock.mockResolvedValue(actor('driver'));
    expect((await unsendDELETE(req(), params())).status).toBe(403);
  });
});
