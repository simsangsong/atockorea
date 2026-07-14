/**
 * T0.6 — geo pure-function boundary tests (radius ±1m, accuracy 100m,
 * hysteresis, dwell, bus-speed hold).
 */
import {
  classifyZone,
  exitRadiusM,
  haversineM,
  INITIAL_GEOFENCE_STATE,
  isAccurateEnough,
  movedEnough,
  shouldPublishPing,
  stepGeofence,
  type GeoSample,
} from '@/lib/tour-room/geo';

// Haeundae-ish anchor. At this latitude 1° lat ≈ 111,194m.
const SPOT = { latitude: 35.1587, longitude: 129.1604, trigger_radius_m: 80 };
const M_PER_DEG_LAT = 111_194;

function pointAtMeters(north: number): { latitude: number; longitude: number } {
  return { latitude: SPOT.latitude + north / M_PER_DEG_LAT, longitude: SPOT.longitude };
}

function sample(north: number, at: number, extra?: Partial<GeoSample>): GeoSample {
  return { ...pointAtMeters(north), timestampMs: at, accuracyM: 10, ...extra };
}

describe('lib/tour-room/geo', () => {
  describe('haversineM', () => {
    it('is ~0 for identical points and symmetric', () => {
      expect(haversineM(SPOT, SPOT)).toBeCloseTo(0, 6);
      const p = pointAtMeters(500);
      expect(haversineM(SPOT, p)).toBeCloseTo(haversineM(p, SPOT), 6);
    });

    it('measures a known 1000m displacement within 1m', () => {
      expect(haversineM(SPOT, pointAtMeters(1000))).toBeGreaterThan(999);
      expect(haversineM(SPOT, pointAtMeters(1000))).toBeLessThan(1001);
    });
  });

  describe('accuracy filter (100m boundary)', () => {
    it.each([
      [99, true],
      [100, true],
      [101, false],
    ])('accuracy %im → keep=%s', (accuracyM, expected) => {
      expect(isAccurateEnough({ accuracyM })).toBe(expected);
    });

    it('keeps samples with unknown accuracy', () => {
      expect(isAccurateEnough({ accuracyM: null })).toBe(true);
      expect(isAccurateEnough({})).toBe(true);
    });
  });

  describe('movement filter', () => {
    it('always publishes the first position', () => {
      expect(movedEnough(null, SPOT)).toBe(true);
    });
    it('skips sub-10m drift and passes ≥10m moves', () => {
      expect(movedEnough(SPOT, pointAtMeters(9))).toBe(false);
      expect(movedEnough(SPOT, pointAtMeters(11))).toBe(true);
    });
  });

  describe('zone classification (radius ±1m boundaries)', () => {
    it.each([
      [79, 'inside'],
      [80, 'inside'],
      [81, 'buffer'],
      [120, 'buffer'], // default exit = 80 * 1.5 = 120
      [121, 'outside'],
    ] as const)('distance %im → %s', (d, zone) => {
      expect(classifyZone(d, SPOT)).toBe(zone);
    });

    it('honours an explicit exit_radius_m over the 1.5x default', () => {
      const spot = { ...SPOT, exit_radius_m: 200 };
      expect(exitRadiusM(spot)).toBe(200);
      expect(classifyZone(150, spot)).toBe('buffer');
      expect(classifyZone(201, spot)).toBe('outside');
      expect(exitRadiusM(SPOT)).toBe(120);
    });
  });

  describe('stepGeofence — dwell, hysteresis, single-shot arrival', () => {
    it('emits arrival only after 60s continuous dwell, once per visit', () => {
      let state = INITIAL_GEOFENCE_STATE;

      let step = stepGeofence(state, sample(0, 0), SPOT);
      state = step.state;
      expect(step.shouldEmitArrival).toBe(false); // just entered — no dwell yet

      step = stepGeofence(state, sample(10, 59_000), SPOT);
      state = step.state;
      expect(step.shouldEmitArrival).toBe(false); // 59s < 60s

      step = stepGeofence(state, sample(10, 60_000), SPOT);
      state = step.state;
      expect(step.shouldEmitArrival).toBe(true); // dwell satisfied

      step = stepGeofence(state, sample(5, 90_000), SPOT);
      expect(step.shouldEmitArrival).toBe(false); // already emitted this visit
    });

    it('holds entered state in the buffer band (GPS jitter does not reset dwell)', () => {
      let state = INITIAL_GEOFENCE_STATE;
      // jitter sequence: in (t0) → 100m buffer (t20s) → in (t40s) → in (t61s)
      state = stepGeofence(state, sample(0, 0), SPOT).state;
      const jitter = stepGeofence(state, sample(100, 20_000), SPOT);
      state = jitter.state;
      expect(state.entered).toBe(true); // held through buffer
      state = stepGeofence(state, sample(20, 40_000), SPOT).state;
      const arrive = stepGeofence(state, sample(20, 61_000), SPOT);
      expect(arrive.shouldEmitArrival).toBe(true); // dwell counted from t0
    });

    it('resets the visit after a full exit, allowing a fresh arrival later', () => {
      let state = INITIAL_GEOFENCE_STATE;
      state = stepGeofence(state, sample(0, 0), SPOT).state;
      state = stepGeofence(state, sample(0, 61_000), SPOT).state; // arrival 1 emitted
      state = stepGeofence(state, sample(500, 120_000), SPOT).state; // full exit
      expect(state.entered).toBe(false);
      state = stepGeofence(state, sample(0, 200_000), SPOT).state; // re-enter
      const again = stepGeofence(state, sample(0, 261_000), SPOT);
      expect(again.shouldEmitArrival).toBe(true);
    });

    it('ignores inaccurate samples entirely', () => {
      let state = INITIAL_GEOFENCE_STATE;
      state = stepGeofence(state, sample(0, 0), SPOT).state;
      // A wild 500m-out sample with 300m accuracy must not reset the visit.
      const step = stepGeofence(state, sample(500, 30_000, { accuracyM: 300 }), SPOT);
      expect(step.state.entered).toBe(true);
    });

    it('holds arrival while moving at bus speed, then fires once slowed down', () => {
      let state = INITIAL_GEOFENCE_STATE;
      state = stepGeofence(state, sample(0, 0, { speedMps: 10 }), SPOT).state;
      const fast = stepGeofence(state, sample(10, 61_000, { speedMps: 10 }), SPOT);
      state = fast.state;
      expect(fast.shouldEmitArrival).toBe(false); // 10 m/s > 6 m/s: pass-by guard
      const slow = stepGeofence(state, sample(10, 70_000, { speedMps: 1 }), SPOT);
      expect(slow.shouldEmitArrival).toBe(true);
    });
  });

  describe('shouldPublishPing', () => {
    const last = { publishedAtMs: 0, position: SPOT };
    it('respects the interval, movement, and accuracy gates', () => {
      expect(shouldPublishPing(null, sample(0, 0), 15_000)).toBe(true);
      expect(shouldPublishPing(last, sample(50, 10_000), 15_000)).toBe(false); // too soon
      expect(shouldPublishPing(last, sample(5, 20_000), 15_000)).toBe(false); // barely moved
      expect(shouldPublishPing(last, sample(50, 20_000), 15_000)).toBe(true);
      expect(shouldPublishPing(last, sample(50, 20_000, { accuracyM: 500 }), 15_000)).toBe(false);
    });
  });
});
