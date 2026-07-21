/**
 * @jest-environment node
 *
 * A1 — morning briefing route: join vs private shape, day-wide fan-out,
 * settlement-constant interpolation. (docs/smart-guide-ops-detail-audit-2026-07-21.md)
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as briefingPOST } from '@/app/api/tour-rooms/[bookingId]/morning-briefing/route';
import { composeMorningBriefing } from '@/lib/tour-room/morningBriefing';
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
// B6 — no live network in tests: fixed forecast; renderers stay real.
jest.mock('@/lib/tour-room/weather', () => {
  const actual = jest.requireActual('@/lib/tour-room/weather');
  return {
    ...actual,
    fetchDayWeather: jest.fn(async () => ({ tminC: 21, tmaxC: 27, rainProbPct: 60, windMaxMs: 5 })),
  };
});

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;

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
  { id: 'b1', tour_id: 'tour-1', tour_date: '2099-07-21' },
  { id: 'b2', tour_id: 'tour-1', tour_date: '2099-07-21' },
];

function fakeDb(priceType: string, city: string | null) {
  const inserts: Record<string, Array<Record<string, unknown>>> = {};
  const client = {
    inserts,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      const single = async () => {
        if (table === 'bookings') return { data: { ...BOOKING }, error: null };
        if (table === 'tours') return { data: { price_type: priceType, city }, error: null };
        return { data: null, error: null };
      };
      chain.single = jest.fn(single);
      chain.maybeSingle = jest.fn(single);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        (table === 'bookings' ? Promise.resolve({ data: DAY_BOOKINGS, error: null }) : single()).then(res, rej);
      chain.upsert = jest.fn((values: Record<string, unknown>) => ({
        select: () => ({
          single: async () => ({ data: { id: `room-${values.booking_id}`, booking_id: values.booking_id, status: 'active' }, error: null }),
        }),
      }));
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        (inserts[table] ??= []).push(values);
        return { select: () => ({ single: async () => ({ data: { id: `${table}-${inserts[table].length}`, ...values }, error: null }) }) };
      });
      return chain;
    },
  };
  return client;
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

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
});

describe('composeMorningBriefing (pure)', () => {
  it('private interpolates the charter hours + overtime rate', () => {
    const bundle = composeMorningBriefing({ kind: 'private', baseHours: 9, rateKrw: 30000 });
    expect(bundle.translations.ko).toContain('기본 9시간');
    expect(bundle.translations.ko).toContain('₩30,000');
    expect(bundle.translations.ko).toContain('한 방향');
    expect(bundle.translations.en).toContain('9 hours');
    expect(bundle.translations.en).toContain('₩30,000');
  });

  it('join covers app usage · schedule tab · lunch · countdown', () => {
    const bundle = composeMorningBriefing({ kind: 'join', baseHours: 8, rateKrw: 30000 });
    expect(bundle.translations.ko).toContain('자동으로 번역');
    expect(bundle.translations.ko).toContain('일정 탭');
    expect(bundle.translations.ko).toContain('점심');
    expect(bundle.translations.ko).toContain('카운트다운');
    expect(bundle.translations.ko).not.toContain('₩');
  });
});

describe('POST /morning-briefing', () => {
  it('shared tour → JOIN briefing fanned to every booking', async () => {
    const db = fakeDb('person', 'Jeju');
    createServerClientMock.mockReturnValue(db);
    const res = await briefingPOST(fakeReq(driverSession()), params());
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.kind).toBe('join');
    expect(json.delivered).toBe(2);
    expect(db.inserts.tour_room_messages).toHaveLength(2);
    const meta = db.inserts.tour_room_messages[0].metadata as Record<string, unknown>;
    expect(meta.kind).toBe('morning_briefing');
    expect(meta.briefing_kind).toBe('join');
  });

  it('private charter → PRIVATE briefing, single room, Jeju 9h', async () => {
    const db = fakeDb('vehicle', '제주');
    createServerClientMock.mockReturnValue(db);
    const res = await briefingPOST(fakeReq(driverSession()), params());
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.kind).toBe('private');
    expect(json.delivered).toBe(1);
    const translations = db.inserts.tour_room_messages[0].translations as Record<string, string>;
    expect(translations.ko).toContain('기본 9시간');
    const meta = db.inserts.tour_room_messages[0].metadata as Record<string, unknown>;
    expect(meta.base_hours).toBe(9);
  });

  it('B6: the weather line + umbrella hint rides the briefing', async () => {
    const db = fakeDb('vehicle', 'Jeju');
    createServerClientMock.mockReturnValue(db);
    await briefingPOST(fakeReq(driverSession()), params());
    const translations = db.inserts.tour_room_messages[0].translations as Record<string, string>;
    expect(translations.ko).toContain('오늘 날씨: 21–27°C');
    expect(translations.ko).toContain('우산');
    expect(translations.en).toContain('rain chance 60%');
  });

  it('Busan private charter interpolates 8h', async () => {
    const db = fakeDb('vehicle', 'Busan');
    createServerClientMock.mockReturnValue(db);
    await briefingPOST(fakeReq(driverSession()), params());
    const translations = db.inserts.tour_room_messages[0].translations as Record<string, string>;
    expect(translations.ko).toContain('기본 8시간');
  });
});
