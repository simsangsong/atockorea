/**
 * @jest-environment node
 *
 * §5.4 C-15/C-16 시작 게이트 라우트 — 상태 조회, 미충족 400, 시작(잠금+
 * idempotent tour_start+브리핑 1회), 재탭 멱등.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET as gateGET, POST as gatePOST } from '@/app/api/ops/rooms/[roomId]/gate/route';
import { signGuideRoomToken, signCustomerRoomToken } from '@/lib/tour-room/token';
import { createServerClient } from '@/lib/supabase';
import { fireTourStartBriefing } from '@/lib/ops/seating/startBriefing';
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
jest.mock('@/lib/ops/seating/startBriefing', () => ({
  fireTourStartBriefing: jest.fn(async () => ({ delivered: 2, skipped: 0 })),
}));

const createServerClientMock = createServerClient as jest.Mock;
const fireBriefingMock = fireTourStartBriefing as jest.Mock;

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

function gateDb(options: { assignments: SeatRow[]; startEventConflict?: boolean; startedEvents?: unknown[] }) {
  const log: FakeQuery[] = [];
  const db = makeFakeDb((q) => {
    if (q.table === 'tour_rooms' && q.terminal === 'maybeSingle') return { data: ROOM };
    if (q.table === 'tour_rooms' && q.terminal === 'list') return { data: [{ id: 'room-1', status: 'active' }] };
    if (q.table === 'tour_room_invites') return { data: null };
    if (q.table === 'ops_room_vehicles') {
      return { data: [{ id: 'v1', room_id: 'room-1', layout_id: 'l1', plate_number: null, ops_vehicle_layouts: null }] };
    }
    if (q.table === 'ops_seat_assignments' && q.op === 'select') return { data: options.assignments };
    if (q.table === 'ops_seat_assignments') return { data: null };
    if (q.table === 'tour_room_events' && q.op === 'insert') {
      if (options.startEventConflict) return { error: { code: '23505', message: 'duplicate key' } };
      return { data: { id: 'ev-start', created_at: 'T' } };
    }
    if (q.table === 'tour_room_events' && q.op === 'select') return { data: options.startedEvents ?? [] };
    return { data: null };
  }, log);
  createServerClientMock.mockReturnValue(db);
  return { db, log };
}

const params = { params: Promise.resolve({ roomId: 'room-1' }) };
const guideToken = () => signGuideRoomToken({ tourId: 'tour-1', tourDate: FUTURE, displayName: 'G' }).token;

const ALL_RESOLVED: SeatRow[] = [
  { id: 'a1', room_vehicle_id: 'v1', booking_id: 'b1', seat_number: 1, checked_in_at: 'T' },
  { id: 'a2', room_vehicle_id: 'v1', booking_id: 'b2', seat_number: 2, checked_in_at: 'T' },
  { id: 'a3', room_vehicle_id: 'v1', booking_id: 'b3', seat_number: 3, absent_at: 'T' }, // 노쇼 제외 (C-15 ⚠)
];

beforeEach(() => jest.clearAllMocks());

describe('GET /api/ops/rooms/[roomId]/gate', () => {
  it('reports counts, resolved flag, and started state', async () => {
    gateDb({
      assignments: [
        { id: 'a1', room_vehicle_id: 'v1', booking_id: 'b1', seat_number: 1, checked_in_at: 'T' },
        { id: 'a2', room_vehicle_id: 'v1', booking_id: 'b2', seat_number: 2 },
      ],
      startedEvents: [],
    });
    const res = await gateGET(fakeNextRequest({ headers: { 'x-tour-room-token': guideToken() } }), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.counts).toEqual({ total: 2, checkedIn: 1, absent: 0, waiting: 1 });
    expect(body.resolved).toBe(false);
    expect(body.started).toBe(false);
  });
});

describe('POST /api/ops/rooms/[roomId]/gate ([투어 시작])', () => {
  it('refuses while seats are unresolved (C-15) or with zero assignments', async () => {
    gateDb({
      assignments: [{ id: 'a1', room_vehicle_id: 'v1', booking_id: 'b1', seat_number: 1 }],
    });
    const res = await gatePOST(fakeNextRequest({ headers: { 'x-tour-room-token': guideToken() } }), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('gate_not_ready');

    gateDb({ assignments: [] });
    const empty = await gatePOST(fakeNextRequest({ headers: { 'x-tour-room-token': guideToken() } }), params);
    expect(empty.status).toBe(400);
    expect(fireBriefingMock).not.toHaveBeenCalled();
  });

  it('locks all seats, records idempotent tour_start, and fires the briefing once (C-16)', async () => {
    const { log } = gateDb({ assignments: ALL_RESOLVED });
    const res = await gatePOST(fakeNextRequest({ headers: { 'x-tour-room-token': guideToken() } }), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ started: true, alreadyStarted: false });

    const locks = queriesFor(log, 'ops_seat_assignments', 'update');
    expect(locks).toHaveLength(1);
    expect(locks[0].payload).toEqual({ locked: true });

    const events = queriesFor(log, 'tour_room_events', 'insert');
    expect(events[0].payload).toMatchObject({ type: 'tour_start', subject_key: 'tour_start' });

    expect(fireBriefingMock).toHaveBeenCalledTimes(1);
    expect(fireBriefingMock).toHaveBeenCalledWith(expect.anything(), { tourId: 'tour-1', tourDate: FUTURE });
  });

  it('is idempotent on a re-tap: no second briefing (subject_key 디듀프)', async () => {
    gateDb({ assignments: ALL_RESOLVED, startEventConflict: true });
    const res = await gatePOST(fakeNextRequest({ headers: { 'x-tour-room-token': guideToken() } }), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ started: true, alreadyStarted: true });
    expect(fireBriefingMock).not.toHaveBeenCalled();
  });

  it('is staff-only', async () => {
    gateDb({ assignments: ALL_RESOLVED });
    const customer = signCustomerRoomToken({ bookingId: 'b1', displayName: 'M', tourDate: FUTURE }).token;
    const res = await gatePOST(fakeNextRequest({ headers: { 'x-tour-room-token': customer } }), params);
    expect(res.status).toBe(403);
  });
});
