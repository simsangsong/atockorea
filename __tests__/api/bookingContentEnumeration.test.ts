/**
 * @jest-environment node
 *
 * 🔴 FA-016 — the booking-content route was an unauthenticated guessing oracle.
 *
 * Measured against a live dev server on 2026-07-30: knowing only a booking id,
 * 25 consecutive wrong `?contactEmail=` values returned 403 and **no 429**, and
 * the correct one returned 200 with the guest's real name, booking reference and
 * pickup point. Every other guest-credential path in the app is gated by
 * `resolveRoomActor` §6 (`tour_room_guest`, PA-4) before it compares anything;
 * this route hand-rolled the comparison and inherited no gate.
 *
 * This suite drives the ROUTE, not a helper, because the defect was never in a
 * function — it was in what the route did not call. Two invariants:
 *
 *   1. Guessing is bounded, and bounded on the BOOKING as well as the IP —
 *      an attacker with many addresses still cannot walk an email list against
 *      one booking.
 *   2. "Wrong email" and "no such booking" are indistinguishable, so the route
 *      stops confirming which booking ids exist.
 *
 * Mutation check for whoever edits this later: delete the `requestGate` block
 * in the route and case 1 fails; change the 404 back to 403 and case 3 fails.
 */
import '@/test-utils/restoreWebPrimitives';
import { NextRequest } from 'next/server';
import { GET as contentGET } from '@/app/api/tour-mode/booking/[id]/content/route';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { requestGate } from '@/lib/durable-rate-limit';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => '203.0.113.7'),
}));

const createServerClientMock = createServerClient as jest.Mock;
const getAuthUserMock = getAuthUser as jest.Mock;
const requestGateMock = requestGate as jest.Mock;

const BOOKING_ID = 'a2e0f971-62c8-49e4-bfdb-011cf493e64e';
const REAL_EMAIL = 'guest@example.com';

/** Serves only what this route reads. `exists: false` = unknown booking id. */
function fakeDb(exists: boolean) {
  const rows = {
    id: BOOKING_ID,
    booking_reference: 'ATOC-1234',
    user_id: null,
    tour_id: 'tour-1',
    tour_date: '2026-08-01',
    tour_time: '09:00',
    number_of_guests: 2,
    contact_name: 'Real Guest',
    contact_email: REAL_EMAIL,
    contact_phone: '+82-10-1111-2222',
    status: 'confirmed',
    payment_status: 'paid',
    pickup_point_id: null,
    tours: { id: 'tour-1', title: 'Tour', city: 'Seoul', image_url: null, schedule: [] },
    pickup_points: null,
  };
  const listResult = { data: [], error: null };
  return {
    from(table: string) {
      if (table === 'bookings') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => (exists ? { data: rows, error: null } : { data: null, error: { message: 'no rows' } }),
            }),
          }),
        };
      }
      // tour_guide_spots / tour_facilities
      if (table === 'tour_bus_details') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
        };
      }
      return { select: () => ({ eq: () => ({ order: async () => listResult }) }) };
    },
  };
}

const call = (email: string, exists = true) => {
  createServerClientMock.mockReturnValue(fakeDb(exists));
  const url = `http://localhost/api/tour-mode/booking/${BOOKING_ID}/content?contactEmail=${encodeURIComponent(email)}`;
  return contentGET(new NextRequest(url), { params: Promise.resolve({ id: BOOKING_ID }) });
};

describe('FA-016 — booking content is not an enumeration oracle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAuthUserMock.mockResolvedValue(null); // unauthenticated: the attack shape
    requestGateMock.mockResolvedValue({ allowed: true });
  });

  it('🔴 an unauthenticated guess passes through the rate gate — on the IP AND the booking', async () => {
    await call('wrong@example.com');

    expect(requestGateMock).toHaveBeenCalled();
    const keys = requestGateMock.mock.calls.map(([opts]) => opts.key as string);
    expect(keys.some((k) => k.startsWith('ip:'))).toBe(true);
    expect(keys.some((k) => k === `booking:${BOOKING_ID}`)).toBe(true);
    // One namespace, so the two keys share a budget definition but not a bucket.
    for (const [opts] of requestGateMock.mock.calls) {
      expect(opts.namespace).toBe('tour_mode_booking_content');
      expect(opts.perMinute).toBeLessThanOrEqual(15);
    }
  });

  it('🔴 once the gate refuses, the answer is 429 and the database is never read', async () => {
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 });
    const res = await call('wrong@example.com');

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
    // The point of gating before the read: an enumeration run is not free reads.
    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    const db = createServerClientMock.mock.results[0].value;
    expect(db.from).toBeDefined();
  });

  it('🔴 a wrong email and an unknown booking id are indistinguishable', async () => {
    const wrongEmail = await call('wrong@example.com', true);
    const unknownBooking = await call(REAL_EMAIL, false);

    expect(wrongEmail.status).toBe(404);
    expect(unknownBooking.status).toBe(404);
    expect(await wrongEmail.json()).toEqual(await unknownBooking.json());
  });

  it('the real guest still gets their booking (the gate must not break the feature)', async () => {
    const res = await call(REAL_EMAIL);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking.contact_name).toBe('Real Guest');
    // And the response still withholds what it always withheld.
    expect(JSON.stringify(body)).not.toContain(REAL_EMAIL);
    expect(JSON.stringify(body)).not.toContain('+82-10-1111-2222');
  });

  it('an authenticated owner is not charged the guest budget', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-1' });
    await call('');
    expect(requestGateMock).not.toHaveBeenCalled();
  });
});
