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
/** X18: the leg logic moved out of the cron so it could be unit-tested. */
const matrix = readFileSync(path.join(process.cwd(), 'lib/tour-room/travelMatrix.ts'), 'utf8');

describe('the travel-matrix flywheel', () => {
  it('🔴 learns only from arrivals that carry a place', () => {
    // Stated as a test so the next person reading "the matrix is empty" does
    // not go looking for a broken insert. The rule moved into `travelMatrix`
    // with X18 (the cron delegates now) — the invariant did not move.
    expect(matrix).toContain('if (from === to) continue;');
    // Keyless points never reach the leg builder at all.
    expect(matrix).toContain('if (!point.roomId || !point.poiKey || !point.at) continue;');
  });

  it('reads the key out of the arrival payload', () => {
    expect(flywheel).toContain('payload?.poi_key');
  });

  /**
   * 🔴 X18 — the second source. There are two ways this app records an arrival
   * and they land in different tables:
   *
   *   guide taps 도착  → tour_room_events      type='manual_arrival'
   *   geofence trips   → tour_room_spot_events event_type='arrived'
   *
   * The learner read only the first. X15 put the geofence on the STAFF device,
   * which makes it the path most arrivals will now come from, so reading one
   * table would have kept the matrix empty for a new reason.
   */
  it('reads BOTH arrival sources, not just the manual tap', () => {
    expect(flywheel).toContain("'tour_room_events'");
    expect(flywheel).toContain("'tour_room_spot_events'");
    expect(flywheel).toContain("event_type', 'arrived'");
    // The geofence table has no poi_key of its own — it must join the spot.
    expect(flywheel).toContain('tour_guide_spots(poi_key)');
  });

  /**
   * "0 legs" used to be unreadable: broken learner, or nobody arrived? The
   * response now says which, split by path.
   */
  it('reports how many arrivals it saw, so zero legs can be diagnosed', () => {
    expect(flywheel).toContain('arrivals: arrivalCounts');
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
