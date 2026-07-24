/**
 * @jest-environment node
 *
 * §5.2 C-6 동행자 개별 등록 — 링크 발급(lead 전용) · redeem(스코프·만료·폐기·
 * 정원·멱등) · lead 승격 차단. 전부 mock, 네트워크 0.
 */
import '@/test-utils/restoreWebPrimitives';
import {
  GET as inviteGET,
  POST as invitePOST,
} from '@/app/api/tour-rooms/[bookingId]/companion-invite/route';
import { POST as redeemPOST } from '@/app/api/tour-rooms/[bookingId]/companion-invite/redeem/route';
import { POST as joinPOST } from '@/app/api/tour-rooms/[bookingId]/join/route';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { signRoomSession } from '@/lib/tour-room/access';
import { signCompanionInviteToken } from '@/lib/tour-room/companionToken';
import {
  isCompanionRoomToken,
  signCompanionRoomToken,
  signCustomerRoomToken,
  verifyRoomToken,
} from '@/lib/tour-room/token';
import { makeFakeDb, queriesFor, fakeNextRequest, type FakeQuery } from '@/test-utils/opsSeatingFakes';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn(async () => null) }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(async () => ({ allowed: true, retryAfterMs: 0 })),
  clientIpKey: jest.fn(() => 'ip:test'),
}));
jest.mock('@/lib/tour-room/realtime', () => ({
  broadcastToRoom: jest.fn(async () => ({ ok: true })),
  roomChannelTopic: jest.fn(() => 'topic'),
}));
jest.mock('@/lib/tour-room/snapshot', () => {
  const actual = jest.requireActual('@/lib/tour-room/snapshot');
  return { ...actual, buildRoomSnapshot: jest.fn(async () => ({ lifecycle: 'lobby' })) };
});

const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;

const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const PAST = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
const BOOKING_ID = 'bk-1';
const ROOM = { id: 'room-1', booking_id: BOOKING_ID, tour_id: 'tour-1', tour_date: FUTURE, status: 'active' };
const DEVICE_A = '11111111-2222-4333-8444-555555555555';
const DEVICE_B = '99999999-8888-4777-8666-555555555555';

interface DbOptions {
  /** number_of_guests (정원). */
  partySize?: number;
  /** room에 이미 등록된 고객 디바이스들. */
  devices?: string[];
  /** isLeadGuest가 볼 participant 행. */
  isLead?: boolean;
  revoked?: boolean;
  tourDate?: string;
  cancelled?: boolean;
}

function db(options: DbOptions = {}) {
  const log: FakeQuery[] = [];
  const devices = options.devices ?? [];
  const client = makeFakeDb((q) => {
    if (q.table === 'bookings') {
      return {
        data: {
          id: BOOKING_ID,
          user_id: 'user-owner',
          tour_id: 'tour-1',
          merchant_id: null,
          tour_date: options.tourDate ?? FUTURE,
          status: options.cancelled ? 'cancelled' : 'confirmed',
          contact_name: 'Alex Kim',
          contact_email: 'alex@example.com',
          contact_phone: null,
          preferred_language: 'en',
          number_of_guests: options.partySize ?? 2,
        },
      };
    }
    if (q.table === 'tour_rooms') return { data: ROOM };
    if (q.table === 'tour_room_invites' && q.op === 'select') {
      return { data: options.revoked ? { id: 'inv-1', revoked_at: '2026-01-01T00:00:00Z' } : null };
    }
    if (q.table === 'tour_room_invites') return { data: null };
    if (q.table === 'tour_room_participants' && q.op === 'select') {
      // maybeSingle = isLeadGuest의 단건 조회, list = 등록 디바이스 집계.
      if (q.terminal === 'maybeSingle') return { data: { is_lead: options.isLead ?? false } };
      if (q.terminal === 'single') return { data: null };
      return { data: devices.map((d, i) => ({ id: `p-${i}`, device_key: d, is_lead: i === 0 })) };
    }
    if (q.table === 'tour_room_participants' && q.op === 'upsert') {
      const payload = q.payload as { device_key: string; is_lead?: boolean };
      return { data: { id: `p-${payload.device_key}`, ...payload } };
    }
    if (q.table === 'tour_room_participants' && q.op === 'update') {
      return { data: { id: 'p-0', ...(q.payload as Record<string, unknown>) } };
    }
    if (q.table === 'tour_room_events') return { data: { id: 'ev-1' } };
    return { data: null };
  }, log);
  createServerClientMock.mockReturnValue(client);
  return { client, log };
}

const routeParams = (bookingId = BOOKING_ID) => ({ params: Promise.resolve({ bookingId }) });

const leadSession = () =>
  signRoomSession({
    roomId: ROOM.id,
    bookingId: BOOKING_ID,
    participantId: 'p-lead',
    role: 'customer',
    displayName: 'Alex',
  }).session;

const guideSession = () =>
  signRoomSession({
    roomId: ROOM.id,
    bookingId: BOOKING_ID,
    participantId: 'p-guide',
    role: 'guide',
    displayName: 'Guide',
  }).session;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
});

// ---------------------------------------------------------------------------
// 링크 발급 — lead 전용
// ---------------------------------------------------------------------------

describe('POST /api/tour-rooms/[bookingId]/companion-invite', () => {
  it('mints a booking-scoped link for the lead and ledgers it as role=companion', async () => {
    const { log } = db({ isLead: true, partySize: 3, devices: [DEVICE_A] });
    const res = await invitePOST(
      fakeNextRequest({ headers: { 'x-tour-room-auth': leadSession() }, body: {} }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.url).toContain('/tour-mode/companion/');
    expect(body.slots).toMatchObject({ capacity: 3, used: 1, remaining: 2, full: false });

    const ledger = queriesFor(log, 'tour_room_invites', 'insert');
    expect(ledger).toHaveLength(1);
    expect(ledger[0].payload).toMatchObject({ booking_id: BOOKING_ID, role: 'companion' });
    // 원문 토큰은 절대 저장되지 않는다 (sha256만).
    expect((ledger[0].payload as { token_hash: string }).token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a companion (is_lead=false) with 403 and mints nothing', async () => {
    const { log } = db({ isLead: false });
    const res = await invitePOST(
      fakeNextRequest({ headers: { 'x-tour-room-auth': leadSession() }, body: {} }),
      routeParams(),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('lead_guest_only');
    expect(queriesFor(log, 'tour_room_invites', 'insert')).toHaveLength(0);
  });

  it('rejects staff and anonymous callers', async () => {
    db({ isLead: true });
    const staff = await invitePOST(
      fakeNextRequest({ headers: { 'x-tour-room-auth': guideSession() }, body: {} }),
      routeParams(),
    );
    expect(staff.status).toBe(403);

    db({ isLead: true });
    const anon = await invitePOST(fakeNextRequest({ body: {} }), routeParams());
    expect(anon.status).toBe(403);
  });

  it('refuses to mint a link nobody could use once the party size is exhausted', async () => {
    const { log } = db({ isLead: true, partySize: 2, devices: [DEVICE_A, DEVICE_B] });
    const res = await invitePOST(
      fakeNextRequest({ headers: { 'x-tour-room-auth': leadSession() }, body: {} }),
      routeParams(),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'party_full', slots: { remaining: 0, full: true } });
    expect(queriesFor(log, 'tour_room_invites', 'insert')).toHaveLength(0);
  });

  it('is rate limited per booking', async () => {
    db({ isLead: true });
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 });
    const res = await invitePOST(
      fakeNextRequest({ headers: { 'x-tour-room-auth': leadSession() }, body: {} }),
      routeParams(),
    );
    expect(res.status).toBe(429);
  });

  it('GET reports lead status + remaining slots without minting anything', async () => {
    const { log } = db({ isLead: true, partySize: 4, devices: [DEVICE_A] });
    const res = await inviteGET(
      fakeNextRequest({ headers: { 'x-tour-room-auth': leadSession() } }),
      routeParams(),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ is_lead: true, slots: { capacity: 4, remaining: 3 } });
    expect(queriesFor(log, 'tour_room_invites', 'insert')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// redeem — 두 번째 디바이스 등록
// ---------------------------------------------------------------------------

describe('POST /api/tour-rooms/[bookingId]/companion-invite/redeem', () => {
  const invite = (bookingId = BOOKING_ID, tourDate = FUTURE) =>
    signCompanionInviteToken({ bookingId, tourDate }).token;

  it('registers a second device as a NON-lead participant with its own token', async () => {
    const { log } = db({ partySize: 2, devices: [DEVICE_A] });
    const res = await redeemPOST(
      fakeNextRequest({ body: { inviteToken: invite(), deviceKey: DEVICE_B, displayName: 'Sofia' } }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.isLead).toBe(false);

    const payload = verifyRoomToken(body.token);
    expect(payload).toMatchObject({ scope: 'booking', role: 'customer', bookingId: BOOKING_ID });
    expect(isCompanionRoomToken(payload)).toBe(true);

    const upserts = queriesFor(log, 'tour_room_participants', 'upsert');
    expect(upserts).toHaveLength(1);
    expect(upserts[0].payload).toMatchObject({
      booking_id: BOOKING_ID,
      role: 'customer',
      device_key: DEVICE_B,
      is_lead: false,
    });

    // 개인 토큰도 원장에 남는다 (폐기 경로 동일).
    const ledger = queriesFor(log, 'tour_room_invites', 'insert');
    expect(ledger).toHaveLength(1);
    expect(ledger[0].payload).toMatchObject({ booking_id: BOOKING_ID, role: 'customer' });

    const events = queriesFor(log, 'tour_room_events', 'insert');
    expect((events[0].payload as { type: string }).type).toBe('companion_joined');
  });

  it('is scoped to ONE booking — another booking’s link cannot open this room', async () => {
    const { log } = db();
    const res = await redeemPOST(
      fakeNextRequest({ body: { inviteToken: invite('bk-OTHER'), deviceKey: DEVICE_B } }),
      routeParams(),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('invalid_companion_token');
    expect(queriesFor(log, 'tour_room_participants', 'upsert')).toHaveLength(0);
  });

  it('refuses an expired link (tour date + 1)', async () => {
    const { log } = db({ tourDate: PAST });
    const res = await redeemPOST(
      fakeNextRequest({ body: { inviteToken: invite(BOOKING_ID, PAST), deviceKey: DEVICE_B } }),
      routeParams(),
    );
    expect(res.status).toBe(403);
    expect(queriesFor(log, 'tour_room_participants', 'upsert')).toHaveLength(0);
  });

  it('refuses a revoked link', async () => {
    const { log } = db({ revoked: true });
    const res = await redeemPOST(
      fakeNextRequest({ body: { inviteToken: invite(), deviceKey: DEVICE_B } }),
      routeParams(),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('companion_token_revoked');
    expect(queriesFor(log, 'tour_room_participants', 'upsert')).toHaveLength(0);
  });

  it('refuses a room token or claim token in place of a companion invite', async () => {
    db();
    const roomToken = signCustomerRoomToken({
      bookingId: BOOKING_ID,
      displayName: 'Lead',
      tourDate: FUTURE,
    }).token;
    const res = await redeemPOST(
      fakeNextRequest({ body: { inviteToken: roomToken, deviceKey: DEVICE_B } }),
      routeParams(),
    );
    expect(res.status).toBe(403);
  });

  it('caps devices at the party size and degrades with a message, not a 500', async () => {
    const { log } = db({ partySize: 2, devices: [DEVICE_A, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'] });
    const res = await redeemPOST(
      fakeNextRequest({ body: { inviteToken: invite(), deviceKey: DEVICE_B, locale: 'ko' } }),
      routeParams(),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('party_full');
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);
    expect(queriesFor(log, 'tour_room_participants', 'upsert')).toHaveLength(0);
  });

  it('is idempotent for the same device — a reload does not eat another slot', async () => {
    const { log } = db({ partySize: 2, devices: [DEVICE_A, DEVICE_B] });
    const res = await redeemPOST(
      fakeNextRequest({ body: { inviteToken: invite(), deviceKey: DEVICE_B } }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    expect(queriesFor(log, 'tour_room_participants', 'upsert')).toHaveLength(1);
    expect((await res.json()).slots).toMatchObject({ capacity: 2, used: 2 });
  });

  it('rejects a malformed device key and a cancelled booking', async () => {
    db();
    const bad = await redeemPOST(
      fakeNextRequest({ body: { inviteToken: invite(), deviceKey: 'not-a-uuid' } }),
      routeParams(),
    );
    expect(bad.status).toBe(400);

    db({ cancelled: true });
    const cancelled = await redeemPOST(
      fakeNextRequest({ body: { inviteToken: invite(), deviceKey: DEVICE_B } }),
      routeParams(),
    );
    expect(cancelled.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// lead 승격 차단 — 동행자는 빈 룸에서도 lead가 되지 않는다
// ---------------------------------------------------------------------------

describe('POST /api/tour-rooms/[bookingId]/join — companion never becomes lead', () => {
  it('does not promote a companion device even when no lead row exists', async () => {
    const { log } = db({ devices: [] });
    const token = signCompanionRoomToken({
      bookingId: BOOKING_ID,
      displayName: 'Sofia',
      tourDate: FUTURE,
    }).token;
    const res = await joinPOST(
      fakeNextRequest({ body: { token, deviceKey: DEVICE_B } }),
      routeParams(),
    );
    expect(res.status).toBe(201);

    const promotions = queriesFor(log, 'tour_room_participants', 'update');
    expect(promotions).toHaveLength(0);
    const upsert = queriesFor(log, 'tour_room_participants', 'upsert')[0];
    // join은 is_lead를 건드리지 않는다 → redeem이 박은 false가 그대로 유지된다.
    expect(upsert.payload).not.toHaveProperty('is_lead');
  });

  it('still promotes a normal (non-companion) first customer — regression guard', async () => {
    const { log } = db({ devices: [] });
    const token = signCustomerRoomToken({
      bookingId: BOOKING_ID,
      displayName: 'Alex',
      tourDate: FUTURE,
    }).token;
    const res = await joinPOST(
      fakeNextRequest({ body: { token, deviceKey: DEVICE_A } }),
      routeParams(),
    );
    expect(res.status).toBe(201);

    const promotions = queriesFor(log, 'tour_room_participants', 'update');
    expect(promotions).toHaveLength(1);
    expect(promotions[0].payload).toMatchObject({ is_lead: true });
  });
});
