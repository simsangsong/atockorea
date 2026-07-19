/**
 * @jest-environment node
 *
 * V3.1/V3.2/V3.5 — the Smart Guide concierge endpoint: auth, the §D-3
 * hardcoded guardrails (emergency / ops escalation / venue refusal — all
 * zero-LLM), the server-side Tier 0 re-check, the Tier 1 LLM path with its
 * flywheel logging, rate limits, and the global daily budget gate.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as conciergePOST } from '@/app/api/tour-rooms/[bookingId]/concierge/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate, durableIncrWindow } from '@/lib/durable-rate-limit';
import { chatCompletion } from '@/lib/ai/router';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { logChatTurn } from '@/lib/support/chat-logger';
import { signRoomSession } from '@/lib/tour-room/access';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn(), requireAdmin: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
  durableIncrWindow: jest.fn(),
}));
jest.mock('@/lib/ai/router', () => ({ chatCompletion: jest.fn() }));
jest.mock('@/lib/tour-room/realtime', () => ({
  broadcastToRoom: jest.fn(async () => ({ ok: true })),
}));
jest.mock('@/lib/support/chat-logger', () => ({
  logChatTurn: jest.fn(async () => ({ sessionId: 's', userMessageId: 1, assistantMessageId: 2 })),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const durableIncrWindowMock = durableIncrWindow as jest.Mock;
const chatCompletionMock = chatCompletion as jest.Mock;
const broadcastMock = broadcastToRoom as jest.Mock;
const logChatTurnMock = logChatTurn as jest.Mock;

const BOOKING = {
  id: 'booking-1',
  user_id: null,
  tour_id: 'tour-1',
  merchant_id: 'merchant-1',
  tour_date: '2099-07-20',
  contact_name: 'Alex Kim',
  contact_email: 'alex@example.com',
  contact_phone: null,
  preferred_language: 'en',
};
const ROOM = { id: 'room-1', booking_id: 'booking-1', status: 'active' };

function fakeDb(config: { feed?: Array<Record<string, unknown>> } = {}) {
  const inserted: Array<Record<string, unknown>> = [];
  const client = {
    inserted,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const resolveSelect = async () => {
        if (table === 'tour_room_messages') return { data: [...(config.feed ?? [])].reverse(), error: null };
        if (table === 'tour_rooms') return { data: [ROOM], error: null };
        return { data: null, error: null };
      };
      for (const method of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'is']) chain[method] = jest.fn(() => chain);
      chain.single = jest.fn(async () => {
        if (table === 'bookings') return { data: BOOKING, error: null };
        return resolveSelect();
      });
      chain.maybeSingle = jest.fn(async () => {
        if (table === 'bookings') {
          return {
            data: {
              id: 'booking-1',
              tour_date: '2099-07-20',
              tours: {
                title: 'Busan Top Attractions',
                city: 'Busan',
                schedule: [
                  { time: '09:00', title: 'Hotel pickup' },
                  { time: '23:50', title: 'Night view' },
                ],
              },
            },
            error: null,
          };
        }
        return { data: null, error: null };
      });
      chain.then = (resolve: (v: unknown) => unknown) => resolveSelect().then(resolve);
      chain.upsert = jest.fn(() => ({ select: () => ({ single: async () => ({ data: ROOM, error: null }) }) }));
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        inserted.push(values);
        return { select: () => ({ single: async () => ({ data: { id: 'msg-1', ...values }, error: null }) }) };
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
const session = () =>
  signRoomSession({ roomId: 'room-1', bookingId: 'booking-1', participantId: 'p-9', role: 'customer', displayName: 'Alex' }).session;

const ask = (question: string, extra: Record<string, unknown> = {}) =>
  conciergePOST(
    fakeReq({ headers: { 'x-tour-room-auth': session() }, json: { question, locale: 'en', ...extra } }),
    routeParams(),
  );

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  delete process.env.TOUR_ROOM_CONCIERGE_DAILY_CAP;
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  durableIncrWindowMock.mockResolvedValue(1);
  chatCompletionMock.mockResolvedValue({ content: 'A friendly LLM answer.', provider: 'gemini', model: 'flash' });
  createServerClientMock.mockReturnValue(fakeDb());
});

describe('POST /api/tour-rooms/[bookingId]/concierge', () => {
  it('403s without a joined room session', async () => {
    const res = await conciergePOST(fakeReq({ json: { question: 'hello' } }), routeParams());
    expect(res.status).toBe(403);
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('400s without a question', async () => {
    const res = await conciergePOST(
      fakeReq({ headers: { 'x-tour-room-auth': session() }, json: {} }),
      routeParams(),
    );
    expect(res.status).toBe(400);
  });

  it('429s when the participant gate denies', async () => {
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 });
    const res = await ask('anything at all');
    expect(res.status).toBe(429);
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('emergency guardrail bypasses the LLM and points at the SOS surface', async () => {
    const res = await ask('my friend is injured, we need an ambulance');
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.kind).toBe('emergency');
    expect(json.text).toContain('119');
    expect(chatCompletionMock).not.toHaveBeenCalled();
    expect(broadcastMock).not.toHaveBeenCalled();
  });

  it('ops requests escalate: a system message reaches the room feed (V3.3)', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await ask('can I get a refund for this tour?');
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.kind).toBe('escalated');

    expect(db.inserted).toHaveLength(1);
    const message = db.inserted[0];
    expect(message.sender_role).toBe('system');
    expect(message.metadata).toMatchObject({ kind: 'concierge_escalation', asked_by_role: 'customer' });
    expect((message.metadata as { question: string }).question).toContain('refund');
    // Pre-translated 5-locale capsule, question verbatim.
    expect(Object.keys(message.translations as object).sort()).toEqual(['en', 'es', 'ja', 'ko', 'zh']);
    expect(String(message.source_text)).toContain('Alex');
    expect(broadcastMock).toHaveBeenCalledTimes(1);
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('venue recommendations are declined without an LLM call', async () => {
    const res = await ask('recommend a good restaurant near here');
    const json = await res.json();
    expect(json.kind).toBe('refused_venue');
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('Tier 0: a restroom ask answers from the latest arrival content, zero LLM', async () => {
    createServerClientMock.mockReturnValue(
      fakeDb({
        feed: [
          {
            id: 'm1',
            sender_role: 'system',
            source_text: 'arrived',
            metadata: {
              kind: 'spot_arrival',
              spot_title: 'Gamcheon Culture Village',
              content: { convenience: { restroom: 'At the Tourist Information Center' } },
            },
            created_at: '2099-07-20T01:00:00Z',
          },
        ],
      }),
    );
    const res = await ask('where is the restroom?');
    const json = await res.json();
    expect(json.kind).toBe('tier0');
    expect(json.text).toContain('Tourist Information Center');
    expect(chatCompletionMock).not.toHaveBeenCalled();
    expect(logChatTurnMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sessionToken: 'tour-room:room-1' }),
      expect.objectContaining({ category: 'tour_room_concierge_tier0' }),
    );
  });

  it('Tier 1: unmatched questions go to the router and get logged for the flywheel (V3.4)', async () => {
    const res = await ask('is it rude to tip the driver in Korea?');
    const json = await res.json();
    expect(json.kind).toBe('tier1');
    expect(json.text).toBe('A friendly LLM answer.');
    expect(json.provider).toBe('gemini');
    expect(chatCompletionMock).toHaveBeenCalledTimes(1);
    const [purpose, messages, options] = chatCompletionMock.mock.calls[0];
    expect(purpose).toBe('concierge');
    expect(messages[0].role).toBe('system');
    expect(messages[1].content).toContain('Busan Top Attractions');
    expect(messages[1].content).toContain('is it rude to tip');
    expect(options.maxOutputTokens).toBeLessThanOrEqual(400);
    expect(logChatTurnMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sessionToken: 'tour-room:room-1', userLocale: 'en' }),
      expect.objectContaining({ category: 'tour_room_concierge_tier1', userMessage: 'is it rude to tip the driver in Korea?' }),
    );
  });

  it('V3.5: the global daily budget gate stops Tier 1 (guardrails/Tier 0 unaffected)', async () => {
    process.env.TOUR_ROOM_CONCIERGE_DAILY_CAP = '100';
    durableIncrWindowMock.mockResolvedValue(101);
    const res = await ask('some free question with no keywords');
    const json = await res.json();
    expect(json.kind).toBe('budget_exhausted');
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('V3.5: a counter outage fails open (Tier 1 still answers)', async () => {
    durableIncrWindowMock.mockRejectedValue(new Error('redis down'));
    const res = await ask('some free question with no keywords');
    const json = await res.json();
    expect(json.kind).toBe('tier1');
  });
});

describe('B — operator mode (guide / driver)', () => {
  const guideSession = () =>
    signRoomSession({ roomId: 'room-1', bookingId: 'booking-1', participantId: 'g-1', role: 'guide', displayName: 'Guide' })
      .session;
  const askAsGuide = (question: string) =>
    conciergePOST(
      fakeReq({ headers: { 'x-tour-room-auth': guideSession() }, json: { question, locale: 'ko' } }),
      routeParams(),
    );

  it('a guide ops question is answered inline, never escalated to the room feed', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await askAsGuide('can I get a refund for this guest?');
    const json = await res.json();
    // Customer would 'escalate'; the operator IS the handoff, so it answers.
    expect(json.kind).toBe('tier1');
    expect(db.inserted).toHaveLength(0);
    expect(broadcastMock).not.toHaveBeenCalled();
  });

  it('uses the operator (staff-framed) system prompt, not the guest persona', async () => {
    const res = await askAsGuide('draft a message telling guests we leave in 10 minutes');
    await res.json();
    expect(chatCompletionMock).toHaveBeenCalledTimes(1);
    const [, messages] = chatCompletionMock.mock.calls[0];
    expect(messages[0].content).toContain('GUIDE/DRIVER');
  });
});
