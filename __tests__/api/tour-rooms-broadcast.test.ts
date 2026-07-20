/**
 * @jest-environment node
 *
 * T6.1/T6.3/T6.5 — guide fan-out: tour-date-token auth, per-room delivery
 * with partial-failure reporting, zero-LLM notice templates, onboard ack.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as broadcastPOST } from '@/app/api/tour-rooms/broadcast/route';
import { GET as overviewGET } from '@/app/api/tour-mode/guide/overview/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { translateTextForLocales } from '@/lib/openai-server';
import { signGuideRoomToken, signCustomerRoomToken } from '@/lib/tour-room/token';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
}));
jest.mock('@/lib/openai-server', () => ({
  translateTextForLocales: jest.fn(),
  generateSpeechMp3: jest.fn(),
  transcribeAudioFile: jest.fn(),
}));
jest.mock('@/lib/tour-room/realtime', () => ({
  broadcastToRoom: jest.fn(async () => ({ ok: true })),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const translateMock = translateTextForLocales as jest.Mock;
const broadcastToRoomMock = jest.requireMock('@/lib/tour-room/realtime').broadcastToRoom as jest.Mock;

const BOOKINGS = [
  { id: 'b1', tour_id: 'tour-1', tour_date: '2099-07-20', preferred_language: 'ja', status: 'confirmed' },
  { id: 'b2', tour_id: 'tour-1', tour_date: '2099-07-20', preferred_language: 'es', status: 'confirmed' },
  { id: 'b3', tour_id: 'tour-1', tour_date: '2099-07-20', preferred_language: 'en', status: 'pending' },
];

function fakeDb(options: { failRoomFor?: string[] } = {}) {
  const inserted: Array<Record<string, unknown>> = [];
  const client = {
    inserted,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const filters: Record<string, unknown> = {};
      const resolveSelect = async () => {
        if (table === 'bookings') return { data: BOOKINGS, error: null };
        if (table === 'tours') return { data: { id: 'tour-1', title: 'Busan Top', city: 'Busan' }, error: null };
        if (table === 'tour_rooms') return { data: [], error: null };
        if (table === 'tour_room_participants') return { data: [], error: null };
        if (table === 'tour_room_messages') return { data: [], error: null };
        return { data: null, error: null };
      };
      for (const method of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'is']) {
        chain[method] = jest.fn((...args: unknown[]) => {
          if (method === 'eq') filters[String(args[0])] = args[1];
          return chain;
        });
      }
      chain.single = jest.fn(resolveSelect);
      chain.maybeSingle = jest.fn(resolveSelect);
      chain.then = (resolve: (v: unknown) => unknown) => resolveSelect().then(resolve);
      chain.upsert = jest.fn((values: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            const bookingId = String(values.booking_id);
            if (options.failRoomFor?.includes(bookingId)) {
              return { data: null, error: new Error('room upsert boom') };
            }
            return { data: { id: `room-${bookingId}`, booking_id: bookingId, status: 'active' }, error: null };
          },
        }),
      }));
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        inserted.push({ table, ...values });
        return {
          select: () => ({ single: async () => ({ data: { id: `msg-${inserted.length}`, ...values }, error: null }) }),
        };
      });
      return chain;
    },
  };
  return client;
}

function fakeReq(json: unknown) {
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    headers: { get: () => null },
    json: async () => json,
  } as never;
}

const guideToken = () =>
  signGuideRoomToken({ tourId: 'tour-1', tourDate: '2099-07-20', displayName: 'Guide Kim' }).token;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  translateMock.mockResolvedValue({ source_locale: 'ko', translations: { en: 'x', ja: 'y' } });
  createServerClientMock.mockReturnValue(fakeDb());
});

describe('POST /api/tour-rooms/broadcast (T6.1)', () => {
  it('403s a customer token and scope-mismatched guide tokens', async () => {
    const customer = signCustomerRoomToken({ bookingId: 'b1', displayName: 'A', tourDate: '2099-07-20' }).token;
    expect((await broadcastPOST(fakeReq({ tourId: 'tour-1', tourDate: '2099-07-20', token: customer, text: 'hi' }))).status).toBe(403);

    const otherDay = signGuideRoomToken({ tourId: 'tour-1', tourDate: '2099-07-21', displayName: 'G' }).token;
    expect((await broadcastPOST(fakeReq({ tourId: 'tour-1', tourDate: '2099-07-20', token: otherDay, text: 'hi' }))).status).toBe(403);
  });

  it('fans one text out to every non-cancelled booking with ONE translation call', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await broadcastPOST(
      fakeReq({ tourId: 'tour-1', tourDate: '2099-07-20', token: guideToken(), text: '10분 뒤 출발합니다' }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.delivered).toBe(3);
    expect(json.partial).toBe(false);
    expect(translateMock).toHaveBeenCalledTimes(1); // shared across rooms
    expect(db.inserted.filter((row) => row.table === 'tour_room_messages')).toHaveLength(3);
    expect(broadcastToRoomMock).toHaveBeenCalledTimes(3);
  });

  it('reports partial success without rolling back delivered rooms', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ failRoomFor: ['b2'] }));
    const res = await broadcastPOST(
      fakeReq({ tourId: 'tour-1', tourDate: '2099-07-20', token: guideToken(), text: 'hello' }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.delivered).toBe(2);
    expect(json.partial).toBe(true);
    expect(json.results.find((r: { bookingId: string }) => r.bookingId === 'b2').ok).toBe(false);
  });

  it('meeting notice uses the zero-LLM template with metadata for the banner (T6.3)', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await broadcastPOST(
      fakeReq({
        tourId: 'tour-1',
        tourDate: '2099-07-20',
        token: guideToken(),
        notice: { kind: 'meeting_notice', time: '15:30', point: 'Gate 2' },
      }),
    );
    expect(res.status).toBe(201);
    expect(translateMock).not.toHaveBeenCalled(); // §M-2 ①
    const message = db.inserted.find((row) => row.table === 'tour_room_messages')!;
    expect(message.metadata).toMatchObject({ kind: 'meeting_notice', meeting_time: '15:30', meeting_point: 'Gate 2' });
    expect((message.translations as Record<string, string>).ko).toContain('15:30');
  });

  it('a pinned meeting notice carries lat/lng + a maps URL in every locale (T2-1)', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await broadcastPOST(
      fakeReq({
        tourId: 'tour-1',
        tourDate: '2099-07-20',
        token: guideToken(),
        notice: { kind: 'meeting_notice', time: '15:30', point: 'Gate 2', lat: 33.5, lng: 126.5 },
      }),
    );
    expect(res.status).toBe(201);
    const message = db.inserted.find((row) => row.table === 'tour_room_messages')!;
    expect(message.metadata).toMatchObject({ kind: 'meeting_notice', meeting_lat: 33.5, meeting_lng: 126.5 });
    const t = message.translations as Record<string, string>;
    expect(t.en).toContain('https://maps.google.com/?q=33.500000,126.500000');
    expect(t.ko).toContain('https://maps.google.com/?q=33.500000,126.500000');
  });

  it('a meeting notice with only a pin (no place text) still sends (T2-1)', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await broadcastPOST(
      fakeReq({
        tourId: 'tour-1',
        tourDate: '2099-07-20',
        token: guideToken(),
        notice: { kind: 'meeting_notice', point: '집합 장소', lat: 33.5, lng: 126.5 },
      }),
    );
    expect(res.status).toBe(201);
    const message = db.inserted.find((row) => row.table === 'tour_room_messages')!;
    expect(message.metadata).toMatchObject({ meeting_lat: 33.5, meeting_lng: 126.5 });
  });

  it('free-time timer carries until_time; cancel supersedes (T6.5)', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    await broadcastPOST(
      fakeReq({
        tourId: 'tour-1',
        tourDate: '2099-07-20',
        token: guideToken(),
        notice: { kind: 'free_time_timer', time: '16:00', point: 'Parking lot' },
      }),
    );
    const timer = db.inserted.find((row) => row.table === 'tour_room_messages')!;
    expect(timer.metadata).toMatchObject({ kind: 'free_time_timer', until_time: '16:00' });

    const cancelRes = await broadcastPOST(
      fakeReq({
        tourId: 'tour-1',
        tourDate: '2099-07-20',
        token: guideToken(),
        notice: { kind: 'free_time_timer', cancelled: true, point: 'Parking lot' },
      }),
    );
    expect(cancelRes.status).toBe(201);
    const cancel = db.inserted.filter((row) => row.table === 'tour_room_messages').at(-1)!;
    expect(cancel.metadata).toMatchObject({ kind: 'free_time_timer', cancelled: true });
  });
});

describe('GET /api/tour-mode/guide/overview (T6.2)', () => {
  const fakeGetReq = (query: Record<string, string>) =>
    ({
      nextUrl: { searchParams: new URLSearchParams(query) },
      headers: { get: () => null },
    }) as never;

  it('403s without a guide token or admin login', async () => {
    const res = await overviewGET(fakeGetReq({}));
    expect(res.status).toBe(403);
  });

  it('returns the day bundle for a valid guide token', async () => {
    const res = await overviewGET(fakeGetReq({ rt: guideToken() }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tour.title).toBe('Busan Top');
    expect(json.rooms).toHaveLength(3);
  });
});
