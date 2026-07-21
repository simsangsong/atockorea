/**
 * @jest-environment node
 *
 * A0 — arrival one-tap bundle route: shared fan-out, per-day variable
 * validation (meeting time + parking pin), sticky profile persistence,
 * bundle metadata contract. (docs/smart-guide-ops-detail-audit-2026-07-21.md)
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as bundlePOST, GET as bundleGET } from '@/app/api/tour-rooms/[bookingId]/arrival-bundle/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { signRoomSession } from '@/lib/tour-room/access';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({ requestGate: jest.fn(), clientIpKey: jest.fn(() => 'ip:test') }));
jest.mock('@/lib/tour-room/events', () => ({ recordRoomEvent: jest.fn(async () => ({ inserted: true, event: null })) }));
jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => ({ ok: true })) }));
jest.mock('@/lib/tour-room/guestPush', () => ({ sendGuestRoomPush: jest.fn(async () => ({ sent: 0, pruned: 0 })) }));
jest.mock('@/lib/tour-room/generatedContent', () => ({
  getGeneratedSpotContent: jest.fn(async () => null),
  refCandidatesFor: jest.fn(() => []),
}));
jest.mock('@/lib/openai-server', () => ({
  translateTextForLocales: jest.fn(async (text: string) => ({
    source_locale: 'ko',
    translations: { en: `[en] ${text}`, ko: text, ja: `[ja] ${text}`, es: `[es] ${text}`, zh: `[zh] ${text}` },
  })),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const broadcastMock = jest.requireMock('@/lib/tour-room/realtime').broadcastToRoom as jest.Mock;
const guestPushMock = jest.requireMock('@/lib/tour-room/guestPush').sendGuestRoomPush as jest.Mock;

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
const DAY_BOOKINGS = [
  { id: 'b1', tour_id: 'tour-1', tour_date: '2099-07-21', preferred_language: 'ja' },
  { id: 'b2', tour_id: 'tour-1', tour_date: '2099-07-21', preferred_language: 'es' },
  { id: 'b3', tour_id: 'tour-1', tour_date: '2099-07-21', preferred_language: 'en' },
];

interface FakeDbOpts {
  dayPlanStops?: Array<Record<string, unknown>>;
  poiCoords?: Record<string, { lat: number; lng: number }>;
  matrixMinutes?: number | null;
}

function fakeDb(priceType: string, profileRow: Record<string, unknown> | null = null, opts: FakeDbOpts = {}) {
  const inserts: Record<string, Array<Record<string, unknown>>> = {};
  const upserts: Record<string, Array<Record<string, unknown>>> = {};
  const client = {
    inserts,
    upserts,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const filters: Record<string, unknown> = {};
      for (const m of ['select', 'neq', 'in', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      chain.eq = jest.fn((col: string, value: unknown) => {
        filters[col] = value;
        return chain;
      });
      const single = async () => {
        if (table === 'bookings') return { data: { ...BOOKING }, error: null };
        if (table === 'tours') return { data: { price_type: priceType }, error: null };
        if (table === 'tour_poi_arrival_profiles') return { data: profileRow, error: null };
        if (table === 'tour_room_pins') return { data: { id: `pin-${(inserts.tour_room_pins?.length ?? 0)}` }, error: null };
        if (table === 'tour_day_plans')
          return { data: opts.dayPlanStops ? { id: 'plan-1', stops: opts.dayPlanStops, status: 'live' } : null, error: null };
        if (table === 'match_pois')
          return { data: opts.poiCoords?.[String(filters.poi_key)] ?? null, error: null };
        if (table === 'poi_travel_matrix')
          return { data: opts.matrixMinutes != null ? { minutes_p50: opts.matrixMinutes } : null, error: null };
        return { data: null, error: null };
      };
      chain.single = jest.fn(single);
      chain.maybeSingle = jest.fn(single);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        (table === 'bookings' ? Promise.resolve({ data: DAY_BOOKINGS, error: null }) : single()).then(res, rej);
      chain.upsert = jest.fn((values: Record<string, unknown>) => {
        (upserts[table] ??= []).push(values);
        return {
          select: () => ({
            single: async () => ({
              data: { id: `room-${values.booking_id}`, booking_id: values.booking_id, status: 'active' },
              error: null,
            }),
          }),
          then: (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(res),
        };
      });
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        (inserts[table] ??= []).push(values);
        return {
          select: () => ({
            single: async () => ({ data: { id: `${table}-${inserts[table].length}`, ...values }, error: null }),
          }),
        };
      });
      return chain;
    },
  };
  return client;
}

function fakeReq(session: string, json: unknown, search = '') {
  return {
    nextUrl: { searchParams: new URLSearchParams(search) },
    headers: { get: (name: string) => (name.toLowerCase() === 'x-tour-room-auth' ? session : null) },
    json: async () => json,
  } as never;
}

const params = () => ({ params: Promise.resolve({ bookingId: 'b1' }) });
const driverSession = () =>
  signRoomSession({ roomId: 'room-b1', bookingId: 'b1', participantId: 'p-driver', role: 'driver', displayName: 'D' }).session;
const customerSession = () =>
  signRoomSession({ roomId: 'room-b1', bookingId: 'b1', participantId: 'p-cust', role: 'customer', displayName: 'C' }).session;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
});

describe('POST /arrival-bundle', () => {
  it('SHARED tour: one tap fans the bundle + parking pin to every booking', async () => {
    const db = fakeDb('person');
    createServerClientMock.mockReturnValue(db);
    const res = await bundlePOST(
      fakeReq(driverSession(), {
        poiKey: 'seongsan_ilchulbong',
        title: 'Seongsan Ilchulbong',
        meetingTime: '15:40',
        lat: 33.458,
        lng: 126.942,
        profile: { follow_mode: 'follow', ticket_required: true, route_note: '분화구 먼저' },
      }),
      params(),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.delivered).toBe(3);
    expect(db.inserts.tour_room_pins).toHaveLength(3);
    expect(db.inserts.tour_room_messages).toHaveLength(3);
    expect(broadcastMock).toHaveBeenCalledTimes(3);
    // Rally-critical: a meeting time rings opted-in devices per room.
    expect(guestPushMock).toHaveBeenCalledTimes(3);

    const meta = db.inserts.tour_room_messages[0].metadata as Record<string, unknown>;
    expect(meta.kind).toBe('arrival_bundle');
    expect(meta.meeting_time).toBe('15:40');
    expect(meta.follow_mode).toBe('follow');
    expect(meta.ticket_required).toBe(true);
    expect(meta.meeting_lat).toBe(33.458);
    expect(meta.parking_lat).toBe(33.458);
    expect(meta.route_note).toBe('분화구 먼저');
    expect((meta.route_note_i18n as Record<string, string>).en).toBe('[en] 분화구 먼저');

    // The message text carries the meeting + follow + ticket lines.
    const translations = db.inserts.tour_room_messages[0].translations as Record<string, string>;
    expect(translations.ko).toContain('15:40');
    expect(translations.ko).toContain('스태프');
    expect(translations.ko).toContain('입장권');

    // Sticky profile persisted with the sheet's toggles.
    const profileUpsert = db.upserts.tour_poi_arrival_profiles?.[0];
    expect(profileUpsert).toMatchObject({
      poi_key: 'seongsan_ilchulbong',
      follow_mode: 'follow',
      ticket_required: true,
      route_note: '분화구 먼저',
    });
  });

  it('PRIVATE charter stays a single room; no meeting → no push, no meeting line', async () => {
    const db = fakeDb('vehicle');
    createServerClientMock.mockReturnValue(db);
    const res = await bundlePOST(
      fakeReq(driverSession(), { poiKey: 'photo_stop', meetingTime: null, lat: 33.1, lng: 126.2 }),
      params(),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).delivered).toBe(1);
    expect(db.inserts.tour_room_messages).toHaveLength(1);
    expect(guestPushMock).not.toHaveBeenCalled();
    const meta = db.inserts.tour_room_messages[0].metadata as Record<string, unknown>;
    expect(meta.meeting_time).toBeNull();
    expect(meta.meeting_lat).toBeUndefined();
    expect(meta.parking_lat).toBe(33.1);
  });

  it('rejects a malformed meetingTime', async () => {
    const db = fakeDb('vehicle');
    createServerClientMock.mockReturnValue(db);
    const res = await bundlePOST(fakeReq(driverSession(), { poiKey: 'x', meetingTime: '25:99' }), params());
    expect(res.status).toBe(400);
  });

  it('rejects a customer session', async () => {
    const db = fakeDb('vehicle');
    createServerClientMock.mockReturnValue(db);
    const res = await bundlePOST(fakeReq(customerSession(), { poiKey: 'x', meetingTime: null }), params());
    expect(res.status).toBe(403);
  });

  it('an existing profile supplies sticky defaults when the sheet sends no patch', async () => {
    const db = fakeDb('vehicle', {
      follow_mode: 'follow',
      ticket_required: true,
      route_note: '기존 노트',
      route_note_i18n: { en: 'existing note' },
      meeting_point: null,
      meeting_point_i18n: null,
    });
    createServerClientMock.mockReturnValue(db);
    const res = await bundlePOST(fakeReq(driverSession(), { poiKey: 'seongsan', meetingTime: '10:00' }), params());
    expect(res.status).toBe(201);
    const meta = db.inserts.tour_room_messages[0].metadata as Record<string, unknown>;
    expect(meta.follow_mode).toBe('follow');
    expect(meta.ticket_required).toBe(true);
    expect(meta.route_note).toBe('기존 노트');
    // No patch → nothing re-persisted.
    expect(db.upserts.tour_poi_arrival_profiles).toBeUndefined();
  });
});

describe('POST /arrival-bundle × A2 next-leg ETA', () => {
  it('appends the measured next-stop line + next_leg metadata', async () => {
    const db = fakeDb('vehicle', null, {
      dayPlanStops: [
        { seq: 1, poi_key: 'seongsan', name_i18n: { en: 'Seongsan' } },
        { seq: 2, poi_key: 'udo', name_i18n: { en: 'Udo Island' } },
      ],
      poiCoords: {
        seongsan: { lat: 33.458, lng: 126.9425 },
        udo: { lat: 33.5045, lng: 126.9523 },
      },
      matrixMinutes: 23,
    });
    createServerClientMock.mockReturnValue(db);
    const res = await bundlePOST(
      fakeReq(driverSession(), { poiKey: 'seongsan', meetingTime: '15:40', lat: 33.458, lng: 126.9425 }),
      params(),
    );
    expect(res.status).toBe(201);
    const meta = db.inserts.tour_room_messages[0].metadata as Record<string, unknown>;
    const nextLeg = meta.next_leg as Record<string, unknown>;
    expect(nextLeg).toMatchObject({ poi_key: 'udo', minutes: 23, source: 'measured', title: 'Udo Island' });
    const translations = db.inserts.tour_room_messages[0].translations as Record<string, string>;
    expect(translations.ko).toContain('다음 이동: Udo Island');
    expect(translations.ko).toContain('약 23분');
  });

  it('the last stop of the day has no next-leg line', async () => {
    const db = fakeDb('vehicle', null, {
      dayPlanStops: [{ seq: 1, poi_key: 'seongsan' }],
      poiCoords: { seongsan: { lat: 33.458, lng: 126.9425 } },
    });
    createServerClientMock.mockReturnValue(db);
    const res = await bundlePOST(fakeReq(driverSession(), { poiKey: 'seongsan', meetingTime: null }), params());
    expect(res.status).toBe(201);
    const meta = db.inserts.tour_room_messages[0].metadata as Record<string, unknown>;
    expect(meta.next_leg).toBeUndefined();
  });
});

describe('POST /arrival-bundle × A4 event status', () => {
  it('confirming ON persists the day row and rides the citation on the bundle', async () => {
    const db = fakeDb('vehicle', null);
    createServerClientMock.mockReturnValue(db);
    const res = await bundlePOST(
      fakeReq(driverSession(), {
        poiKey: 'seongsan',
        meetingTime: null,
        eventStatus: 'on',
        profile: { event_label: '해녀 공연 14:00' },
      }),
      params(),
    );
    expect(res.status).toBe(201);
    const dayUpsert = db.upserts.poi_day_events?.[0];
    expect(dayUpsert).toMatchObject({
      poi_key: 'seongsan',
      event_date: '2099-07-21',
      status: 'on',
      label: '해녀 공연 14:00',
    });
    const meta = db.inserts.tour_room_messages[0].metadata as Record<string, unknown>;
    expect(meta.event_status).toBe('on');
    expect(meta.event_label).toBe('해녀 공연 14:00');
    const translations = db.inserts.tour_room_messages[0].translations as Record<string, string>;
    expect(translations.ko).toContain('오늘 확인됨');
  });

  it('unconfirmed sends no event line and writes no day row', async () => {
    const db = fakeDb('vehicle', { event_label: '해녀 공연' });
    createServerClientMock.mockReturnValue(db);
    const res = await bundlePOST(fakeReq(driverSession(), { poiKey: 'seongsan', meetingTime: null }), params());
    expect(res.status).toBe(201);
    expect(db.upserts.poi_day_events).toBeUndefined();
    const meta = db.inserts.tour_room_messages[0].metadata as Record<string, unknown>;
    expect(meta.event_status).toBeUndefined();
  });
});

describe('POST /arrival-bundle × J1 ticket price', () => {
  it('a priced ticket line + metadata + sticky persistence', async () => {
    const db = fakeDb('vehicle');
    createServerClientMock.mockReturnValue(db);
    const res = await bundlePOST(
      fakeReq(driverSession(), {
        poiKey: 'seongsan',
        meetingTime: null,
        profile: { ticket_required: true, ticket_krw: 5000 },
      }),
      params(),
    );
    expect(res.status).toBe(201);
    const translations = db.inserts.tour_room_messages[0].translations as Record<string, string>;
    expect(translations.ko).toContain('₩5,000');
    expect(translations.en).toContain('₩5,000 per adult');
    const meta = db.inserts.tour_room_messages[0].metadata as Record<string, unknown>;
    expect(meta.ticket_krw).toBe(5000);
    expect(db.upserts.tour_poi_arrival_profiles?.[0]).toMatchObject({ ticket_krw: 5000, ticket_required: true });
  });

  it('garbage prices are ignored (negative, float, huge, string)', async () => {
    const db = fakeDb('vehicle');
    createServerClientMock.mockReturnValue(db);
    const res = await bundlePOST(
      fakeReq(driverSession(), {
        poiKey: 'x',
        meetingTime: null,
        profile: { ticket_required: true, ticket_krw: -500 },
      }),
      params(),
    );
    expect(res.status).toBe(201);
    const translations = db.inserts.tour_room_messages[0].translations as Record<string, string>;
    expect(translations.ko).not.toContain('₩-');
    expect(translations.ko).toContain('매표소'); // unpriced fallback line
  });
});

describe('pressure: boundaries + auth', () => {
  it('a session signed for ANOTHER booking is rejected', async () => {
    const db = fakeDb('vehicle');
    createServerClientMock.mockReturnValue(db);
    const foreign = signRoomSession({
      roomId: 'room-x',
      bookingId: 'someone-else',
      participantId: 'p-driver',
      role: 'driver',
      displayName: 'D',
    }).session;
    const res = await bundlePOST(fakeReq(foreign, { poiKey: 'x', meetingTime: null }), params());
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
    expect(db.inserts.tour_room_messages).toBeUndefined();
  });

  it('meetingTime 24:00 / 12:60 / 9:30 are all rejected', async () => {
    const db = fakeDb('vehicle');
    createServerClientMock.mockReturnValue(db);
    for (const meetingTime of ['24:00', '12:60', '9:30']) {
      const res = await bundlePOST(fakeReq(driverSession(), { poiKey: 'x', meetingTime }), params());
      expect(res.status).toBe(400);
    }
  });

  it('out-of-range coords never write a pin (lat 95) but the bundle still sends', async () => {
    const db = fakeDb('vehicle');
    createServerClientMock.mockReturnValue(db);
    const res = await bundlePOST(
      fakeReq(driverSession(), { poiKey: 'x', meetingTime: null, lat: 95, lng: 126.5 }),
      params(),
    );
    expect(res.status).toBe(201);
    expect(db.inserts.tour_room_pins).toBeUndefined();
    const meta = db.inserts.tour_room_messages[0].metadata as Record<string, unknown>;
    expect(meta.parking_lat).toBeUndefined();
  });

  it('a 10k-char route note is capped at 500 and unicode/RTL survives', async () => {
    const db = fakeDb('vehicle');
    createServerClientMock.mockReturnValue(db);
    const giant = `한글🚌‏${'x'.repeat(10_000)}`;
    const res = await bundlePOST(
      fakeReq(driverSession(), { poiKey: 'x', meetingTime: null, profile: { route_note: giant } }),
      params(),
    );
    expect(res.status).toBe(201);
    const saved = db.upserts.tour_poi_arrival_profiles?.[0]?.route_note as string;
    expect(saved.length).toBeLessThanOrEqual(500);
    expect(saved.startsWith('한글🚌')).toBe(true);
  });

  it('an invalid eventStatus string is ignored, not persisted', async () => {
    const db = fakeDb('vehicle', { event_label: '해녀 공연' });
    createServerClientMock.mockReturnValue(db);
    const res = await bundlePOST(
      fakeReq(driverSession(), { poiKey: 'x', meetingTime: null, eventStatus: 'maybe' }),
      params(),
    );
    expect(res.status).toBe(201);
    expect(db.upserts.poi_day_events).toBeUndefined();
  });
});

describe('GET /arrival-bundle', () => {
  it('returns the sticky profile for the cockpit sheet', async () => {
    const db = fakeDb('vehicle', { follow_mode: 'follow', ticket_required: true, route_note: 'n' });
    createServerClientMock.mockReturnValue(db);
    const res = await bundleGET(fakeReq(driverSession(), {}, 'poiKey=seongsan'), params());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profile).toMatchObject({ poi_key: 'seongsan', follow_mode: 'follow', ticket_required: true });
  });

  it('requires poiKey', async () => {
    const db = fakeDb('vehicle');
    createServerClientMock.mockReturnValue(db);
    const res = await bundleGET(fakeReq(driverSession(), {}), params());
    expect(res.status).toBe(400);
  });
});
