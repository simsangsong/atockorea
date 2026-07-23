/**
 * @jest-environment node
 *
 * §5.3 좌석 라우트 — 선택/레이스 409(C-10)/당일 잠금(C-11)/party 상한/해제.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as seatsPOST, DELETE as seatsDELETE, GET as seatsGET } from '@/app/api/ops/rooms/[roomId]/seats/route';
import { signCustomerRoomToken, signGuideRoomToken } from '@/lib/tour-room/token';
import { VEHICLE_LAYOUT_SEEDS } from '@/lib/ops/seating/layouts';
import { createServerClient } from '@/lib/supabase';
import { kstToday } from '@/lib/tour-room/time';
import { broadcastToRooms } from '@/lib/tour-room/realtime';
import {
  makeFakeDb,
  queriesFor,
  filterArgs,
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
const broadcastToRoomsMock = broadcastToRooms as jest.Mock;

const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const ROOM = { id: 'room-1', booking_id: 'b1', tour_id: 'tour-1', tour_date: FUTURE, status: 'active' };
const LAYOUT = VEHICLE_LAYOUT_SEEDS.county_20.layout;

interface SeatRow {
  id: string;
  room_vehicle_id: string;
  booking_id: string;
  seat_number: number;
  guest_label?: string | null;
  checked_in_at?: string | null;
  absent_at?: string | null;
  locked?: boolean;
}

function seatsDb(options: { assignments?: SeatRow[]; insertError?: unknown; partySize?: number } = {}) {
  const log: FakeQuery[] = [];
  const db = makeFakeDb((q) => {
    if (q.table === 'tour_rooms' && q.terminal === 'maybeSingle') return { data: ROOM };
    if (q.table === 'tour_rooms' && q.terminal === 'list') return { data: [{ id: 'room-1', status: 'active' }] };
    if (q.table === 'tour_room_invites') return { data: null };
    if (q.table === 'bookings') {
      const cols = String(filterArgs(q, 'select')?.[0] ?? '');
      if (cols.includes('number_of_guests')) return { data: { number_of_guests: options.partySize ?? 2 } };
      return { data: { id: 'b2', tour_id: 'tour-1', tour_date: FUTURE } };
    }
    if (q.table === 'ops_room_vehicles') {
      return {
        data: [
          {
            id: 'v1',
            room_id: 'room-1',
            layout_id: 'l1',
            plate_number: null,
            ops_vehicle_layouts: { model: 'county_20', layout_json: LAYOUT, total_seats: 20 },
          },
        ],
      };
    }
    if (q.table === 'ops_seat_assignments' && q.op === 'select') return { data: options.assignments ?? [] };
    if (q.table === 'ops_seat_assignments' && q.op === 'insert') {
      return options.insertError ? { error: options.insertError } : { data: null };
    }
    if (q.table === 'ops_seat_assignments') return { data: null }; // update/delete
    if (q.table === 'tour_room_events') return { data: { id: 'ev' } };
    return { data: null };
  }, log);
  createServerClientMock.mockReturnValue(db);
  return { db, log };
}

const params = { params: Promise.resolve({ roomId: 'room-1' }) };
const customerToken = () => signCustomerRoomToken({ bookingId: 'b1', displayName: 'M', tourDate: FUTURE }).token;
const guideToken = () => signGuideRoomToken({ tourId: 'tour-1', tourDate: FUTURE, displayName: 'G' }).token;

beforeEach(() => {
  jest.clearAllMocks();
  kstTodayMock.mockReturnValue('2000-01-01'); // 투어 전날 기준
});

describe('GET /api/ops/rooms/[roomId]/seats', () => {
  it('returns per-vehicle layout + viewer seat states', async () => {
    seatsDb({
      assignments: [
        { id: 'a1', room_vehicle_id: 'v1', booking_id: 'b1', seat_number: 1 },
        { id: 'a2', room_vehicle_id: 'v1', booking_id: 'b9', seat_number: 2, checked_in_at: 'T' },
      ],
    });
    const res = await seatsGET(fakeNextRequest({ headers: { 'x-tour-room-token': customerToken() } }), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vehicles).toHaveLength(1);
    expect(body.vehicles[0].seatStates).toMatchObject({ 1: 'mine', 2: 'checked_in' });
  });

  it('403s with no credential', async () => {
    seatsDb();
    const res = await seatsGET(fakeNextRequest({}), params);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/ops/rooms/[roomId]/seats', () => {
  it('assigns party seats for the token booking (C-9)', async () => {
    const { log } = seatsDb();
    const res = await seatsPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': customerToken() },
        body: { roomVehicleId: 'v1', seats: [{ seatNumber: 3, guestLabel: 'Massimo C.' }, { seatNumber: 4 }] },
      }),
      params,
    );
    expect(res.status).toBe(201);
    const inserts = queriesFor(log, 'ops_seat_assignments', 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toEqual([
      expect.objectContaining({ room_vehicle_id: 'v1', booking_id: 'b1', seat_number: 3, guest_label: 'Massimo C.' }),
      expect.objectContaining({ seat_number: 4 }),
    ]);
    expect(broadcastToRoomsMock).toHaveBeenCalledWith(
      [{ id: 'room-1', status: 'active' }],
      'seat_update',
      expect.objectContaining({ kind: 'assigned', seatNumbers: [3, 4] }),
    );
  });

  it('answers 409 + fresh state on a seat race (UNIQUE 23505, C-10)', async () => {
    seatsDb({ insertError: { code: '23505', message: 'duplicate key value' } });
    const res = await seatsPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': customerToken() },
        body: { roomVehicleId: 'v1', seats: [{ seatNumber: 3 }] },
      }),
      params,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('seat_taken');
    expect(body.vehicles).toBeDefined(); // 재선택 유도용 최신 상태
  });

  it('blocks guest changes from the tour day (C-11)', async () => {
    seatsDb();
    kstTodayMock.mockReturnValue(FUTURE);
    const res = await seatsPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': customerToken() },
        body: { roomVehicleId: 'v1', seats: [{ seatNumber: 3 }] },
      }),
      params,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('seat_change_locked');
  });

  it('still lets staff assign on the tour day (§5.4b 현장 지정) — bookingId 필수', async () => {
    seatsDb();
    kstTodayMock.mockReturnValue(FUTURE);
    const missing = await seatsPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': guideToken() },
        body: { roomVehicleId: 'v1', seats: [{ seatNumber: 3 }] },
      }),
      params,
    );
    expect(missing.status).toBe(400);

    const ok = await seatsPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': guideToken() },
        body: { roomVehicleId: 'v1', bookingId: 'b7', seats: [{ seatNumber: 3 }] },
      }),
      params,
    );
    expect(ok.status).toBe(201);
  });

  it('rejects locked/checked-in reassignment, bad seat numbers, and party overflow', async () => {
    seatsDb({
      assignments: [{ id: 'a1', room_vehicle_id: 'v1', booking_id: 'b1', seat_number: 1, locked: true }],
    });
    const lockedRes = await seatsPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': customerToken() },
        body: { roomVehicleId: 'v1', seats: [{ seatNumber: 3 }] },
      }),
      params,
    );
    expect(lockedRes.status).toBe(400);
    expect((await lockedRes.json()).error).toBe('seats_locked_or_resolved');

    seatsDb();
    const badSeat = await seatsPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': customerToken() },
        body: { roomVehicleId: 'v1', seats: [{ seatNumber: 999 }] },
      }),
      params,
    );
    expect(badSeat.status).toBe(400);

    seatsDb({ partySize: 2 });
    const overflow = await seatsPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': customerToken() },
        body: { roomVehicleId: 'v1', seats: [{ seatNumber: 3 }, { seatNumber: 4 }, { seatNumber: 5 }] },
      }),
      params,
    );
    expect(overflow.status).toBe(400);
    expect((await overflow.json()).error).toBe('party_size_exceeded');
  });
});

describe('DELETE /api/ops/rooms/[roomId]/seats', () => {
  it('releases unresolved seats before the tour day', async () => {
    const { log } = seatsDb({
      assignments: [{ id: 'a1', room_vehicle_id: 'v1', booking_id: 'b1', seat_number: 3 }],
    });
    const res = await seatsDELETE(
      fakeNextRequest({
        headers: { 'x-tour-room-token': customerToken() },
        body: { roomVehicleId: 'v1' },
      }),
      params,
    );
    expect(res.status).toBe(200);
    const deletes = queriesFor(log, 'ops_seat_assignments', 'delete');
    expect(deletes).toHaveLength(1);
    // 체크인/노쇼/잠금 좌석은 삭제 필터로 보호된다.
    const methods = deletes[0].filters.map((f) => f.method);
    expect(methods).toEqual(expect.arrayContaining(['is', 'eq']));
  });

  it('blocks guest release on the tour day', async () => {
    seatsDb();
    kstTodayMock.mockReturnValue(FUTURE);
    const res = await seatsDELETE(
      fakeNextRequest({
        headers: { 'x-tour-room-token': customerToken() },
        body: { roomVehicleId: 'v1' },
      }),
      params,
    );
    expect(res.status).toBe(400);
  });
});
