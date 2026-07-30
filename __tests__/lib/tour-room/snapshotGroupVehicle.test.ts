/**
 * @jest-environment node
 *
 * 🔴 FA-027 (full-app audit 2026-07-30) — the vehicle line went blank for every
 * guest but one.
 *
 * A join tour is one room PER BOOKING. Ops attaches the dispatch to whichever
 * room they happened to have open, so `ops_room_vehicles` carries a row for one
 * arbitrary anchor room and none for its siblings. The snapshot read it with
 * `.eq('room_id', room.id)`, so a non-anchor guest — most of the bus — was told
 * the tour has no vehicle: no plate, no driver name, no vehicle line on the
 * home tab.
 *
 * Live proof at audit time: tour f08b1603 on 2026-07-27 ran 2 rooms, 1 of which
 * carried the dispatch.
 *
 * `lib/ops/seating/service.ts` had already fixed the same bug for the seat
 * board (`groupRoomIds`); the snapshot was simply never brought along. This
 * suite pins the room set the snapshot asks for, because that IS the defect —
 * the query, not the mapping.
 *
 * Mutation check: change the `.in('room_id', …)` back to `.eq('room_id', …)`
 * and the first case fails.
 */
import { buildRoomSnapshot } from '@/lib/tour-room/snapshot';
import type { RoomBooking, RoomDbClient, TourRoom } from '@/lib/tour-room/access';

const TOUR_ID = 'tour-join-1';
const TOUR_DATE = '2026-07-27';
const ANCHOR_ROOM = 'room-anchor';
const MY_ROOM = 'room-mine';

const BOOKING = {
  id: 'booking-mine',
  user_id: null,
  tour_id: TOUR_ID,
  merchant_id: null,
  tour_date: TOUR_DATE,
  contact_name: 'Second Guest',
  contact_email: 'second@example.com',
  contact_phone: null,
  preferred_language: 'ko',
  source: 'tour_product',
} as unknown as RoomBooking;

const ROOM = { id: MY_ROOM, booking_id: BOOKING.id, tour_id: TOUR_ID, tour_date: TOUR_DATE } as unknown as TourRoom;

/** The dispatch row exists, but only against the anchor room. */
const DISPATCH = {
  plate_number: '제주 79바 1234',
  driver_name: '김기사',
  vehicle_layouts: { model: 'bus_45', display_name: '45인승' },
};

interface Recorded {
  vehicleRoomFilter: { op: 'in' | 'eq'; rooms: string[] } | null;
  siblingLookup: boolean;
}

function fakeDb(recorded: Recorded, siblings: string[]): RoomDbClient {
  const empty = { data: [], error: null };
  const chain = (result: unknown): Record<string, unknown> => {
    const self: Record<string, unknown> = {};
    for (const key of ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lte', 'not', 'is']) {
      self[key] = () => self;
    }
    self.maybeSingle = async () => result;
    self.single = async () => result;
    self.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
    return self;
  };

  return {
    from(table: string) {
      if (table === 'tour_rooms') {
        recorded.siblingLookup = true;
        return chain({ data: siblings.map((id) => ({ id })), error: null });
      }
      if (table === 'ops_room_vehicles') {
        const self: Record<string, unknown> = {};
        self.select = () => self;
        self.order = () => self;
        self.limit = () => self;
        self.eq = (_col: string, value: string) => {
          recorded.vehicleRoomFilter = { op: 'eq', rooms: [value] };
          return self;
        };
        self.in = (_col: string, values: string[]) => {
          recorded.vehicleRoomFilter = { op: 'in', rooms: values };
          return self;
        };
        self.maybeSingle = async () => {
          const rooms = recorded.vehicleRoomFilter?.rooms ?? [];
          // The dispatch only exists for the anchor room.
          return rooms.includes(ANCHOR_ROOM) ? { data: DISPATCH, error: null } : { data: null, error: null };
        };
        return self;
      }
      if (table === 'bookings') {
        return chain({
          data: {
            id: BOOKING.id,
            booking_reference: 'ATOC-2',
            tour_date: TOUR_DATE,
            tour_time: '09:00',
            number_of_guests: 2,
            contact_name: 'Second Guest',
            itinerary: null,
            ota_raw_meta: null,
            tours: { id: TOUR_ID, slug: 't', title: 'Join tour', city: 'Jeju', image_url: null, schedule: [], price_type: 'per_person' },
            pickup_points: null,
          },
          error: null,
        });
      }
      return chain(empty);
    },
  } as unknown as RoomDbClient;
}

describe('FA-027 — the snapshot asks the whole tour day for its vehicle', () => {
  it('🔴 queries every sibling room, not just this one', async () => {
    const recorded: Recorded = { vehicleRoomFilter: null, siblingLookup: false };
    await buildRoomSnapshot(fakeDb(recorded, [ANCHOR_ROOM, MY_ROOM]), BOOKING, ROOM, 'ko');

    expect(recorded.siblingLookup).toBe(true);
    expect(recorded.vehicleRoomFilter?.op).toBe('in');
    expect(recorded.vehicleRoomFilter?.rooms).toEqual(expect.arrayContaining([ANCHOR_ROOM, MY_ROOM]));
  });

  it('🔴 a non-anchor guest now sees the plate the anchor guest always saw', async () => {
    const recorded: Recorded = { vehicleRoomFilter: null, siblingLookup: false };
    const snapshot = await buildRoomSnapshot(fakeDb(recorded, [ANCHOR_ROOM, MY_ROOM]), BOOKING, ROOM, 'ko');

    // Whatever shape the snapshot carries it in, the plate has to be in there.
    expect(JSON.stringify(snapshot)).toContain('제주 79바 1234');
  });

  it('falls back to this room alone when the day cannot be identified', async () => {
    const recorded: Recorded = { vehicleRoomFilter: null, siblingLookup: false };
    const noDate = { ...BOOKING, tour_date: null } as unknown as RoomBooking;
    await buildRoomSnapshot(fakeDb(recorded, []), noDate, ROOM, 'ko');

    expect(recorded.siblingLookup).toBe(false);
    expect(recorded.vehicleRoomFilter?.rooms).toEqual([MY_ROOM]);
  });

  it('a failed sibling lookup degrades to this room instead of throwing', async () => {
    const recorded: Recorded = { vehicleRoomFilter: null, siblingLookup: false };
    const broken = {
      from(table: string) {
        if (table === 'tour_rooms') {
          recorded.siblingLookup = true;
          const self: Record<string, unknown> = {};
          self.select = () => self;
          self.eq = () => self;
          self.then = (res: (v: unknown) => unknown) =>
            Promise.resolve({ data: null, error: { message: 'boom' } }).then(res);
          return self;
        }
        return fakeDb(recorded, []).from(table);
      },
    } as unknown as RoomDbClient;

    await expect(buildRoomSnapshot(broken, BOOKING, ROOM, 'ko')).resolves.toBeDefined();
    expect(recorded.vehicleRoomFilter?.rooms).toEqual([MY_ROOM]);
  });
});
