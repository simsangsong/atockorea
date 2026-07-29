/**
 * X18 STEP 0 — why the travel matrix was empty, settled by measurement.
 *
 * `poi_travel_matrix` had 0 rows, ever, and `manual_arrival` had 0 events,
 * ever. Two readings were possible and they lead to opposite tickets:
 *
 *   (a) the write path is broken  → X18 is a bug, fix it before any UI
 *   (b) nobody has tapped [도착]   → X18 is a read UI over data that will come
 *
 * Proved (a) is false: one POST to `/manual-arrival` against a seeded room
 * produced exactly one `tour_room_events` row, type `manual_arrival`,
 * `actor_role: 'guide'`. The probe row was deleted afterwards.
 *
 * 🔴 But the probe also showed `poi_key: null`, and that turns out to be the
 * whole story. The flywheel builds a leg from two consecutive arrivals and
 * drops any pair where either side has no key:
 *
 *     if (!from || !to || from === to) continue;
 *
 * Until tonight, the cockpit's day carried NO keyed stops at all — measured
 * 0 of 130, because six callers of `resolveDaySchedule` omitted `tourId` and
 * the resolver fell through to a schedule with no `poi_key`. So a guide
 * tapping [도착] could only ever log an arrival with no place attached, and
 * the flywheel could never learn from it. Not a broken writer; a writer with
 * nothing to write down.
 *
 * That makes the tourId sweep the actual unblocker for X18, and it means the
 * matrix can only start filling from now. A read UI shipped today would still
 * be a UI over an empty table — but for a reason that has an end date.
 *
 * This test holds the two invariants that must not drift apart: the flywheel
 * requires a key, and the arrival writer must be able to supply one.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const flywheel = readFileSync(
  path.join(process.cwd(), 'app/api/cron/tour-room-flywheel/route.ts'),
  'utf8',
);
const arrival = readFileSync(
  path.join(process.cwd(), 'app/api/tour-rooms/[bookingId]/manual-arrival/route.ts'),
  'utf8',
);

describe('the travel-matrix flywheel', () => {
  it('🔴 learns only from arrivals that carry a place', () => {
    // Stated as a test so the next person reading "the matrix is empty" does
    // not go looking for a broken insert.
    expect(flywheel).toMatch(/if \(!from \|\| !to \|\| from === to\) continue;/);
  });

  it('reads the key out of the arrival payload', () => {
    expect(flywheel).toContain('payload?.poi_key');
  });
});

describe('the arrival writer', () => {
  it('records an event at all — proved live, asserted here', () => {
    expect(arrival).toContain("type: 'manual_arrival'");
    expect(arrival).toContain('recordRoomEvent(');
  });

  it('puts the key in the payload the flywheel reads', () => {
    // The two sides agree on the field name. They live in different files and
    // nothing else connects them.
    expect(arrival).toMatch(/payload: \{[^}]*poi_key:/);
  });

  it('⚠ still swallows a failed event write', () => {
    // Deliberately asserted rather than fixed here, because it is a real
    // trade-off and not obviously wrong: the guest's arrival card must not fail
    // because a metrics row did not save. But it does mean a broken event
    // write would look exactly like "nobody tapped the button", which is the
    // ambiguity that cost this investigation. Recorded so the next person
    // knows the silence is by design.
    expect(arrival).toMatch(/recordRoomEvent\([\s\S]{0,400}?\)\.catch\(/);
  });
});
