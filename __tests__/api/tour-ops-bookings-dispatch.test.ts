/**
 * @jest-environment node
 *
 * 룸·링크 목록의 **배차 상태** — `vehicles[]` on /api/admin/tour-ops/bookings.
 *
 * 🔴 Why this is worth a test of its own.
 *
 * The dispatch button has been on this list since 2026-07-27, added because the
 * owner could not find the one buried in the room drawer. It still went unused:
 * `ops_room_vehicles` held ONE row for the product's entire history and
 * `ops_seat_assignments` held none. The missing piece was never the button, it
 * was that the list could not say WHICH teams needed one. This field is that
 * answer, and two ways of getting it wrong would both be silent:
 *
 *   ① counting per room instead of per (tour_id, tour_date) GROUP — a join
 *      tour's bus hangs off one anchor room, so every other booking on the same
 *      bus would be labelled 미배차 while sitting on it. Nine rows screaming for
 *      a vehicle they already have is worse than no badge.
 *   ② counting a vehicle row that has no layout — no layout means no seat map,
 *      so the guest's picker stays shut. Green there is a lie.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET } from '@/app/api/admin/tour-ops/bookings/route';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));

const createServerClientMock = createServerClient as jest.Mock;
const requireAdminMock = requireAdmin as jest.Mock;

const DATE = '2026-08-08';
const LAYOUT = { model: 'county_20', total_seats: 20, layout_json: { seats: [{ n: 1 }] } };

/**
 * Two bookings on ONE join tour (anchor + sibling) and one booking on another
 * tour. The bus hangs off the anchor room only — exactly the live shape.
 */
function fakeDb(roomVehicles: Array<Record<string, unknown>>) {
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'in', 'or', 'order']) chain[m] = jest.fn(() => chain);
      const rows = () => {
        switch (table) {
          case 'bookings':
            return [
              { id: 'b-anchor', tour_id: 'tour-join', tour_date: DATE, contact_name: 'A', status: 'confirmed' },
              { id: 'b-sibling', tour_id: 'tour-join', tour_date: DATE, contact_name: 'B', status: 'confirmed' },
              { id: 'b-other', tour_id: 'tour-solo', tour_date: DATE, contact_name: 'C', status: 'confirmed' },
            ];
          case 'tour_rooms':
            return [
              { id: 'room-anchor', booking_id: 'b-anchor', status: 'active' },
              { id: 'room-sibling', booking_id: 'b-sibling', status: 'active' },
              { id: 'room-other', booking_id: 'b-other', status: 'active' },
            ];
          case 'tours':
            return [
              { id: 'tour-join', title: 'Jeju Grand Loop', city: 'Jeju' },
              { id: 'tour-solo', title: 'Busan Top Attractions', city: 'Busan' },
            ];
          case 'ops_room_vehicles':
            return roomVehicles;
          default:
            return [];
        }
      };
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(res, rej);
      return chain;
    },
  };
  createServerClientMock.mockReturnValue(client);
  return client;
}

const req = () =>
  ({ nextUrl: { searchParams: new URLSearchParams({ date: DATE }) }, headers: { get: () => null } }) as never;

async function vehiclesByBooking(roomVehicles: Array<Record<string, unknown>>) {
  fakeDb(roomVehicles);
  const res = await GET(req());
  expect(res.status).toBe(200);
  const body = (await res.json()) as { bookings: Array<{ id: string; vehicles: unknown[] }> };
  return new Map(body.bookings.map((b) => [b.id, b.vehicles]));
}

beforeEach(() => {
  jest.clearAllMocks();
  requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'admin' });
});

describe('GET /api/admin/tour-ops/bookings — 배차 상태', () => {
  it('calls every booking on the tour dispatched, not just the anchor room', async () => {
    const byBooking = await vehiclesByBooking([
      { room_id: 'room-anchor', plate_number: '12가 3456', ops_vehicle_layouts: LAYOUT },
    ]);
    // The bus is attached to room-anchor alone, but the sibling rides it too.
    expect(byBooking.get('b-anchor')).toHaveLength(1);
    expect(byBooking.get('b-sibling')).toHaveLength(1);
    // …and it must not leak to a different tour on the same day.
    expect(byBooking.get('b-other')).toEqual([]);
  });

  it('reports the plate and seat count so the row can name the bus', async () => {
    const byBooking = await vehiclesByBooking([
      { room_id: 'room-anchor', plate_number: '12가 3456', ops_vehicle_layouts: LAYOUT },
    ]);
    expect(byBooking.get('b-anchor')).toEqual([
      { label: 'county_20', plate: '12가 3456', seats: 20 },
    ]);
  });

  it('does not count a vehicle with no layout — the guest picker stays shut', async () => {
    const byBooking = await vehiclesByBooking([
      { room_id: 'room-anchor', plate_number: '12가 3456', ops_vehicle_layouts: { model: 'x', total_seats: 20, layout_json: null } },
    ]);
    expect(byBooking.get('b-anchor')).toEqual([]);
    expect(byBooking.get('b-sibling')).toEqual([]);
  });

  it('reports an empty array — never undefined — when nothing is dispatched', async () => {
    const byBooking = await vehiclesByBooking([]);
    // The badge reads `(vehicles?.length ?? 0) === 0`; undefined would still
    // render 미배차, but the summary count relies on the field existing.
    for (const id of ['b-anchor', 'b-sibling', 'b-other']) {
      expect(byBooking.get(id)).toEqual([]);
    }
  });
});
