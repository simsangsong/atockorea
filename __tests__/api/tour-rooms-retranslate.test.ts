/**
 * @jest-environment node
 *
 * TIER 0 P0 (R-6 completion) — translation repair. A message published during
 * a provider outage carries metadata.translation_status='pending'; this route
 * is the consumer that re-translates it and rebroadcasts the repaired row.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as retranslatePOST } from '@/app/api/tour-rooms/[bookingId]/messages/[messageId]/retranslate/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { translateTextForLocales } from '@/lib/openai-server';
import { signCustomerRoomToken } from '@/lib/tour-room/token';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({ requestGate: jest.fn(), clientIpKey: jest.fn(() => 'ip:test') }));
jest.mock('@/lib/openai-server', () => ({
  translateTextForLocales: jest.fn(),
  generateSpeechMp3: jest.fn(),
  transcribeAudioFile: jest.fn(),
}));
jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => ({ ok: true })) }));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const translateMock = translateTextForLocales as jest.Mock;
const broadcastToRoomMock = jest.requireMock('@/lib/tour-room/realtime').broadcastToRoom as jest.Mock;

const BOOKING = {
  id: 'b1',
  tour_id: 'tour-1',
  tour_date: '2099-07-20',
  user_id: 'u1',
  contact_email: 'a@b.c',
  contact_name: 'A',
  status: 'confirmed',
};

function fakeDb(message: Record<string, unknown> | null) {
  const state: { updated: Record<string, unknown> | null } = { updated: null };
  const client = {
    state,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const resolveSelect = async () => {
        if (table === 'bookings') return { data: BOOKING, error: null };
        if (table === 'tour_room_invites') return { data: null, error: null };
        if (table === 'tour_room_messages') return { data: message, error: null };
        return { data: null, error: null };
      };
      for (const method of ['select', 'eq', 'order', 'limit', 'is', 'in']) {
        chain[method] = jest.fn(() => chain);
      }
      chain.single = jest.fn(resolveSelect);
      chain.maybeSingle = jest.fn(resolveSelect);
      chain.then = (resolve: (v: unknown) => unknown) => resolveSelect().then(resolve);
      chain.upsert = jest.fn(() => ({
        select: () => ({ single: async () => ({ data: { id: 'room-b1', booking_id: 'b1', status: 'active' }, error: null }) }),
      }));
      chain.update = jest.fn((values: Record<string, unknown>) => {
        state.updated = values;
        return {
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({ data: { ...(message ?? {}), ...values }, error: null }),
              }),
            }),
          }),
        };
      });
      return chain;
    },
  };
  return client;
}

function fakeReq(token: string) {
  return {
    nextUrl: { searchParams: new URLSearchParams({ rt: token }) },
    headers: { get: () => null },
  } as never;
}

const params = (messageId: string) => ({ params: Promise.resolve({ bookingId: 'b1', messageId }) });
const customerToken = () => signCustomerRoomToken({ bookingId: 'b1', displayName: 'A', tourDate: '2099-07-20' }).token;

const pendingMessage = () => ({
  id: 'msg-1',
  room_id: 'room-b1',
  sender_role: 'customer',
  source_text: 'où sommes-nous',
  source_locale: 'und',
  translations: {},
  target_locales: ['en', 'ko', 'zh', 'ja', 'es'],
  metadata: { translation_status: 'pending' },
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  translateMock.mockResolvedValue({ source_locale: 'fr', translations: { ko: '우리는 어디에 있나요', en: 'where are we' } });
});

describe('POST /messages/[messageId]/retranslate', () => {
  it('repairs a pending message: re-translates, clears the flag, rebroadcasts', async () => {
    const db = fakeDb(pendingMessage());
    createServerClientMock.mockReturnValue(db);

    const res = await retranslatePOST(fakeReq(customerToken()), params('msg-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.repaired).toBe(true);
    expect(translateMock).toHaveBeenCalledTimes(1);
    expect(translateMock).toHaveBeenCalledWith('où sommes-nous', ['en', 'ko', 'zh', 'ja', 'es']);
    // The outage marker is cleared and translations are populated.
    expect((db.state.updated!.metadata as Record<string, unknown>).translation_status).toBeUndefined();
    expect((db.state.updated!.translations as Record<string, string>).ko).toBe('우리는 어디에 있나요');
    expect(broadcastToRoomMock).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — an already-translated message does no LLM work', async () => {
    const done = { ...pendingMessage(), translations: { ko: 'x' }, metadata: {} };
    createServerClientMock.mockReturnValue(fakeDb(done));

    const res = await retranslatePOST(fakeReq(customerToken()), params('msg-1'));
    expect(res.status).toBe(200);
    expect((await res.json()).repaired).toBe(false);
    expect(translateMock).not.toHaveBeenCalled();
    expect(broadcastToRoomMock).not.toHaveBeenCalled();
  });

  it('404s an unknown message id', async () => {
    createServerClientMock.mockReturnValue(fakeDb(null));
    const res = await retranslatePOST(fakeReq(customerToken()), params('nope'));
    expect(res.status).toBe(404);
  });

  it('403s without a valid credential', async () => {
    createServerClientMock.mockReturnValue(fakeDb(pendingMessage()));
    const res = await retranslatePOST(fakeReq('garbage-token'), params('msg-1'));
    expect(res.status).toBe(403);
  });
});
