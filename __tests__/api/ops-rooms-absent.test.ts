/**
 * @jest-environment node
 *
 * §5.4 C-15 노쇼(absent) 라우트 — 마킹/해제, staff 전용, evidenceUrl 기록,
 * 미배정 좌석 404.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as absentPOST } from '@/app/api/ops/rooms/[roomId]/absent/route';
import { signGuideRoomToken, signCustomerRoomToken } from '@/lib/tour-room/token';
import { createServerClient } from '@/lib/supabase';
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

const createServerClientMock = createServerClient as jest.Mock;

const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const ROOM = { id: 'room-1', booking_id: 'b1', tour_id: 'tour-1', tour_date: FUTURE, status: 'active' };
const SEAT = { id: 'a1', room_vehicle_id: 'v1', booking_id: 'b1', seat_number: 3 };

function absentDb() {
  const log: FakeQuery[] = [];
  const db = makeFakeDb((q) => {
    if (q.table === 'tour_rooms' && q.terminal === 'maybeSingle') return { data: ROOM };
    if (q.table === 'tour_rooms' && q.terminal === 'list') return { data: [{ id: 'room-1', status: 'active' }] };
    if (q.table === 'tour_room_invites') return { data: null };
    if (q.table === 'ops_room_vehicles') {
      return { data: [{ id: 'v1', room_id: 'room-1', layout_id: 'l1', plate_number: null, ops_vehicle_layouts: null }] };
    }
    if (q.table === 'ops_seat_assignments' && q.op === 'select') return { data: [SEAT] };
    if (q.table === 'ops_seat_assignments') return { data: null };
    if (q.table === 'tour_room_events') return { data: { id: 'ev' } };
    return { data: null };
  }, log);
  createServerClientMock.mockReturnValue(db);
  return { db, log };
}

const params = { params: Promise.resolve({ roomId: 'room-1' }) };
const guideToken = () => signGuideRoomToken({ tourId: 'tour-1', tourDate: FUTURE, displayName: 'G' }).token;

beforeEach(() => jest.clearAllMocks());

describe('POST /api/ops/rooms/[roomId]/absent (C-15)', () => {
  it('marks a seat absent with an evidence url in the event', async () => {
    const { log } = absentDb();
    const res = await absentPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': guideToken() },
        body: { roomVehicleId: 'v1', seatNumber: 3, action: 'mark', evidenceUrl: 'https://x/y.jpg' },
      }),
      params,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, seatNumber: 3, action: 'mark' });
    const updates = queriesFor(log, 'ops_seat_assignments', 'update');
    expect((updates[0].payload as { absent_at: string }).absent_at).toBeTruthy();
    const events = queriesFor(log, 'tour_room_events', 'insert');
    expect(events[0].payload).toMatchObject({
      type: 'seat_absent',
      payload: expect.objectContaining({ evidence_url: 'https://x/y.jpg' }),
    });
  });

  it('clears an absent flag', async () => {
    const { log } = absentDb();
    const res = await absentPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': guideToken() },
        body: { roomVehicleId: 'v1', seatNumber: 3, action: 'clear' },
      }),
      params,
    );
    expect(res.status).toBe(200);
    expect((queriesFor(log, 'ops_seat_assignments', 'update')[0].payload as { absent_at: null }).absent_at).toBeNull();
  });

  it('is staff-only and 404s an unassigned seat', async () => {
    absentDb();
    const customer = signCustomerRoomToken({ bookingId: 'b1', displayName: 'M', tourDate: FUTURE }).token;
    const notStaff = await absentPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': customer },
        body: { roomVehicleId: 'v1', seatNumber: 3, action: 'mark' },
      }),
      params,
    );
    expect(notStaff.status).toBe(403);

    absentDb();
    const missing = await absentPOST(
      fakeNextRequest({
        headers: { 'x-tour-room-token': guideToken() },
        body: { roomVehicleId: 'v1', seatNumber: 19, action: 'mark' },
      }),
      params,
    );
    expect(missing.status).toBe(404);
  });

  it('validates required fields', async () => {
    absentDb();
    const res = await absentPOST(
      fakeNextRequest({ headers: { 'x-tour-room-token': guideToken() }, body: { roomVehicleId: 'v1' } }),
      params,
    );
    expect(res.status).toBe(400);
  });
});
