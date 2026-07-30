/**
 * @jest-environment node
 *
 * B5 — operator end-of-day summary aggregation.
 * (docs/smart-guide-ops-detail-audit-2026-07-21.md)
 */
import '@/test-utils/restoreWebPrimitives';
import { GET as summaryGET } from '@/app/api/tour-rooms/[bookingId]/day-summary/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { signRoomSession } from '@/lib/tour-room/access';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;

const BOOKING = {
  id: 'b1',
  user_id: 'u1',
  tour_id: 'tour-1',
  merchant_id: 'm1',
  tour_date: '2099-07-21',
  contact_name: 'A',
  contact_email: 'a@b.c',
  contact_phone: null,
  preferred_language: 'ja',
};

const EVENTS = [
  { created_at: '2099-07-21T00:00:00Z', payload: { poi_key: 'seongsan', title: 'Seongsan' } },
  { created_at: '2099-07-21T00:10:00Z', payload: { poi_key: 'seongsan', title: 'Seongsan' } }, // re-announce
  { created_at: '2099-07-21T02:00:00Z', payload: { poi_key: 'udo', title: 'Udo Island' } },
];
const EXTRAS = [
  { amount_krw: 30000, kind: 'overtime', status: 'settled' },
  { amount_krw: 12000, kind: 'parking', status: 'logged' },
  { amount_krw: 99999, kind: 'other', status: 'voided' },
];

function fakeDb() {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      const single = async () =>
        table === 'bookings' ? { data: { ...BOOKING }, error: null } : { data: null, error: null };
      chain.single = jest.fn(single);
      chain.maybeSingle = jest.fn(single);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
        const value =
          table === 'tour_room_events'
            ? { data: EVENTS, error: null }
            : table === 'tour_room_extras'
              ? { data: EXTRAS, error: null }
              : { data: null, error: null };
        return Promise.resolve(value).then(res, rej);
      };
      if (table === 'tour_day_plans') {
        chain.maybeSingle = jest.fn(async () => ({
          data: { stops: [{ poi_key: 'udo', duration_min: 60 }] },
          error: null,
        }));
      }
      chain.upsert = jest.fn(() => ({
        select: () => ({
          single: async () => ({ data: { id: 'room-b1', booking_id: 'b1', status: 'active' }, error: null }),
        }),
      }));
      chain.insert = jest.fn(() => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }));
      return chain;
    },
  };
}

function fakeReq(session: string) {
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    headers: { get: (name: string) => (name.toLowerCase() === 'x-tour-room-auth' ? session : null) },
    json: async () => ({}),
  } as never;
}

const params = () => ({ params: Promise.resolve({ bookingId: 'b1' }) });
const driverSession = () =>
  signRoomSession({ roomId: 'room-b1', bookingId: 'b1', participantId: 'p-driver', role: 'driver', displayName: 'D' }).session;
const customerSession = () =>
  signRoomSession({ roomId: 'room-b1', bookingId: 'b1', participantId: 'p-c', role: 'customer', displayName: 'C' }).session;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  createServerClientMock.mockReturnValue(fakeDb());
});

describe('GET /day-summary', () => {
  it('deduplicates visits, computes the span, rolls up money (voided excluded)', async () => {
    const res = await summaryGET(fakeReq(driverSession()), params());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.visited).toHaveLength(2);
    expect(json.visited[1].title).toBe('Udo Island');
    expect(json.span.minutes).toBe(120);
    expect(json.money).toMatchObject({
      logged_total: 42000,
      settled_total: 30000,
      unsettled_total: 12000,
      overtime_total: 30000,
      count: 2,
    });
  });

  it('C5: current-stop dwell vs the plan recommended stay', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2099-07-21T02:43:00Z').getTime()); // 43min after Udo
    const res = await summaryGET(fakeReq(driverSession()), params());
    const json = await res.json();
    expect(json.current).toMatchObject({
      title: 'Udo Island',
      dwell_minutes: 43,
      recommended_minutes: 60,
    });
    (Date.now as jest.Mock).mockRestore?.();
  });

  it('pressure: future/clock-skewed last event shows NO current dwell (not "0분째")', async () => {
    // Real Date.now (2026) < the 2099 fixture events → raw dwell negative.
    const res = await summaryGET(fakeReq(driverSession()), params());
    const json = await res.json();
    expect(json.current).toBeNull();
  });

  it('pressure: a session signed for ANOTHER booking is rejected', async () => {
    const foreign = signRoomSession({
      roomId: 'room-x',
      bookingId: 'other-booking',
      participantId: 'p-driver',
      role: 'driver',
      displayName: 'D',
    }).session;
    const res = await summaryGET(fakeReq(foreign), params());
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('rejects customers', async () => {
    const res = await summaryGET(fakeReq(customerSession()), params());
    expect(res.status).toBe(403);
  });
});

/**
 * 🔴 FA-005 (full-app audit 2026-07-30) — the four「오늘의 나」metrics nothing
 * measured.
 *
 * SG-7's completion ledger claims a unit for the day-summary metrics, naming the
 * two subtle ones itself: "정시 체인 = superseded 접기, 응답 중앙값 ≤600s 갭".
 * The commit that shipped them touched four files and none was a test, and the
 * existing suite above never mentions `ontime`, `median_seconds`, `response` or
 * `superseded`. These are the numbers a driver is shown about their own day, so
 * being quietly wrong is worse than being absent.
 *
 * Each case is one of the four, with the arithmetic chosen so a plausible wrong
 * implementation gives a different answer:
 *   ontime      — an extended chain must count ONCE, not twice
 *   response    — the median of the gaps, and only gaps ≤600s
 *   narration   — arrival capsules, not every system message
 *   photos      — staff attachments, not guest ones
 */
describe('FA-005 — the four metrics behind 「오늘의 나」', () => {
  const T = (min: number) => new Date(Date.UTC(2099, 6, 21, 0, min, 0)).toISOString();

  /** A db whose rally events and messages are the fixture for one case. */
  function metricsDb(opts: {
    rally?: Array<Record<string, unknown>>;
    messages?: Array<Record<string, unknown>>;
  }) {
    return {
      from(table: string) {
        const chain: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit']) chain[m] = jest.fn(() => chain);
        const single = async () =>
          table === 'bookings' ? { data: { ...BOOKING }, error: null } : { data: null, error: null };
        chain.single = jest.fn(single);
        chain.maybeSingle = jest.fn(single);
        chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
          const value =
            table === 'tour_room_events'
              ? { data: opts.rally ?? [], error: null }
              : table === 'tour_room_messages'
                ? { data: opts.messages ?? [], error: null }
                : table === 'tour_room_extras'
                  ? { data: [], error: null }
                  : { data: null, error: null };
          return Promise.resolve(value).then(res, rej);
        };
        chain.upsert = jest.fn(() => ({
          select: () => ({
            single: async () => ({ data: { id: 'room-b1', booking_id: 'b1', status: 'active' }, error: null }),
          }),
        }));
        chain.insert = jest.fn(() => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }));
        return chain;
      },
    };
  }

  const me = async (opts: Parameters<typeof metricsDb>[0]) => {
    createServerClientMock.mockReturnValue(metricsDb(opts));
    const res = await summaryGET(fakeReq(driverSession()), params());
    expect(res.status).toBe(200);
    return (await res.json()).me as {
      ontime: { chains: number; departed: number };
      response: { signals: number; median_seconds: number | null };
      narration: number;
      photos: number;
    };
  };

  it('🔴 ontime: an extension is the SAME chain — the replaced notice folds away', async () => {
    // n-1 was extended into n-2, which then ended all-aboard. One chain, not two.
    const metrics = await me({
      rally: [
        { type: 'rally_resolution', payload: { outcome: 'extended', notice_id: 'n-1', next_notice_id: 'n-2' } },
        { type: 'rally_resolution', payload: { outcome: 'all_aboard', notice_id: 'n-2' } },
      ],
    });
    expect(metrics.ontime.chains).toBe(1);
    expect(metrics.ontime.departed).toBe(0);
  });

  it('🔴 ontime: only a departed chain counts as late', async () => {
    const metrics = await me({
      rally: [
        { type: 'rally_resolution', payload: { outcome: 'all_aboard', notice_id: 'a' } },
        { type: 'rally_resolution', payload: { outcome: 'departed', notice_id: 'b' } },
        { type: 'rally_resolution', payload: { outcome: 'departed', notice_id: 'c' } },
      ],
    });
    expect(metrics.ontime).toEqual({ chains: 3, departed: 2 });
  });

  it('🔴 response: the MEDIAN gap, and gaps over 600s are not gaps', async () => {
    const metrics = await me({
      messages: [
        // 30s, 120s, and one 20-minute "reply" that must be discarded.
        { sender_role: 'system', created_at: T(0), metadata: { kind: 'guest_running_late' } },
        { sender_role: 'driver', created_at: new Date(Date.UTC(2099, 6, 21, 0, 0, 30)).toISOString(), metadata: null },
        { sender_role: 'system', created_at: T(10), metadata: { kind: 'guest_rest_stop' } },
        { sender_role: 'guide', created_at: T(12), metadata: null },
        { sender_role: 'system', created_at: T(20), metadata: { kind: 'guest_lost' } },
        { sender_role: 'driver', created_at: T(45), metadata: null },
      ],
    });
    expect(metrics.response.signals).toBe(3);
    // gaps kept: 30s and 120s → median of two takes the upper middle.
    expect(metrics.response.median_seconds).toBe(120);
  });

  it('🔴 response: no staff reply at all leaves the median null, not zero', async () => {
    const metrics = await me({
      messages: [{ sender_role: 'system', created_at: T(0), metadata: { kind: 'guest_lost' } }],
    });
    expect(metrics.response.signals).toBe(1);
    expect(metrics.response.median_seconds).toBeNull();
  });

  it('🔴 narration counts arrival capsules only', async () => {
    const metrics = await me({
      messages: [
        { sender_role: 'system', created_at: T(0), metadata: { kind: 'arrival_bundle' } },
        { sender_role: 'system', created_at: T(1), metadata: { kind: 'spot_arrival' } },
        { sender_role: 'system', created_at: T(2), metadata: { kind: 'meeting_notice' } },
        { sender_role: 'guide', created_at: T(3), metadata: null },
      ],
    });
    expect(metrics.narration).toBe(2);
  });

  it('🔴 photos counts STAFF attachments — a guest photo is not the operator work', async () => {
    const metrics = await me({
      messages: [
        { sender_role: 'driver', created_at: T(0), input_kind: 'image', metadata: null },
        { sender_role: 'guide', created_at: T(1), attachment_url: 'https://x/p.jpg', metadata: null },
        { sender_role: 'customer', created_at: T(2), input_kind: 'image', metadata: null },
      ],
    });
    expect(metrics.photos).toBe(2);
  });

  it('a guest may not read the operator metrics', async () => {
    createServerClientMock.mockReturnValue(metricsDb({}));
    const res = await summaryGET(fakeReq(customerSession()), params());
    expect(res.status).toBe(403);
  });
});
