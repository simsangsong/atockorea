/**
 * @jest-environment node
 *
 * §5.2 claim 라우트 — 마스킹 명단(C-1), 확인 질문(C-2), claim 성공(C-3),
 * 이중 claim 409 + 운영자 큐(C-5). 전부 mock, 네트워크 0.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET as claimGET, POST as claimPOST } from '@/app/api/ops/rooms/[roomId]/claim/route';
import { signRoomClaimToken } from '@/lib/ops/seating/claimToken';
import { verifyRoomToken } from '@/lib/tour-room/token';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { sendOpsPush } from '@/lib/tour-ops/push';
import {
  makeFakeDb,
  queriesFor,
  fakeNextRequest,
  type FakeQuery,
} from '@/test-utils/opsSeatingFakes';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn(async () => null) }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(async () => ({ allowed: true, retryAfterMs: 0 })),
  clientIpKey: jest.fn(() => 'ip:test'),
}));
jest.mock('@/lib/tour-ops/push', () => ({ sendOpsPush: jest.fn(async () => ({ sent: 1 })) }));

const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const sendOpsPushMock = sendOpsPush as jest.Mock;

const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const ROOM = { id: 'room-1', booking_id: 'b1', tour_id: 'tour-1', tour_date: FUTURE, status: 'active' };
const ROSTER = [
  {
    id: 'b1',
    tour_id: 'tour-1',
    tour_date: FUTURE,
    status: 'confirmed',
    contact_name: 'Massimo Colombo',
    contact_email: 'm.colombo88@gmail.com',
    number_of_guests: 2,
  },
  {
    id: 'b2',
    tour_id: 'tour-1',
    tour_date: FUTURE,
    status: 'confirmed',
    contact_name: 'Tanaka Yuki',
    contact_email: 'tanaka@example.jp',
    number_of_guests: 3,
  },
];
const DEVICE = '11111111-2222-4333-8444-555555555555';

function claimDb(options: { claimedBookingIds?: string[] } = {}) {
  const log: FakeQuery[] = [];
  const db = makeFakeDb((q) => {
    if (q.table === 'tour_rooms' && q.op === 'select') return { data: ROOM };
    if (q.table === 'tour_rooms' && q.op === 'upsert') {
      const payload = q.payload as { booking_id: string };
      return { data: { ...ROOM, id: `room-of-${payload.booking_id}`, booking_id: payload.booking_id } };
    }
    if (q.table === 'tour_room_invites' && q.op === 'select') return { data: null }; // 미폐기
    if (q.table === 'tour_room_invites' && q.op === 'insert') return { data: null };
    if (q.table === 'bookings') return { data: ROSTER };
    if (q.table === 'tour_room_participants' && q.op === 'select') {
      return { data: (options.claimedBookingIds ?? []).map((id) => ({ booking_id: id })) };
    }
    if (q.table === 'tour_room_participants' && q.op === 'upsert') {
      return { data: { id: 'p-new', is_lead: true } };
    }
    if (q.table === 'tour_room_events') return { data: { id: 'ev1' } };
    return { data: null };
  }, log);
  createServerClientMock.mockReturnValue(db);
  return { db, log };
}

const params = (roomId = 'room-1') => ({ params: Promise.resolve({ roomId }) });

beforeEach(() => {
  jest.clearAllMocks();
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
});

describe('GET /api/ops/rooms/[roomId]/claim', () => {
  it('returns the masked roster (C-1) with claimed flags — no contact fields', async () => {
    claimDb({ claimedBookingIds: ['b2'] });
    const { token } = signRoomClaimToken({ roomId: 'room-1', tourId: 'tour-1', tourDate: FUTURE });
    const res = await claimGET(fakeNextRequest({ searchParams: { ct: token } }), params());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookings).toEqual([
      { bookingId: 'b1', name: 'Massimo C.', partySize: 2, claimed: false },
      { bookingId: 'b2', name: 'Tanaka Y.', partySize: 3, claimed: true },
    ]);
    expect(JSON.stringify(body)).not.toContain('gmail.com');
    expect(JSON.stringify(body)).not.toContain('Colombo');
  });

  it('rejects a missing/foreign claim token', async () => {
    claimDb();
    const res = await claimGET(fakeNextRequest({}), params());
    expect(res.status).toBe(403);
    const other = signRoomClaimToken({ roomId: 'room-OTHER', tourId: 'tour-1', tourDate: FUTURE }).token;
    const res2 = await claimGET(fakeNextRequest({ searchParams: { ct: other } }), params());
    expect(res2.status).toBe(403);
  });
});

describe('POST /api/ops/rooms/[roomId]/claim', () => {
  const claimToken = () => signRoomClaimToken({ roomId: 'room-1', tourId: 'tour-1', tourDate: FUTURE }).token;

  it('claims an unclaimed booking: participant + personal token + ledger (C-3)', async () => {
    const { log } = claimDb();
    const res = await claimPOST(
      fakeNextRequest({
        body: {
          claimToken: claimToken(),
          bookingId: 'b1',
          deviceKey: DEVICE,
          answer: { partySize: 2 },
          displayName: 'Massimo',
        },
      }),
      params(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();

    // 개인 토큰은 기존 booking-scope 규약으로 검증 가능해야 한다 (§5.1 2층).
    const payload = verifyRoomToken(body.token);
    expect(payload).toMatchObject({ scope: 'booking', role: 'customer', bookingId: 'b1' });

    const upserts = queriesFor(log, 'tour_room_participants', 'upsert');
    expect(upserts).toHaveLength(1);
    expect(upserts[0].payload).toMatchObject({
      booking_id: 'b1',
      role: 'customer',
      device_key: DEVICE,
      is_lead: true, // C-3 — 첫 claim = lead
    });

    const ledger = queriesFor(log, 'tour_room_invites', 'insert');
    expect(ledger).toHaveLength(1);
    expect(ledger[0].payload).toMatchObject({ booking_id: 'b1', role: 'customer', sent_via: 'ops-link' });
    expect((ledger[0].payload as { token_hash: string }).token_hash).toMatch(/^[0-9a-f]{64}$/);

    const events = queriesFor(log, 'tour_room_events', 'insert');
    expect(events.some((e) => (e.payload as { type?: string }).type === 'guest_claimed')).toBe(true);
  });

  it('rejects a wrong confirmation answer (C-2) without leaking detail', async () => {
    claimDb();
    const res = await claimPOST(
      fakeNextRequest({
        body: { claimToken: claimToken(), bookingId: 'b1', deviceKey: DEVICE, answer: { partySize: 5 } },
      }),
      params(),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('verification_failed');
  });

  it('answers 409 + review queue on an already-claimed booking (C-5)', async () => {
    const { log } = claimDb({ claimedBookingIds: ['b2'] });
    const res = await claimPOST(
      fakeNextRequest({
        body: { claimToken: claimToken(), bookingId: 'b2', deviceKey: DEVICE, answer: { partySize: 3 } },
      }),
      params(),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'already_claimed', reviewQueued: true });

    const events = queriesFor(log, 'tour_room_events', 'insert');
    const reclaim = events.find((e) => (e.payload as { type?: string }).type === 'reclaim_requested');
    expect(reclaim).toBeTruthy();
    expect((reclaim!.payload as { subject_key: string }).subject_key).toBe(`reclaim:b2:${DEVICE}`);
    expect(sendOpsPushMock).toHaveBeenCalledTimes(1);

    // participant/토큰은 절대 발급되지 않는다.
    expect(queriesFor(log, 'tour_room_participants', 'upsert')).toHaveLength(0);
    expect(queriesFor(log, 'tour_room_invites', 'insert')).toHaveLength(0);
  });

  it('404s a booking outside the room scope', async () => {
    claimDb();
    const res = await claimPOST(
      fakeNextRequest({
        body: { claimToken: claimToken(), bookingId: 'b-foreign', deviceKey: DEVICE, answer: { partySize: 2 } },
      }),
      params(),
    );
    expect(res.status).toBe(404);
  });
});
