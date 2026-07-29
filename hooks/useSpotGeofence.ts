'use client';

/**
 * T4.4 — client geofence: feed geo samples through the pure spot-watch
 * stepper (nearest-spot + hysteresis + 60s dwell + 120s cooldown, §O-8) and
 * POST an 'arrived' spot event when it fires. The server re-checks the
 * radius and the UNIQUE(booking, spot, event) constraint is the authoritative
 * duplicate guard — a stale client can never double-post.
 */

import { useCallback, useRef } from 'react';
import {
  stepSpotWatch,
  INITIAL_SPOT_WATCH_STATE,
  type SpotWatchState,
  type WatchableSpot,
} from '@/lib/tour-room/spotWatcher';
import type { GeoSample } from '@/lib/tour-room/geo';

export function useSpotGeofence(options: {
  bookingId: string;
  roomSession: string;
  spots: WatchableSpot[];
  locale: string;
  enabled: boolean;
  /**
   * X15 — fired locally when the geofence trips, in addition to the POST.
   *
   * The guest side has no use for this (the arrival card arrives over the
   * realtime channel like everything else), but the STAFF device is the one
   * that has to act: it needs to offer the driver the arrival sheet for the
   * stop they just parked at. Optional, so the guest call site is unchanged.
   */
  onArrival?: (arrival: { spotId: string; distanceM: number }) => void;
}): { onSample: (sample: GeoSample) => void } {
  const { bookingId, roomSession, spots, locale, enabled, onArrival } = options;
  const stateRef = useRef<SpotWatchState>(INITIAL_SPOT_WATCH_STATE);
  const spotsRef = useRef(spots);
  spotsRef.current = spots;
  // Kept in a ref so a changing callback identity cannot reset the geofence
  // state machine mid-approach.
  const onArrivalRef = useRef(onArrival);
  onArrivalRef.current = onArrival;

  const onSample = useCallback(
    (sample: GeoSample) => {
      if (!enabled) return;
      const { state, arrival } = stepSpotWatch(stateRef.current, sample, spotsRef.current);
      stateRef.current = state;
      if (!arrival) return;
      // Local first: the prompt must appear even if the POST is refused or the
      // device is offline. The two are independent by design — a driver
      // standing at the stop should not be told "no arrival" because a request
      // failed.
      onArrivalRef.current?.(arrival);
      void fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/spot-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({
          eventType: 'arrived',
          spotId: arrival.spotId,
          distanceM: Math.round(arrival.distanceM),
          currentLatitude: sample.latitude,
          currentLongitude: sample.longitude,
          locale,
        }),
      }).catch(() => undefined);
    },
    [bookingId, roomSession, locale, enabled],
  );

  return { onSample };
}
