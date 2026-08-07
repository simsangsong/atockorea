/**
 * @jest-environment node
 *
 * "내 좌석" — the guest-facing seat state.
 *
 * 🔴 Two defects this pins, both of which shipped and both of which were
 * invisible from the inside.
 *
 * ① `none` used to mean BOTH "no vehicle yet" and "no seating on this product",
 *    and the card rendered nothing for `none`. Live dispatch has happened once
 *    in the product's history, so in practice **every guest** got the silent
 *    branch: no seat card, no tile, no explanation. The card's own header
 *    comment promised a "seats open once your vehicle is assigned" state that
 *    could not physically render. `awaiting` is that state.
 *
 * ② `can_pick` was gated on the calendar (`kstToday() < tour_date`). The thing
 *    that must not move is a seat carrying check-in or no-show evidence, and
 *    the seats route already refuses those per assignment. Owner decision
 *    (2026-08-07): open until check-in.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET } from '@/app/api/tour-rooms/[bookingId]/my-seat/route';
import { resolveRoomActor, ensureRoom } from '@/lib/tour-room/access';
import { loadRoomVehicles, loadAssignments } from '@/lib/ops/seating/service';
import { createServerClient } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/tour-room/access', () => ({
  resolveRoomActor: jest.fn(),
  ensureRoom: jest.fn(async () => ({ id: 'room-1', booking_id: 'b1', tour_id: 'tour-1', tour_date: '2026-08-08', status: 'active' })),
}));
jest.mock('@/lib/ops/seating/service', () => ({
  loadRoomVehicles: jest.fn(async () => []),
  loadAssignments: jest.fn(async () => []),
}));

const resolveRoomActorMock = resolveRoomActor as jest.Mock;
const loadRoomVehiclesMock = loadRoomVehicles as jest.Mock;
const loadAssignmentsMock = loadAssignments as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;

const LAYOUT = { seats: [{ n: 1 }, { n: 2 }, { n: 3 }] };
const VEHICLE = { id: 'v1', room_id: 'room-1', layout_id: 'l1', plate_number: '12가 3456', layout: LAYOUT, total_seats: 20, model: 'county_20', layout_overridden: false };

/** `tours.price_type` is the join-vs-private discriminator; party size comes from bookings. */
function fakeDb({ priceType, partySize = 2 }: { priceType: string | null; partySize?: number }) {
  createServerClientMock.mockReturnValue({
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq']) chain[m] = jest.fn(() => chain);
      chain.maybeSingle = jest.fn(async () =>
        table === 'tours' ? { data: { price_type: priceType } } : { data: { number_of_guests: partySize } },
      );
      return chain;
    },
  });
}

const req = () => ({ headers: { get: () => null }, nextUrl: { searchParams: new URLSearchParams() } }) as never;
const ctx = { params: Promise.resolve({ bookingId: 'b1' }) };

async function body() {
  const res = await GET(req(), ctx);
  expect(res.status).toBe(200);
  return res.json();
}

beforeEach(() => {
  jest.clearAllMocks();
  loadRoomVehiclesMock.mockResolvedValue([]);
  loadAssignmentsMock.mockResolvedValue([]);
  resolveRoomActorMock.mockResolvedValue({
    ok: true,
    booking: { id: 'b1', tour_id: 'tour-1', tour_date: '2026-08-08' },
    actor: { kind: 'session', role: 'customer', sessionPayload: { participantId: 'p1' }, displayName: 'Alex' },
  });
});

describe('GET /api/tour-rooms/[bookingId]/my-seat', () => {
  it('says "awaiting" — not "none" — when a join tour has no vehicle yet', async () => {
    fakeDb({ priceType: 'person' });
    expect(await body()).toMatchObject({ state: 'awaiting', can_pick: false });
  });

  it('still says "none" for a private charter, which has no seat map to wait for', async () => {
    // 'vehicle' is the price_type that means charter (lib/tour-room/tourKind).
    fakeDb({ priceType: 'vehicle' });
    expect(await body()).toMatchObject({ state: 'none' });
  });

  it('treats an unknown price_type as a join tour — the seating-bearing default', async () => {
    fakeDb({ priceType: null });
    expect(await body()).toMatchObject({ state: 'awaiting' });
  });

  it('lets a guest pick on the tour day itself when nothing is checked in (C-11 개정)', async () => {
    fakeDb({ priceType: 'person' });
    loadRoomVehiclesMock.mockResolvedValue([VEHICLE]);
    expect(await body()).toMatchObject({ state: 'pending', can_pick: true, party_size: 2 });
  });

  it('closes picking once MY seat carries check-in evidence', async () => {
    fakeDb({ priceType: 'person' });
    loadRoomVehiclesMock.mockResolvedValue([VEHICLE]);
    loadAssignmentsMock.mockResolvedValue([
      { id: 'a1', room_vehicle_id: 'v1', booking_id: 'b1', participant_id: 'p1', seat_number: 3, checked_in_at: 'T', absent_at: null, locked: false },
    ]);
    expect(await body()).toMatchObject({ state: 'assigned', seat_number: 3, plate_number: '12가 3456', can_pick: false });
  });

  it('does not close picking just because SOMEONE ELSE checked in', async () => {
    // 판정 대상은 내 배정 행이다. 남의 체크인으로 내가 얼어붙으면, 조인 투어에서
    // 먼저 도착한 한 명이 나머지 전원의 좌석 선택을 막게 된다.
    fakeDb({ priceType: 'person' });
    loadRoomVehiclesMock.mockResolvedValue([VEHICLE]);
    loadAssignmentsMock.mockResolvedValue([
      { id: 'a9', room_vehicle_id: 'v1', booking_id: 'b-other', participant_id: 'p9', seat_number: 1, checked_in_at: 'T', absent_at: null, locked: false },
    ]);
    expect(await body()).toMatchObject({ state: 'pending', can_pick: true });
  });

  it('closes picking for everyone once the start gate locks the board', async () => {
    fakeDb({ priceType: 'person' });
    loadRoomVehiclesMock.mockResolvedValue([VEHICLE]);
    loadAssignmentsMock.mockResolvedValue([
      { id: 'a9', room_vehicle_id: 'v1', booking_id: 'b-other', participant_id: 'p9', seat_number: 1, checked_in_at: null, absent_at: null, locked: true },
    ]);
    expect(await body()).toMatchObject({ can_pick: false });
  });

  it('never offers picking to staff — they have their own board', async () => {
    fakeDb({ priceType: 'person' });
    loadRoomVehiclesMock.mockResolvedValue([VEHICLE]);
    resolveRoomActorMock.mockResolvedValue({
      ok: true,
      booking: { id: 'b1', tour_id: 'tour-1', tour_date: '2026-08-08' },
      actor: { kind: 'token', role: 'guide', tokenPayload: {}, displayName: 'G' },
    });
    expect(await body()).toMatchObject({ can_pick: false });
  });
});
