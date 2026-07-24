'use client';

/**
 * §11.C C2 — client approach watcher: feed geo samples through the pure
 * approach stepper (nearest target, 1 km ring, exit hysteresis, no dwell,
 * once-per-POI-per-day, 120 s cooldown) and POST a preview when it fires.
 *
 * Runs alongside useSpotGeofence on the SAME sample stream — approach is the
 * teaser, the arrival geofence stays the operational trigger. The server
 * re-checks the distance against match_pois and the tour_room_events UNIQUE
 * (room, subject, type) index is the authoritative duplicate guard, so a
 * stale client can never double-post.
 */

import { useCallback, useRef } from 'react';
import {
  stepApproach,
  INITIAL_APPROACH_STATE,
  type ApproachState,
  type ApproachTarget,
} from '@/lib/tour-room/approach';
import type { GeoSample } from '@/lib/tour-room/geo';

export function useApproachWatch(options: {
  bookingId: string;
  roomSession: string;
  targets: ApproachTarget[];
  locale: string;
  enabled: boolean;
}): { onSample: (sample: GeoSample) => void } {
  const { bookingId, roomSession, targets, locale, enabled } = options;
  const stateRef = useRef<ApproachState>(INITIAL_APPROACH_STATE);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const onSample = useCallback(
    (sample: GeoSample) => {
      if (!enabled) return;
      const { state, approach } = stepApproach(stateRef.current, sample, targetsRef.current);
      stateRef.current = state;
      if (!approach) return;
      void fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/approach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({
          poi_key: approach.poiKey,
          latitude: sample.latitude,
          longitude: sample.longitude,
          locale,
        }),
      }).catch(() => undefined);
    },
    [bookingId, roomSession, locale, enabled],
  );

  return { onSample };
}
