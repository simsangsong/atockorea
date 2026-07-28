/**
 * @jest-environment node
 *
 * P1 / P-D19 — "이 기기에서 편집하기" (claim-lead), at the route level.
 *
 * Why this file exists: the handover was verified only through a component test
 * that MOCKS this endpoint, so nothing checked what the endpoint actually does.
 * That is a poor place to have no coverage — it moves an edit permission, it
 * maintains a one-lead-at-a-time invariant with two separate writes, and it
 * carries the single exclusion that keeps P-D13's original purpose intact
 * (a companion who joined by personal invite must never become the editor).
 *
 * The scenario behind the ticket is worth restating, because it is what makes
 * the endpoint necessary rather than convenient: a solo traveller opens the
 * invite in a browser (becomes lead), then opens the same booking in the
 * installed PWA. Different storage, so a second participant row is created, and
 * that device is permanently non-lead — every save 403s. Turning a confusing
 * failure into a certain lock would have been worse than the bug.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as claimLead } from '@/app/api/tour-rooms/[bookingId]/plan/claim-lead/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { signRoomSession } from '@/lib/tour-room/access';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;

const FIXED_NOW_MS = Date.UTC(2026, 6, 14, 3, 0, 0);

const BOOKING = {
  id: 'booking-1',
  user_id: 'user-owner',
  tour_id: 'tour-1',
  merchant_id: 'merchant-1',
  tour_date: '2026-07-14',
  contact_name: 'Alex Kim',
  contact_email: 'alex@example.com',
  contact_phone: null,
  preferred_language: 'en',
  source: 'tour_product',
};

interface ParticipantRow {
  id: string;
  booking_id: string;
  invite_id: string | null;
  is_lead: boolean;
  display_name: string | null;
}

/** Records the two writes separately, because the invariant lives in their pairing. */
function fakeDb(participant: ParticipantRow | null) {
  const demotions: Array<Record<string, unknown>> = [];
  const promotions: Array<Record<string, unknown>> = [];

  const client = {
    demotions,
    promotions,
    from(table: string) {
      const resolveSelect = async () => {
        if (table === 'bookings') return { data: BOOKING, error: null };
        if (table === 'tour_room_participants') return { data: participant, error: null };
        if (table === 'tour_rooms') {
          return { data: { id: 'room-1', booking_id: 'booking-1', tour_id: 'tour-1', tour_date: '2026-07-14' }, error: null };
        }
        return { data: null, error: null };
      };
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      chain.single = jest.fn(resolveSelect);
      chain.maybeSingle = jest.fn(resolveSelect);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        resolveSelect().then(res, rej);
      chain.update = jest.fn((values: Record<string, unknown>) => {
        // Demotion filters by booking + role + NOT me; promotion targets one id.
        const updateChain: Record<string, unknown> = { sawNeq: false, sawBooking: false };
        const finish = () => Promise.resolve({ data: null, error: null });
        updateChain.eq = jest.fn((column: string) => {
          if (column === 'booking_id') updateChain.sawBooking = true;
          return updateChain;
        });
        updateChain.neq = jest.fn(() => {
          updateChain.sawNeq = true;
          return updateChain;
        });
        updateChain.then = (res: (v: unknown) => unknown) => {
          if (updateChain.sawNeq) demotions.push(values);
          else promotions.push(values);
          return finish().then(res);
        };
        return updateChain;
      });
      return chain;
    },
  };
  return client;
}

function fakeReq(headers: Record<string, string> = {}) {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    headers: { get: (name: string) => map.get(name.toLowerCase()) ?? null },
    json: async () => ({}),
  } as never;
}

const routeParams = (bookingId = 'booking-1') => ({ params: Promise.resolve({ bookingId }) });

function session(role: 'customer' | 'guide', participantId: string) {
  return signRoomSession({
    roomId: 'room-1',
    bookingId: 'booking-1',
    participantId,
    role,
    displayName: 'Alex',
  }).session;
}

const member = (over: Partial<ParticipantRow> = {}): ParticipantRow => ({
  id: 'p-member',
  booking_id: 'booking-1',
  invite_id: null,
  is_lead: false,
  display_name: 'Alex',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  createServerClientMock.mockReturnValue(fakeDb(member()));
  jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
});

afterEach(() => {
  (Date.now as jest.Mock).mockRestore?.();
});

describe('POST /plan/claim-lead — the handover', () => {
  it('🔴 moves the lead in one direction only: demote the others, promote me', async () => {
    const db = fakeDb(member());
    createServerClientMock.mockReturnValue(db);
    const res = await claimLead(
      fakeReq({ 'x-tour-room-auth': session('customer', 'p-member') }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, already_lead: false });
    // Both halves must happen. A promotion without the demotion would leave two
    // leads, which is the invariant P-D13 exists to hold.
    expect(db.demotions).toEqual([{ is_lead: false }]);
    expect(db.promotions).toEqual([{ is_lead: true }]);
  });

  it('is idempotent for someone who already holds it — and writes nothing', async () => {
    const db = fakeDb(member({ is_lead: true }));
    createServerClientMock.mockReturnValue(db);
    const res = await claimLead(
      fakeReq({ 'x-tour-room-auth': session('customer', 'p-member') }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, already_lead: true });
    expect(db.demotions).toEqual([]);
    expect(db.promotions).toEqual([]);
  });

  it('🔴 refuses a companion — the one exclusion that keeps P-D13 meaningful', async () => {
    // Companions arrive through a personal invite and carry invite_id. Letting
    // one take the plan is precisely what the lead rule was written to prevent;
    // the handover is for the same guest on a second device, not a third party.
    const db = fakeDb(member({ invite_id: 'invite-9' }));
    createServerClientMock.mockReturnValue(db);
    const res = await claimLead(
      fakeReq({ 'x-tour-room-auth': session('customer', 'p-member') }),
      routeParams(),
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'companion_cannot_lead' });
    expect(db.promotions).toEqual([]);
  });

  it('refuses staff — the guide has their own confirm path', async () => {
    const res = await claimLead(
      fakeReq({ 'x-tour-room-auth': session('guide', 'p-guide') }),
      routeParams(),
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'customers_only' });
  });

  it('refuses an unauthenticated caller', async () => {
    const res = await claimLead(fakeReq(), routeParams());
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('🔴 refuses a participant row belonging to another booking', async () => {
    // The participant id comes from a signed session, but the booking comes from
    // the URL. If those were ever allowed to disagree, the handover would be a
    // way to take the lead on a booking you are not in.
    const db = fakeDb(member({ booking_id: 'booking-OTHER' }));
    createServerClientMock.mockReturnValue(db);
    const res = await claimLead(
      fakeReq({ 'x-tour-room-auth': session('customer', 'p-member') }),
      routeParams(),
    );
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'participant_not_found' });
    expect(db.promotions).toEqual([]);
  });

  it('answers 429 with retry metadata rather than thrashing the lead flag', async () => {
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 4000 });
    const db = fakeDb(member());
    createServerClientMock.mockReturnValue(db);
    const res = await claimLead(
      fakeReq({ 'x-tour-room-auth': session('customer', 'p-member') }),
      routeParams(),
    );
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({ error: 'rate_limited', retry_after_ms: 4000 });
    expect(db.promotions).toEqual([]);
  });
});
