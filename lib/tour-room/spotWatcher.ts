/**
 * T4.4 + §O-8 — multi-spot geofence stepping (pure).
 *
 * Wraps the per-spot state machine (lib/tour-room/geo stepGeofence — enter
 * radius, exit hysteresis, 60s dwell, bus-speed guard) with the room-level
 * rules:
 *   - overlapping radii: only the NEAREST spot is evaluated per sample;
 *   - spots the device has fully exited reset their visit state;
 *   - a 120s cooldown separates consecutive arrivals (any spot).
 */

import {
  exitRadiusM,
  haversineM,
  stepGeofence,
  INITIAL_GEOFENCE_STATE,
  type GeoSample,
  type GeofenceState,
} from '@/lib/tour-room/geo';

export const ARRIVAL_COOLDOWN_MS = 120_000;

export interface WatchableSpot {
  id: string;
  latitude: number;
  longitude: number;
  trigger_radius_m: number;
  exit_radius_m?: number | null;
}

export interface SpotWatchState {
  spotStates: Record<string, GeofenceState>;
  lastArrivalAtMs: number | null;
}

export const INITIAL_SPOT_WATCH_STATE: SpotWatchState = {
  spotStates: {},
  lastArrivalAtMs: null,
};

export interface SpotWatchStep {
  state: SpotWatchState;
  /** Set exactly when this sample should POST an 'arrived' event. */
  arrival: { spotId: string; distanceM: number } | null;
}

export function stepSpotWatch(
  state: SpotWatchState,
  sample: GeoSample,
  spots: WatchableSpot[],
  options?: { cooldownMs?: number; minDwellMs?: number; maxAccuracyM?: number },
): SpotWatchStep {
  if (spots.length === 0) return { state, arrival: null };
  const cooldownMs = options?.cooldownMs ?? ARRIVAL_COOLDOWN_MS;

  // Nearest spot wins the evaluation (§O-8 overlapping radii rule).
  let nearest: WatchableSpot | null = null;
  let nearestDistance = Infinity;
  for (const spot of spots) {
    const distance = haversineM(sample, spot);
    if (distance < nearestDistance) {
      nearest = spot;
      nearestDistance = distance;
    }
  }
  if (!nearest) return { state, arrival: null };

  const nextStates: Record<string, GeofenceState> = { ...state.spotStates };

  // Fully-exited non-nearest spots reset their visit.
  for (const spot of spots) {
    if (spot.id === nearest.id) continue;
    const existing = nextStates[spot.id];
    if (existing?.entered && haversineM(sample, spot) > exitRadiusM(spot)) {
      nextStates[spot.id] = INITIAL_GEOFENCE_STATE;
    }
  }

  const step = stepGeofence(nextStates[nearest.id] ?? INITIAL_GEOFENCE_STATE, sample, nearest, options);
  nextStates[nearest.id] = step.state;

  const coolingDown =
    state.lastArrivalAtMs !== null && sample.timestampMs - state.lastArrivalAtMs < cooldownMs;
  const arrival = step.shouldEmitArrival && !coolingDown ? { spotId: nearest.id, distanceM: nearestDistance } : null;

  // A cooldown-suppressed arrival must fire on a later sample — undo the
  // per-visit emitted flag the inner machine just set.
  if (step.shouldEmitArrival && coolingDown) {
    nextStates[nearest.id] = { ...step.state, arrivalEmitted: false };
  }

  return {
    state: {
      spotStates: nextStates,
      lastArrivalAtMs: arrival ? sample.timestampMs : state.lastArrivalAtMs,
    },
    arrival,
  };
}
