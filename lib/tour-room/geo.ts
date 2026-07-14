/**
 * Pure geo helpers for Tour Mode (master plan §D, tickets T0.6/T3.2/T4.4).
 *
 * Everything here is a pure function shared by the client geofence watcher and
 * the server-side radius re-check — no browser or DB APIs, so the boundary
 * behaviour (radius ±1m, accuracy limit, hysteresis, dwell) is unit-testable.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface GeoSample extends LatLng {
  /** GPS accuracy radius in meters, when known. */
  accuracyM?: number | null;
  /** Speed in m/s, when known. */
  speedMps?: number | null;
  /** Sample timestamp (ms epoch). */
  timestampMs: number;
}

/** Samples less accurate than this are discarded outright (D-4, R-9). */
export const MAX_ACCURACY_M = 100;
/** Movements smaller than this don't produce a new ping (R-14). */
export const MIN_MOVEMENT_M = 10;
/** A spot arrival needs this much continuous presence inside the radius (R-10). */
export const MIN_DWELL_MS = 60_000;
/** Above this speed the device is riding the bus — hold arrival judgement (R-10). */
export const MAX_ARRIVAL_SPEED_MPS = 6;
/** Default exit radius multiplier when tour_guide_spots.exit_radius_m is NULL (§C M-4). */
export const DEFAULT_EXIT_RADIUS_FACTOR = 1.5;

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in meters (haversine). */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when the sample is precise enough to act on. */
export function isAccurateEnough(sample: Pick<GeoSample, 'accuracyM'>, maxAccuracyM = MAX_ACCURACY_M): boolean {
  const accuracy = sample.accuracyM;
  if (accuracy === null || accuracy === undefined) return true; // unknown accuracy: keep (server re-checks radius)
  return accuracy <= maxAccuracyM;
}

/** True when the device moved far enough since the last published position to bother re-publishing. */
export function movedEnough(prev: LatLng | null, next: LatLng, minMovementM = MIN_MOVEMENT_M): boolean {
  if (!prev) return true;
  return haversineM(prev, next) >= minMovementM;
}

/** Effective exit radius for a spot (hysteresis outer bound). */
export function exitRadiusM(spot: { trigger_radius_m: number; exit_radius_m?: number | null }): number {
  if (typeof spot.exit_radius_m === 'number' && spot.exit_radius_m > 0) return spot.exit_radius_m;
  return Math.round(spot.trigger_radius_m * DEFAULT_EXIT_RADIUS_FACTOR);
}

export type GeofenceZone = 'inside' | 'buffer' | 'outside';

/**
 * Classify a position against a spot's enter/exit radii.
 * 'buffer' is the hysteresis band: past the trigger radius but not yet past
 * the exit radius — an entered state is held, a not-entered state stays out.
 */
export function classifyZone(
  distanceM: number,
  spot: { trigger_radius_m: number; exit_radius_m?: number | null },
): GeofenceZone {
  if (distanceM <= spot.trigger_radius_m) return 'inside';
  if (distanceM <= exitRadiusM(spot)) return 'buffer';
  return 'outside';
}

export interface GeofenceState {
  /** Whether the device currently counts as inside the spot (post-hysteresis). */
  entered: boolean;
  /** When the device first crossed into the trigger radius this visit (ms), or null. */
  enteredAtMs: number | null;
  /** Whether an arrival has been emitted for this visit (client-side guard; server UNIQUE is authoritative). */
  arrivalEmitted: boolean;
}

export const INITIAL_GEOFENCE_STATE: GeofenceState = {
  entered: false,
  enteredAtMs: null,
  arrivalEmitted: false,
};

export interface GeofenceStep {
  state: GeofenceState;
  /** True exactly when this sample satisfies dwell+speed and should POST an arrived event. */
  shouldEmitArrival: boolean;
}

/**
 * Advance the per-spot geofence state machine with one filtered sample.
 *
 * Rules (R-9, R-10):
 *  - inaccurate samples (accuracy > max) are ignored — state unchanged;
 *  - entering requires distance <= trigger radius;
 *  - once entered, the state holds through the buffer band and resets only
 *    past the exit radius (hysteresis);
 *  - arrival fires after MIN_DWELL_MS continuous presence, and only while
 *    moving slower than MAX_ARRIVAL_SPEED_MPS (bus pass-by guard);
 *  - arrival fires at most once per visit.
 */
export function stepGeofence(
  state: GeofenceState,
  sample: GeoSample,
  spot: LatLng & { trigger_radius_m: number; exit_radius_m?: number | null },
  options?: { minDwellMs?: number; maxArrivalSpeedMps?: number; maxAccuracyM?: number },
): GeofenceStep {
  const minDwellMs = options?.minDwellMs ?? MIN_DWELL_MS;
  const maxArrivalSpeedMps = options?.maxArrivalSpeedMps ?? MAX_ARRIVAL_SPEED_MPS;

  if (!isAccurateEnough(sample, options?.maxAccuracyM)) {
    return { state, shouldEmitArrival: false };
  }

  const distanceM = haversineM(sample, spot);
  const zone = classifyZone(distanceM, spot);

  let next: GeofenceState;
  if (zone === 'inside') {
    next = state.entered
      ? state
      : { entered: true, enteredAtMs: sample.timestampMs, arrivalEmitted: false };
  } else if (zone === 'buffer') {
    next = state; // hysteresis: hold whatever we were
  } else {
    next = INITIAL_GEOFENCE_STATE; // full exit resets the visit
  }

  const dwellSatisfied =
    next.entered && next.enteredAtMs !== null && sample.timestampMs - next.enteredAtMs >= minDwellMs;
  const slowEnough =
    sample.speedMps === null || sample.speedMps === undefined || sample.speedMps <= maxArrivalSpeedMps;
  const shouldEmitArrival = dwellSatisfied && slowEnough && !next.arrivalEmitted;

  return {
    state: shouldEmitArrival ? { ...next, arrivalEmitted: true } : next,
    shouldEmitArrival,
  };
}

/**
 * Throttle helper for location pings: publish when the interval elapsed AND
 * the device moved enough (or has never published).
 */
export function shouldPublishPing(
  last: { publishedAtMs: number; position: LatLng } | null,
  sample: GeoSample,
  intervalMs: number,
): boolean {
  if (!isAccurateEnough(sample)) return false;
  if (!last) return true;
  if (sample.timestampMs - last.publishedAtMs < intervalMs) return false;
  return movedEnough(last.position, sample);
}
