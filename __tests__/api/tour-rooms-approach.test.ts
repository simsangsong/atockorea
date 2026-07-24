/**
 * @jest-environment node
 *
 * §11.C C2 — approach preview route: room-session auth, server-side distance
 * re-check against match_pois, the three-way duplicate suppression (event
 * claim / already-arrived / rate limit), and content-resolver degradation.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as approachPOST } from '@/app/api/tour-rooms/[bookingId]/approach/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { signRoomSession } from '@/lib/tour-room/access';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({ requestGate: jest.fn(), clientIpKey: jest.fn(() => 'ip:test') }));
jest.mock('@/lib/tour-room/events', () => ({ recordRoomEvent: jest.fn(async () => ({ inserted: true, event: null })) }));
jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => ({ ok: true })) }));
jest.mock('@/lib/tour-room/generatedContent', () => ({
  getGeneratedSpotContent: jest.fn(async () => null),
  refCandidatesFor: jest.fn(() => []),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const recordRoomEventMock = recordRoomEvent as jest.Mock;
const broadcastMock = jest.requireMock('@/lib/tour-room/realtime').broadcastToRoom as jest.Mock;
const generatedMock = jest.requireMock('@/lib/tour-room/generatedContent').getGeneratedSpotContent as jest.Mock;

const BOOKING = {
  id: 'b1',
  user_id: 'u1',
  tour_id: 'tour-1',
  merchant_id: 'm1',
  tour_date: '2099-07-24',
  contact_name: 'A',
  contact_email: 'a@b.c',
  contact_phone: null,
  preferred_language: 'en',
};

/** Seongsan, and a point ~900 m due north of it. */
const SEONGSAN = { lat: 33.458, lng: 126.9425 };
const NEAR = { latitude: 33.4661, longitude: 126.9425 };
const FAR = { latitude: 33.5, longitude: 126.9425 }; // ~4.7 km

interface FakeDbOpts {
  /** match_pois row for the poi_key ('seongsan' unless overridden). */
  poiCoords?: Record<string, { lat: number; lng: number }>;
  /** Rows the "already arrived today?" feed probe should see. */
  arrivalRows?: Array<Record<string, unknown>>;
  /** tour_guide_spots row for the poi_key. */
  spotRow?: Record<string, unknown> | null;
  videoRows?: Array<Record<string, unknown>>;
  /** Make the tour_guide_spots / content lookups blow up. */
  spotThrows?: boolean;
}

function fakeDb(opts: FakeDbOpts = {}) {
  const inserts: Record<string, Array<Record<string, unknown>>> = {};
  const coords = opts.poiCoords ?? { seongsan: SEONGSAN };
  const client = {
    inserts,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const filters: Record<string, unknown> = {};
      for (const m of ['select', 'neq', 'in', 'gte', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      chain.eq = jest.fn((col: string, value: unknown) => {
        filters[col] = value;
        return chain;
      });
      const single = async () => {
        if (table === 'bookings') return { data: { ...BOOKING }, error: null };
        if (table === 'match_pois') return { data: coords[String(filters.poi_key)] ?? null, error: null };
        if (table === 'tour_guide_spots') {
          if (opts.spotThrows) throw new Error('spot lookup exploded');
          return { data: opts.spotRow ?? null, error: null };
        }
        return { data: null, error: null };
      };
      chain.single = jest.fn(single);
      chain.maybeSingle = jest.fn(single);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        (table === 'tour_room_messages'
          ? Promise.resolve({ data: opts.arrivalRows ?? [], error: null })
          : table === 'poi_videos'
            ? Promise.resolve({ data: opts.videoRows ?? [], error: null })
            : single()
        ).then(res, rej);
      chain.upsert = jest.fn((values: Record<string, unknown>) => ({
        select: () => ({
          single: async () => ({
            data: { id: `room-${values.booking_id}`, booking_id: values.booking_id, status: 'active' },
            error: null,
          }),
        }),
      }));
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

function fakeReq(session: string | null, json: unknown) {
  return {
    nextUrl: { searchParams: new URLSearchParams('') },
    headers: { get: (name: string) => (name.toLowerCase() === 'x-tour-room-auth' ? session : null) },
    json: async () => json,
  } as never;
}

const params = () => ({ params: Promise.resolve({ bookingId: 'b1' }) });
const customerSession = () =>
  signRoomSession({ roomId: 'room-b1', bookingId: 'b1', participantId: 'p-cust', role: 'customer', displayName: 'C' })
    .session;

const validBody = (overrides: Record<string, unknown> = {}) => ({
  poi_key: 'seongsan',
  latitude: NEAR.latitude,
  longitude: NEAR.longitude,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  recordRoomEventMock.mockResolvedValue({ inserted: true, event: null });
  generatedMock.mockResolvedValue(null);
});

describe('POST /approach — auth + validation', () => {
  it('rejects an unauthenticated request', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    const res = await approachPOST(fakeReq(null, validBody()), params());
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('rejects a session signed for ANOTHER booking', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const foreign = signRoomSession({
      roomId: 'room-x',
      bookingId: 'someone-else',
      participantId: 'p',
      role: 'customer',
      displayName: 'C',
    }).session;
    const res = await approachPOST(fakeReq(foreign, validBody()), params());
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
    expect(db.inserts.tour_room_messages).toBeUndefined();
  });

  it('requires poi_key and finite coordinates', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    const bad = [
      { latitude: NEAR.latitude, longitude: NEAR.longitude },
      validBody({ latitude: 'nope' }),
      validBody({ latitude: 95 }),
      validBody({ longitude: 200 }),
    ];
    for (const body of bad) {
      const res = await approachPOST(fakeReq(customerSession(), body), params());
      expect(res.status).toBe(400);
    }
  });

  it('answers 429 when the rate gate closes', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 });
    const res = await approachPOST(fakeReq(customerSession(), validBody()), params());
    expect(res.status).toBe(429);
  });
});

describe('POST /approach — server-side distance re-check', () => {
  it('rejects a position outside 1.2 km of the POI (spoof guard)', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await approachPOST(
      fakeReq(customerSession(), validBody({ latitude: FAR.latitude, longitude: FAR.longitude })),
      params(),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Outside approach radius');
    expect(db.inserts.tour_room_messages).toBeUndefined();
    expect(recordRoomEventMock).not.toHaveBeenCalled();
  });

  it('rejects a poi_key with no match_pois row', async () => {
    const db = fakeDb({ poiCoords: {} });
    createServerClientMock.mockReturnValue(db);
    const res = await approachPOST(fakeReq(customerSession(), validBody()), params());
    expect(res.status).toBe(400);
    expect(db.inserts.tour_room_messages).toBeUndefined();
  });
});

describe('POST /approach — the card', () => {
  it('first crossing posts one approach_card with content, video and coords', async () => {
    const db = fakeDb({
      spotRow: {
        title: 'Seongsan Ilchulbong',
        content: { en: { name: 'Seongsan Ilchulbong', description: 'A tuff cone at sunrise.' } },
      },
      videoRows: [
        { language: 'en', version: 1, video_url: 'https://cdn/en.mp4', poster_url: 'https://cdn/p.png', duration_seconds: 64 },
      ],
    });
    createServerClientMock.mockReturnValue(db);
    const res = await approachPOST(fakeReq(customerSession(), validBody()), params());
    expect(res.status).toBe(201);
    expect(db.inserts.tour_room_messages).toHaveLength(1);
    expect(broadcastMock).toHaveBeenCalledTimes(1);

    const row = db.inserts.tour_room_messages[0];
    const meta = row.metadata as Record<string, unknown>;
    expect(meta.kind).toBe('approach_card');
    expect(meta.spot_title).toBe('Seongsan Ilchulbong');
    expect(meta.poi_key).toBe('seongsan');
    expect(meta.poi_lat).toBe(SEONGSAN.lat);
    expect(meta.distance_m).toBeGreaterThan(800);
    expect(meta.distance_m).toBeLessThan(1000);
    expect(meta.content_tier).toBe('curated');
    expect(meta.content).toMatchObject({ description: 'A tuff cone at sunrise.' });
    expect(meta.video_card).toMatchObject({ urls: { en: 'https://cdn/en.mp4' } });
    // The arrival contract must NOT leak into a preview.
    expect(meta.meeting_time).toBeUndefined();
    expect(meta.facility_pins).toBeUndefined();
    expect(meta.follow_mode).toBeUndefined();

    const translations = row.translations as Record<string, string>;
    expect(translations.ko).toContain('곧 도착: Seongsan Ilchulbong');
    expect(translations.en).toContain('Coming up: Seongsan Ilchulbong');
    expect(row.sender_role).toBe('system');
  });

  it('claims the (room, poi, day) slot before inserting', async () => {
    createServerClientMock.mockReturnValue(fakeDb());
    await approachPOST(fakeReq(customerSession(), validBody()), params());
    expect(recordRoomEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'spot_approach',
        subjectKey: 'approach:seongsan:2099-07-24',
        roomId: 'room-b1',
      }),
    );
  });

  it('falls back to a humanized title when the tour has no spot row', async () => {
    const db = fakeDb({ spotRow: null });
    createServerClientMock.mockReturnValue(db);
    const res = await approachPOST(fakeReq(customerSession(), validBody()), params());
    expect(res.status).toBe(201);
    const meta = db.inserts.tour_room_messages[0].metadata as Record<string, unknown>;
    expect(meta.spot_title).toBe('Seongsan');
    expect(meta.content).toBeUndefined();
    expect(meta.video_card).toBeUndefined();
  });
});

describe('POST /approach — duplicate suppression', () => {
  it('a second crossing the same day posts nothing (duplicate:true)', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    recordRoomEventMock.mockResolvedValueOnce({ inserted: true, event: null });
    const first = await approachPOST(fakeReq(customerSession(), validBody()), params());
    expect(first.status).toBe(201);

    recordRoomEventMock.mockResolvedValueOnce({ inserted: false, event: null });
    const second = await approachPOST(fakeReq(customerSession(), validBody()), params());
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ duplicate: true });
    expect(db.inserts.tour_room_messages).toHaveLength(1);
    expect(broadcastMock).toHaveBeenCalledTimes(1);
  });

  it("the stop's arrival already posted today → no preview at all", async () => {
    const db = fakeDb({ arrivalRows: [{ id: 'm-arrived' }] });
    createServerClientMock.mockReturnValue(db);
    const res = await approachPOST(fakeReq(customerSession(), validBody()), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ skipped: 'arrived' });
    expect(db.inserts.tour_room_messages).toBeUndefined();
    // The slot is never claimed either — a later arrival keeps its own rules.
    expect(recordRoomEventMock).not.toHaveBeenCalled();
  });
});

describe('POST /approach — degradation', () => {
  it('a throwing content lookup still ships the preview line', async () => {
    const db = fakeDb({ spotThrows: true });
    createServerClientMock.mockReturnValue(db);
    const res = await approachPOST(fakeReq(customerSession(), validBody()), params());
    expect(res.status).toBe(201);
    const meta = db.inserts.tour_room_messages[0].metadata as Record<string, unknown>;
    expect(meta.content).toBeUndefined();
    expect((await res.json()).content_tier).toBe('none');
    const translations = db.inserts.tour_room_messages[0].translations as Record<string, string>;
    expect(translations.en).toContain('Coming up');
  });

  it('the generated tier fills in when curated and poi_kb are empty', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    generatedMock.mockResolvedValue({ content: { name: 'Seongsan', description: 'Generated blurb.' } });
    const res = await approachPOST(fakeReq(customerSession(), validBody()), params());
    expect(res.status).toBe(201);
    const meta = db.inserts.tour_room_messages[0].metadata as Record<string, unknown>;
    expect(meta.content_tier).toBe('generated');
    expect(meta.content).toMatchObject({ description: 'Generated blurb.' });
  });
});
