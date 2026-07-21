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
