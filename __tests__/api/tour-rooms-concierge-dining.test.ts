/**
 * @jest-environment node
 *
 * §5.7 R-2 ③ — the concierge's food promotion.
 *
 * A food ask used to die on the §D-3 `venue_recommendation` guardrail. It now
 * reaches the dining RAG first (real Kakao/Google data — never LLM memory,
 * which is what the guardrail actually forbids), and falls back to the
 * unchanged Tier 0 behaviour when there is nothing to serve. Non-food venue
 * asks (shops, souvenirs) still stop at the guardrail.
 *
 * Also covers the two context regressions this slice fixes: a room whose
 * arrivals came from the A0 `arrival_bundle` path now HAS a current spot, and
 * the route finally forwards `facility_pins` into the Tier 0 context.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as conciergePOST } from '@/app/api/tour-rooms/[bookingId]/concierge/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { chatCompletion } from '@/lib/ai/router';
import { signRoomSession } from '@/lib/tour-room/access';
import { recommendDining } from '@/lib/ops/dining/recommend.server';
import type { DiningCardMeta } from '@/lib/ops/dining/card';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn(), requireAdmin: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
  durableIncrWindow: jest.fn(async () => 1),
}));
jest.mock('@/lib/ai/router', () => ({ chatCompletion: jest.fn() }));
jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => ({ ok: true })) }));
jest.mock('@/lib/support/chat-logger', () => ({ logChatTurn: jest.fn(async () => ({})) }));
jest.mock('@/lib/rag/retrieve', () => ({
  retrieveKnowledge: jest.fn(async () => []),
  buildRagContextText: jest.fn(() => ''),
}));
jest.mock('@/lib/ops/dining/recommend.server', () => ({
  recommendDining: jest.fn(),
  recordShown: jest.fn(async () => true),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const chatCompletionMock = chatCompletion as jest.Mock;
const recommendMock = recommendDining as jest.Mock;

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

const META: DiningCardMeta = {
  kind: 'dining_card',
  poi_key: 'dongmun_market',
  spot_title: 'Dongmun Market',
  cell: 'wydm9q1',
  meal: 'lunch',
  dietary: ['no_pork'],
  source: 'cache',
  places: [
    {
      place_key: 'kakao:1',
      name: '올래국수',
      name_i18n: { en: 'Olrae Noodles' },
      cuisine: '국수',
      category_name: '음식점 > 한식 > 국수',
      lat: 33.51,
      lng: 126.53,
      distance_m: 180,
      walk_min: 2,
      price_band: 1,
      rating: 4.5,
      review_count: 3200,
      tags: [],
      signature_menus: [],
      place_url: 'https://place.map.kakao.com/1',
      open_today: true,
      closes_at: '20:00',
    },
  ],
};

const RESTROOM_PIN = { kind: 'restroom', lat: 33.5101, lng: 126.5301, name: '동문시장 화장실', isVerified: true };

function fakeDb(config: { feed?: Array<Record<string, unknown>>; poi?: Record<string, { lat: number; lng: number }> } = {}) {
  const poi = config.poi ?? { dongmun_market: { lat: 33.51, lng: 126.53 } };
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const filters: Record<string, unknown> = {};
      const resolveSelect = async () => {
        if (table === 'tour_room_messages') return { data: [...(config.feed ?? [])].reverse(), error: null };
        return { data: null, error: null };
      };
      for (const method of ['select', 'neq', 'in', 'order', 'limit', 'is', 'gte']) chain[method] = jest.fn(() => chain);
      chain.eq = jest.fn((col: string, value: unknown) => {
        filters[col] = value;
        return chain;
      });
      chain.single = jest.fn(async () => (table === 'bookings' ? { data: BOOKING, error: null } : resolveSelect()));
      chain.maybeSingle = jest.fn(async () => {
        if (table === 'bookings') {
          return {
            data: { id: 'booking-1', tour_date: '2099-07-20', tours: { title: 'Jeju day', city: 'Jeju', schedule: [] } },
            error: null,
          };
        }
        if (table === 'match_pois') return { data: poi[String(filters.poi_key)] ?? null, error: null };
        return { data: null, error: null };
      });
      chain.then = (resolve: (v: unknown) => unknown) => resolveSelect().then(resolve);
      chain.upsert = jest.fn(() => ({ select: () => ({ single: async () => ({ data: ROOM, error: null }) }) }));
      chain.insert = jest.fn((values: Record<string, unknown>) => ({
        select: () => ({ single: async () => ({ data: { id: 'msg-1', ...values }, error: null }) }),
      }));
      return chain;
    },
  };
}

function fakeReq(json: unknown) {
  const token = signRoomSession({
    roomId: 'room-1',
    bookingId: 'booking-1',
    participantId: 'p-9',
    role: 'customer',
    displayName: 'Alex',
  }).session;
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    headers: { get: (name: string) => (name.toLowerCase() === 'x-tour-room-auth' ? token : null) },
    json: async () => json,
  } as never;
}

const routeParams = () => ({ params: Promise.resolve({ bookingId: 'booking-1' }) });
const ask = (question: string) => conciergePOST(fakeReq({ question, locale: 'en' }), routeParams());

/** A room whose only arrival came from the A0 one-tap bundle. */
const bundleFeed = (extra: Record<string, unknown> = {}) => [
  {
    id: 'm1',
    metadata: { kind: 'arrival_bundle', spot_title: 'Dongmun Market', poi_key: 'dongmun_market', ...extra },
    created_at: '2099-07-20T03:00:00Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  chatCompletionMock.mockResolvedValue({ content: 'llm', provider: 'x' });
  recommendMock.mockResolvedValue({ meta: { ...META }, shown: [] });
});

describe('concierge — food promotion', () => {
  it('serves the dining card instead of the blanket venue refusal', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ feed: bundleFeed() }));
    const res = await ask('where should we eat around here?');
    const json = (await res.json()) as { kind: string; text: string; card: DiningCardMeta };
    expect(json.kind).toBe('tier0_dining');
    expect(json.card.kind).toBe('dining_card');
    expect(json.card.places).toHaveLength(1);
    expect(json.text).toContain('Olrae Noodles');
    // The whole point of the promotion: no LLM was involved.
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('falls back to the unchanged refusal when the RAG has nothing', async () => {
    recommendMock.mockResolvedValue(null);
    createServerClientMock.mockReturnValue(fakeDb({ feed: bundleFeed() }));
    const res = await ask('where should we eat around here?');
    const json = (await res.json()) as { kind: string; text: string };
    expect(json.kind).toBe('refused_venue');
    expect(json.text).toContain('your guide');
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('a NON-food venue ask still stops at the §D-3 guardrail', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ feed: bundleFeed() }));
    const res = await ask('any good souvenir shop nearby for shopping?');
    expect((await res.json()).kind).toBe('refused_venue');
    expect(recommendMock).not.toHaveBeenCalled();
  });

  it('no arrival at all → no dining lookup, unchanged refusal', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ feed: [] }));
    const res = await ask('recommend a good restaurant near here');
    expect((await res.json()).kind).toBe('refused_venue');
    expect(recommendMock).not.toHaveBeenCalled();
  });
});

describe('concierge — arrival context regressions', () => {
  it('an arrival_bundle room now HAS a current spot (the dining lookup proves it)', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ feed: bundleFeed() }));
    await ask('where should we eat around here?');
    expect(recommendMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ spotTitle: 'Dongmun Market', poiKey: 'dongmun_market', lat: 33.51, lng: 126.53 }),
    );
  });

  it('facility_pins from the arrival now reach Tier 0 (restroom map card)', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ feed: bundleFeed({ facility_pins: [RESTROOM_PIN] }) }));
    const res = await ask('where is the restroom?');
    const json = (await res.json()) as { kind: string; text: string; mapCard?: { kind: string; pins: unknown[] } };
    expect(json.kind).toBe('tier0');
    expect(json.mapCard?.kind).toBe('restroom');
    expect(json.mapCard?.pins).toHaveLength(1);
    expect(json.text).toContain('Dongmun Market');
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });
});
