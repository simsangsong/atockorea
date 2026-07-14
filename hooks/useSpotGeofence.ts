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
}): { onSample: (sample: GeoSample) => void } {
  const { bookingId, roomSession, spots, locale, enabled } = options;
  const stateRef = useRef<SpotWatchState>(INITIAL_SPOT_WATCH_STATE);
  const spotsRef = useRef(spots);
  spotsRef.current = spots;

  const onSample = useCallback(
    (sample: GeoSample) => {
      if (!enabled) return;
      const { state, arrival } = stepSpotWatch(stateRef.current, sample, spotsRef.current);
      stateRef.current = state;
      if (!arrival) return;
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
