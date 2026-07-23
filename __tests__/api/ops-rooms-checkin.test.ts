/**
 * @jest-environment node
 *
 * §5.4 체크인 라우트 — 3경로 수렴(C-13), 당일 게이트(C-12), QR nonce 만료,
 * 정적 QR 경로(Q-1), 가이드 수동 + undo, 멱등 재스캔.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET as checkinGET, POST as checkinPOST } from '@/app/api/ops/rooms/[roomId]/checkin/route';
import { signCustomerRoomToken, signGuideRoomToken } from '@/lib/tour-room/token';
import { signRoomCheckinToken } from '@/lib/ops/seating/checkinToken';
import { mintCheckinNonce, CHECKIN_NONCE_BUCKET_MS } from '@/lib/ops/seating/qrNonce';
import { createServerClient } from '@/lib/supabase';
import { kstToday } from '@/lib/tour-room/time';
import {
  makeFakeDb,
  queriesFor,
  fakeNextRequest,
  type FakeQuery,
} from '@/test-utils/opsSeatingFakes';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn(async () => null) }));
jest.mock('@/lib/tour-room/realtime', () => ({
  broadcastToRoom: jest.fn(async () => ({ ok: true })),
  broadcastToRooms: jest.fn(async () => ({ ok: true })),
}));
jest.mock('@/lib/tour-room/time', () => {
  const actual = jest.requireActual('@/lib/tour-room/time');
  return { ...actual, kstToday: jest.fn(() => '2000-01-01') };
});

const createServerClientMock = createServerClient as jest.Mock;
const kstTodayMock = kstToday as jest.Mock;

const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const ROOM = { id: 'room-1', booking_id: 'b1', tour_id: 'tour-1', tour_date: FUTURE, status: 'active' };

interface SeatRow {
  id: string;
  room_vehicle_id: string;
  booking_id: string;
  seat_number: number;
  checked_in_at?: string | null;
  absent_at?: string | null;
  locked?: boolean;
}

function checkinDb(assignments: SeatRow[]) {
  const log: FakeQuery[] = [];
  const db = makeFakeDb((q) => {
    if (q.table === 'tour_rooms' && q.terminal === 'maybeSingle') return { data: ROOM };
    if (q.table === 'tour_rooms' && q.terminal === 'list') return { data: [{ id: 'room-1', status: 'active' }] };
    if (q.table === 'tour_room_invites') return { data: null };
    if (q.table === 'ops_room_vehicles') {
      return { data: [{ id: 'v1', room_id: 'room-1', layout_id: 'l1', plate_number: null, ops_vehicle_layouts: null }] };
    }
    if (q.table === 'ops_seat_assignments' && q.op === 'select') return { data: assignments };
    if (q.table === 'ops_seat_assignments') return { data: null };
    if (q.table === 'tour_room_events') return { data: { id: 'ev' } };
    return { data: null };
  }, log);
  createServerClientMock.mockReturnValue(db);
  return { db, log };
}

const params = { params: Promise.resolve({ roomId: 'room-1' }) };
const customerToken = () => signCustomerRoomToken({ bookingId: 'b1', displayName: 'M', tourDate: FUTURE }).token;
const guideToken = () => signGuideRoomToken({ tourId: 'tour-1', tourDate: FUTURE, displayName: 'G' }).token;
const qrToken = () => signRoomCheckinToken({ roomId: 'room-1', tourId: 'tour-1', tourDate: FUTURE }).token;

const PENDING: SeatRow[] = [
  { id: 'a1', room_vehicle_id: 'v1', booking_id: 'b1', seat_number: 3 },
  { id: 'a2', room_vehicle_id: 'v1', booking_id: 'b1', seat_number: 4 },
];

beforeEach(() => {
  jest.clearAllMocks();
  kstTodayMock.mockReturnValue(FUTURE); // 기본 = 투어 당일
});

describe('GET /api/ops/rooms/[roomId]/checkin (QR 발급)', () => {
  it('issues console (nonce) + static (print) QR URLs to staff', async () => {
    checkinDb([]);
    const res = await checkinGET(fakeNextRequest({ headers: { 'x-tour-room-token': guideToken() } }), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.consoleUrl).toContain('/tour-mode/checkin/');
    expect(body.consoleUrl).toContain('?n=');
    expect(body.staticUrl).not.toContain('?n=');
    expect(body.rotatesInSec).toBeGreaterThan(0);
    expect(body.rotatesInSec).toBeLessThanOrEqual(300);
  });

  it('refuses customers', async () => {
    checkinDb([]);
    const res = await checkinGET(fakeNextRequest({ headers: { 'x-tour-room-token': customerToken() } }), params);
    expect(res.status).toBe(403);
  });
});

describe('POST guest_app (C-13②)', () => {
  it('blocks before the tour day (C-12)', async () => {
    checkinDb(PENDING);
    kstTodayMock.mockReturnValue('2000-01-01');
    const res = await checkinPOST(
      fakeNextRequest({ headers: { 'x-tour-room-token': customerToken() }, body: { method: 'guest_app' } }),
      params,
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('checkin_not_open');
  });

  it('checks in the whole party on the tour day and records the actor', async () => {
    const { log } = checkinDb(PENDING);
    const res = await checkinPOST(
      fakeNextRequest({ headers: { 'x-tour-room-token': customerToken() }, body: { method: 'guest_app' } }),
      params,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).seatNumbers).toEqual([3, 4]);
    const updates = queriesFor(log, 'ops_seat_assignments', 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toMatchObject({ checkin_actor: 'guest_app' });
  });

  it('supports partial party check-in via seatNumbers (§5.4c 3)', async () => {
    const { log } = checkinDb(PENDING);
    const res = await checkinPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': customerToken() },
        body: { method: 'guest_app', seatNumbers: [4] },
      }),
      params,
    );
    expect((await res.json()).seatNumbers).toEqual([4]);
    const updates = queriesFor(log, 'ops_seat_assignments', 'update');
    expect(updates[0].filters.find((f) => f.method === 'in')?.args?.[1]).toEqual(['a2']);
  });

  it('is idempotent when everything is already green (재스캔 ✓)', async () => {
    checkinDb(PENDING.map((a) => ({ ...a, checked_in_at: 'T' })));
    const res = await checkinPOST(
      fakeNextRequest({ headers: { 'x-tour-room-token': customerToken() }, body: { method: 'guest_app' } }),
      params,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, alreadyCheckedIn: true, seatNumbers: [3, 4] });
  });

  it('400s a booking with no seats', async () => {
    checkinDb([]);
    const res = await checkinPOST(
      fakeNextRequest({ headers: { 'x-tour-room-token': customerToken() }, body: { method: 'guest_app' } }),
      params,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('no_seats');
  });
});

describe('POST guest_qr (C-13① + §5.4c)', () => {
  it('accepts a rotating nonce within its window', async () => {
    const { log } = checkinDb(PENDING);
    const { nonce } = mintCheckinNonce('room-1');
    const res = await checkinPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': customerToken() },
        body: { method: 'guest_qr', checkinToken: qrToken(), nonce },
      }),
      params,
    );
    expect(res.status).toBe(200);
    expect(queriesFor(log, 'ops_seat_assignments', 'update')[0].payload).toMatchObject({
      checkin_actor: 'guest_qr',
    });
  });

  it('rejects an expired nonce (5분 로테이션 2버킷 경과)', async () => {
    checkinDb(PENDING);
    const { nonce } = mintCheckinNonce('room-1', Date.now() - 2 * CHECKIN_NONCE_BUCKET_MS);
    const res = await checkinPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': customerToken() },
        body: { method: 'guest_qr', checkinToken: qrToken(), nonce },
      }),
      params,
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('nonce_expired');
  });

  it('passes the static printed QR with no nonce (Q-1 문서화된 경로)', async () => {
    checkinDb(PENDING);
    const res = await checkinPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': customerToken() },
        body: { method: 'guest_qr', checkinToken: qrToken() },
      }),
      params,
    );
    expect(res.status).toBe(200);
  });

  it('rejects a foreign/garbage checkinToken', async () => {
    checkinDb(PENDING);
    const foreign = signRoomCheckinToken({ roomId: 'room-OTHER', tourId: 'tour-1', tourDate: FUTURE }).token;
    for (const checkinToken of [foreign, 'garbage']) {
      const res = await checkinPOST(
        fakeNextRequest({
          headers: { 'x-tour-room-token': customerToken() },
          body: { method: 'guest_qr', checkinToken },
        }),
        params,
      );
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe('invalid_checkin_token');
    }
  });
});

describe('POST guide_manual (C-13③)', () => {
  it('checks a specific seat in and back out, staff only', async () => {
    const { log } = checkinDb(PENDING);
    const res = await checkinPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': guideToken() },
        body: { method: 'guide_manual', roomVehicleId: 'v1', seatNumber: 3 },
      }),
      params,
    );
    expect(res.status).toBe(200);
    expect(queriesFor(log, 'ops_seat_assignments', 'update')[0].payload).toMatchObject({
      checkin_actor: 'guide_manual',
    });

    const undo = await checkinPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': guideToken() },
        body: { method: 'guide_manual', roomVehicleId: 'v1', seatNumber: 3, action: 'undo' },
      }),
      params,
    );
    expect(undo.status).toBe(200);
    expect((await undo.json()).action).toBe('undo');
  });

  it('is refused for customers and unknown seats', async () => {
    checkinDb(PENDING);
    const notStaff = await checkinPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': customerToken() },
        body: { method: 'guide_manual', roomVehicleId: 'v1', seatNumber: 3 },
      }),
      params,
    );
    expect(notStaff.status).toBe(403);

    const missing = await checkinPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': guideToken() },
        body: { method: 'guide_manual', roomVehicleId: 'v1', seatNumber: 19 },
      }),
      params,
    );
    expect(missing.status).toBe(404);
  });
});
