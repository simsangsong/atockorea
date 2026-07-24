/**
 * @jest-environment node
 *
 * W1.4 — day-plan API: lead-guest draft editing (P-D13), submit/delegate
 * fan-out, guide confirm, W1.3 feasibility persistence.
 */
// Must be first: restores real web primitives before next/server is evaluated.
import '@/test-utils/restoreWebPrimitives';
import { GET as planGET, PUT as planPUT } from '@/app/api/tour-rooms/[bookingId]/plan/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { signRoomSession } from '@/lib/tour-room/access';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { generateSpotContent } from '@/lib/tour-room/generatedContent';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
}));
jest.mock('@/lib/tour-room/events', () => ({ recordRoomEvent: jest.fn(async () => ({ inserted: true, event: null })) }));
jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => ({ ok: true })) }));
jest.mock('@/lib/tour-room/generatedContent', () => ({ generateSpotContent: jest.fn(async () => null) }));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const recordRoomEventMock = recordRoomEvent as jest.Mock;
const generateSpotContentMock = generateSpotContent as jest.Mock;

// Fixed clock so signed sessions stay valid: 2026-07-14 12:00 KST.
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
  preferred_language: 'ja',
  itinerary: null as unknown,
  tours: { schedule: [{ time: '09:00', title: 'Legacy stop' }], city: 'Jeju', duration: '9 hours' },
};

interface DbConfig {
  plan?: Record<string, unknown> | null;
  isLead?: boolean;
  itinerary?: unknown;
  pois?: Array<{ poi_key: string; lat: number | null; lng: number | null; name_en: string | null }>;
}

function fakeDb(config: DbConfig = {}) {
  const upserts: Record<string, Array<Record<string, unknown>>> = {};
  const inserts: Record<string, Array<Record<string, unknown>>> = {};
  const updates: Record<string, Array<Record<string, unknown>>> = {};

  const client = {
    upserts,
    inserts,
    updates,
    from(table: string) {
      let sawStatusFilter = false;
      const resolveSelect = async () => {
        if (table === 'bookings') {
          return { data: { ...BOOKING, itinerary: config.itinerary ?? BOOKING.itinerary }, error: null };
        }
        if (table === 'tours') return { data: { city: 'Jeju', duration: '9 hours' }, error: null };
        if (table === 'tour_room_participants') {
          return { data: { is_lead: config.isLead ?? false }, error: null };
        }
        if (table === 'tour_day_plans') {
          const plan = config.plan ?? null;
          if (!plan) return { data: null, error: null };
          if (sawStatusFilter && plan.status === 'guest_draft') return { data: null, error: null };
          return { data: plan, error: null };
        }
        if (table === 'match_pois') return { data: config.pois ?? [], error: null };
        return { data: null, error: null };
      };
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'gt', 'gte', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      chain.in = jest.fn((column: string) => {
        if (column === 'status') sawStatusFilter = true;
        return chain;
      });
      chain.single = jest.fn(resolveSelect);
      chain.maybeSingle = jest.fn(resolveSelect);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => resolveSelect().then(res, rej);
      chain.upsert = jest.fn((values: Record<string, unknown>) => {
        (upserts[table] ??= []).push(values);
        return {
          select: () => ({
            single: async () => {
              if (table === 'tour_rooms') {
                return { data: { id: 'room-1', booking_id: 'booking-1', status: 'active' }, error: null };
              }
              return { data: { id: `${table}-row`, ...values }, error: null };
            },
          }),
        };
      });
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        (inserts[table] ??= []).push(values);
        return {
          select: () => ({ single: async () => ({ data: { id: 'msg-1', ...values }, error: null }) }),
        };
      });
      chain.update = jest.fn((values: Record<string, unknown>) => {
        (updates[table] ??= []).push(values);
        return {
          eq: jest.fn(() => ({
            select: () => ({ single: async () => ({ data: values, error: null }) }),
            then: (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(res),
          })),
        };
      });
      return chain;
    },
  };
  return client;
}

function fakeReq(input?: { query?: Record<string, string>; headers?: Record<string, string>; json?: unknown }) {
  const params = new URLSearchParams(input?.query ?? {});
  const headers = new Map(Object.entries(input?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    nextUrl: { searchParams: params },
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    json: async () => input?.json ?? {},
  } as never;
}

const routeParams = (bookingId = 'booking-1') => ({ params: Promise.resolve({ bookingId }) });

function customerSession(participantId = 'p-lead') {
  return signRoomSession({
    roomId: 'room-1',
    bookingId: 'booking-1',
    participantId,
    role: 'customer',
    displayName: 'Alex',
  }).session;
}

function guideSession() {
  return signRoomSession({
    roomId: 'room-1',
    bookingId: 'booking-1',
    participantId: 'p-guide',
    role: 'guide',
    displayName: 'Guide',
  }).session;
}

const STOPS = [
  { title: 'Seongsan Ilchulbong', poi_key: 'seongsan_ilchulbong', duration_min: 90 },
  { title: 'Udo Island Ferry', duration_min: 120 },
];

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  createServerClientMock.mockReturnValue(fakeDb());
  jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
});

afterEach(() => {
  (Date.now as jest.Mock).mockRestore?.();
});

describe('PUT /api/tour-rooms/[bookingId]/plan — lead guest (P-D13)', () => {
  it('rejects a non-lead customer with 403 lead_guest_only', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ isLead: false }));
    const res = await planPUT(
      fakeReq({ headers: { 'x-tour-room-auth': customerSession('p-member') }, json: { stops: STOPS } }),
      routeParams(),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'lead_guest_only' });
  });

  it('lets the lead guest save a draft with needs + feasibility', async () => {
    const db = fakeDb({ isLead: true });
    createServerClientMock.mockReturnValue(db);
    const res = await planPUT(
      fakeReq({
        headers: { 'x-tour-room-auth': customerSession() },
        json: {
          stops: STOPS,
          needs: { adults: 2, children: 1, child_ages: [5], pace: 'relaxed', hacker: 'drop-me' },
        },
      }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.day_plan.status).toBe('guest_draft');
    expect(body.feasibility).toBeDefined();

    const upsert = db.upserts.tour_day_plans[0];
    expect(upsert.status).toBe('guest_draft');
    expect(upsert.updated_by).toBe('customer');
    expect(upsert.needs).toEqual({ adults: 2, children: 1, child_ages: [5], pace: 'relaxed' });
    expect(upsert.feasibility).toBeDefined();
    // A draft save does NOT drop a feed capsule.
    expect(db.inserts.tour_room_messages).toBeUndefined();
    expect(recordRoomEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'plan_mutated', actorRole: 'customer' }),
    );
  });

  it('persists empty stops when the lead deletes the last draft stop', async () => {
    const db = fakeDb({ isLead: true, plan: { id: 'plan-1', status: 'guest_draft', stops: STOPS, version: 1 } });
    createServerClientMock.mockReturnValue(db);
    const res = await planPUT(
      fakeReq({
        headers: { 'x-tour-room-auth': customerSession() },
        json: { stops: [], needs: { adults: 2 } },
      }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    expect(db.upserts.tour_day_plans[0]).toMatchObject({
      stops: [],
      status: 'guest_draft',
    });
  });

  it('submit fans out the plan_submitted capsule and moves to guest_submitted', async () => {
    const db = fakeDb({ isLead: true });
    createServerClientMock.mockReturnValue(db);
    const res = await planPUT(
      fakeReq({
        headers: { 'x-tour-room-auth': customerSession() },
        json: { stops: STOPS, submit: true },
      }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    expect(db.upserts.tour_day_plans[0].status).toBe('guest_submitted');
    expect(db.inserts.tour_room_messages).toHaveLength(1);
    expect(db.inserts.tour_room_messages[0].metadata).toMatchObject({ kind: 'plan_submitted' });
    expect(recordRoomEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'plan_submitted' }),
    );
  });

  it('treats repeated submit on guest_submitted as idempotent', async () => {
    const db = fakeDb({
      isLead: true,
      plan: { id: 'plan-1', status: 'guest_submitted', stops: STOPS, version: 2, feasibility: { warnings: [] } },
    });
    createServerClientMock.mockReturnValue(db);
    const res = await planPUT(
      fakeReq({
        headers: { 'x-tour-room-auth': customerSession() },
        json: { submit: true },
      }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    expect(db.upserts.tour_day_plans).toBeUndefined();
    expect(db.inserts.tour_room_messages).toBeUndefined();
    expect(recordRoomEventMock).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.day_plan).toMatchObject({ status: 'guest_submitted', version: 2 });
  });

  it('delegate marks itinerary.guide_curated and drops the delegated capsule', async () => {
    const db = fakeDb({ isLead: true });
    createServerClientMock.mockReturnValue(db);
    const res = await planPUT(
      fakeReq({ headers: { 'x-tour-room-auth': customerSession() }, json: { delegate: true } }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    expect(db.updates.bookings?.[0]).toMatchObject({ itinerary: { guide_curated: true } });
    expect(db.inserts.tour_room_messages[0].metadata).toMatchObject({ kind: 'plan_delegated' });
  });

  it('direct stop writes clear a prior delegated guide_curated flag', async () => {
    const db = fakeDb({ isLead: true, itinerary: { guide_curated: true, poi_keys: [] } });
    createServerClientMock.mockReturnValue(db);
    const res = await planPUT(
      fakeReq({
        headers: { 'x-tour-room-auth': customerSession() },
        json: { stops: STOPS, stops_changed: true },
      }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    expect(db.updates.bookings?.[0]).toMatchObject({
      itinerary: { guide_curated: false, poi_keys: [] },
    });
  });

  it('blocks guest confirm with 403 guide_confirms', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ isLead: true }));
    const res = await planPUT(
      fakeReq({ headers: { 'x-tour-room-auth': customerSession() }, json: { stops: STOPS, confirm: true } }),
      routeParams(),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'guide_confirms' });
  });

  it('locks guest edits once the guide confirmed (A8)', async () => {
    createServerClientMock.mockReturnValue(
      fakeDb({ isLead: true, plan: { id: 'plan-1', status: 'guide_confirmed', stops: [], version: 3 } }),
    );
    const res = await planPUT(
      fakeReq({ headers: { 'x-tour-room-auth': customerSession() }, json: { stops: STOPS } }),
      routeParams(),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'plan_locked' });
  });

  it('returns retry metadata when plan writes are rate-limited', async () => {
    requestGateMock.mockResolvedValueOnce({ allowed: false, retryAfterMs: 45_000 });
    const db = fakeDb({ isLead: true });
    createServerClientMock.mockReturnValue(db);
    const res = await planPUT(
      fakeReq({
        headers: { 'x-tour-room-auth': customerSession() },
        json: { stops: STOPS },
      }),
      routeParams(),
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'rate_limited', retry_after_ms: 45_000 });
    expect(db.upserts.tour_day_plans).toBeUndefined();
  });
});

describe('PUT /api/tour-rooms/[bookingId]/plan — guide plane (unchanged)', () => {
  it('guide confirm sets guide_confirmed, fans out, fires P-D16 generation', async () => {
    const db = fakeDb({
      pois: [{ poi_key: 'seongsan_ilchulbong', lat: 33.458, lng: 126.942, name_en: 'Seongsan Ilchulbong' }],
    });
    createServerClientMock.mockReturnValue(db);
    const res = await planPUT(
      fakeReq({ headers: { 'x-tour-room-auth': guideSession() }, json: { stops: STOPS, confirm: true } }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    const upsert = db.upserts.tour_day_plans[0];
    expect(upsert.status).toBe('guide_confirmed');
    // Coord enrichment from match_pois persisted onto the stop.
    const stops = upsert.stops as Array<Record<string, unknown>>;
    expect(stops[0]).toMatchObject({ poi_key: 'seongsan_ilchulbong', lat: 33.458, lng: 126.942 });
    expect(db.inserts.tour_room_messages[0].metadata).toMatchObject({ kind: 'plan_confirmed' });
    // Fire-and-forget generation kicks off for stops outside the poi_kb.
    await new Promise((resolve) => setImmediate(resolve));
    expect(generateSpotContentMock).toHaveBeenCalled();
  });

  it('rejects unauthenticated writers', async () => {
    const res = await planPUT(fakeReq({ json: { stops: STOPS } }), routeParams());
    expect(res.status).toBe(403);
  });

  it('persists skipped status + reason on a MUTATE write (W2.2)', async () => {
    const db = fakeDb({ plan: { id: 'plan-1', status: 'guide_confirmed', stops: [], version: 2 } });
    createServerClientMock.mockReturnValue(db);
    const res = await planPUT(
      fakeReq({
        headers: { 'x-tour-room-auth': guideSession() },
        json: {
          stops: [
            { title: 'Kept Stop', duration_min: 60, status: 'arrived' },
            { title: 'Closed Stop', duration_min: 60, status: 'skipped', skip_reason: 'closed' },
            { title: 'Junk Status', duration_min: 60, status: 'hacked', skip_reason: 'nope' },
          ],
        },
      }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    const stops = db.upserts.tour_day_plans[0].stops as Array<Record<string, unknown>>;
    expect(stops[0].status).toBe('arrived');
    expect(stops[1]).toMatchObject({ status: 'skipped', skip_reason: 'closed' });
    expect(stops[2].status).toBe('pending');
    expect(stops[2].skip_reason).toBeUndefined();
    // editing a confirmed plan keeps it confirmed (MUTATE, not a demotion)
    expect(db.upserts.tour_day_plans[0].status).toBe('guide_confirmed');
    // skipped stops leave the served schedule
    const body = await res.json();
    expect(body.schedule.map((s: { title: string }) => s.title)).toEqual(['Kept Stop', 'Junk Status']);
  });
});

describe('PUT /api/tour-rooms/[bookingId]/plan — departure_time (§11.D D4)', () => {
  it('persists a valid departure_time on a lead-guest draft write', async () => {
    const db = fakeDb({ isLead: true });
    createServerClientMock.mockReturnValue(db);
    const res = await planPUT(
      fakeReq({
        headers: { 'x-tour-room-auth': customerSession() },
        json: { stops: STOPS, departure_time: '9:30' },
      }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    // Zero-padded to HH:MM.
    expect(db.upserts.tour_day_plans[0].departure_time).toBe('09:30');
  });

  it('clears departure_time when the lead sends an empty string', async () => {
    const db = fakeDb({ isLead: true, plan: { id: 'plan-1', status: 'guest_draft', stops: STOPS, version: 1 } });
    createServerClientMock.mockReturnValue(db);
    const res = await planPUT(
      fakeReq({
        headers: { 'x-tour-room-auth': customerSession() },
        json: { stops: STOPS, departure_time: '' },
      }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    expect(db.upserts.tour_day_plans[0]).toHaveProperty('departure_time', null);
  });

  it('rejects a malformed departure_time with 400', async () => {
    const db = fakeDb({ isLead: true });
    createServerClientMock.mockReturnValue(db);
    const res = await planPUT(
      fakeReq({
        headers: { 'x-tour-room-auth': customerSession() },
        json: { stops: STOPS, departure_time: '25:99' },
      }),
      routeParams(),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_departure_time' });
    expect(db.upserts.tour_day_plans).toBeUndefined();
  });

  it('ignores departure_time from a staff (guide) write', async () => {
    const db = fakeDb({});
    createServerClientMock.mockReturnValue(db);
    const res = await planPUT(
      fakeReq({
        headers: { 'x-tour-room-auth': guideSession() },
        json: { stops: STOPS, departure_time: '10:00' },
      }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    expect(db.upserts.tour_day_plans[0]).not.toHaveProperty('departure_time');
  });

  it('does not touch departure_time when the field is absent', async () => {
    const db = fakeDb({ isLead: true });
    createServerClientMock.mockReturnValue(db);
    const res = await planPUT(
      fakeReq({ headers: { 'x-tour-room-auth': customerSession() }, json: { stops: STOPS } }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    expect(db.upserts.tour_day_plans[0]).not.toHaveProperty('departure_time');
  });
});

describe('GET /api/tour-rooms/[bookingId]/plan — viewer meta', () => {
  it('marks the lead guest editable while the plan is a draft', async () => {
    createServerClientMock.mockReturnValue(
      fakeDb({ isLead: true, plan: { id: 'plan-1', status: 'guest_draft', stops: [], version: 1 } }),
    );
    const res = await planGET(fakeReq({ headers: { 'x-tour-room-auth': customerSession() } }), routeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.viewer).toMatchObject({ role: 'customer', is_lead: true, can_edit: true });
    expect(body.tour).toMatchObject({ region: 'jeju', total_hours: 9 });
    expect(body.day_plan).toMatchObject({ status: 'guest_draft' });
    // Drafts never own the schedule — legacy tours.schedule still serves.
    expect(body.source).toBe('tour_schedule');
  });

  it('member guests are read-only', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ isLead: false }));
    const res = await planGET(
      fakeReq({ headers: { 'x-tour-room-auth': customerSession('p-member') } }),
      routeParams(),
    );
    const body = await res.json();
    expect(body.viewer).toMatchObject({ is_lead: false, can_edit: false });
  });
});
