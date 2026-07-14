'use client';

/**
 * T3.2 — foreground location watcher feeding the T3.1 relay.
 *
 * Publishing policy is entirely the pure helpers in lib/tour-room/geo:
 * accuracy > 100m discarded, moves < 10m skipped, one ping per 15s (§O-5 —
 * under the 6/min API limit with retry headroom). Foreground only by design:
 * the watcher pauses while the tab is hidden and resumes on return — there is
 * no background tracking, matching the consent copy (T3.4).
 *
 * Permission denial is a terminal state for the session (status 'denied');
 * callers show the settings-guidance copy and never re-request in a loop.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { shouldPublishPing, type GeoSample, type LatLng } from '@/lib/tour-room/geo';

export const PING_INTERVAL_MS = 15_000;

export type GeoWatcherStatus = 'idle' | 'watching' | 'denied' | 'unsupported' | 'error';

export interface UseGeoWatcher {
  status: GeoWatcherStatus;
  lastPosition: (LatLng & { accuracyM: number | null; heading: number | null; speedMps: number | null }) | null;
  /** Explicit opt-out: stops the watch and clears the server snapshot. */
  stopSharing: () => Promise<void>;
}

export function useGeoWatcher(options: {
  bookingId: string;
  roomSession: string;
  enabled: boolean;
}): UseGeoWatcher {
  const { bookingId, roomSession, enabled } = options;
  const [status, setStatus] = useState<GeoWatcherStatus>('idle');
  const [lastPosition, setLastPosition] = useState<UseGeoWatcher['lastPosition']>(null);
  const publishedRef = useRef<{ publishedAtMs: number; position: LatLng } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const endpoint = `/api/tour-rooms/${encodeURIComponent(bookingId)}/location`;

  const publish = useCallback(
    (sample: GeoSample & { heading: number | null }) => {
      if (!shouldPublishPing(publishedRef.current, sample, PING_INTERVAL_MS)) return;
      publishedRef.current = { publishedAtMs: sample.timestampMs, position: sample };
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({
          latitude: sample.latitude,
          longitude: sample.longitude,
          accuracyM: sample.accuracyM ?? undefined,
          heading: sample.heading ?? undefined,
          speedMps: sample.speedMps ?? undefined,
        }),
      }).catch(() => undefined);
    },
    [endpoint, roomSession],
  );

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatch = useCallback(() => {
    if (watchIdRef.current !== null) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported');
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setStatus('watching');
        const sample = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy ?? null,
          speedMps: position.coords.speed ?? null,
          heading: position.coords.heading ?? null,
          timestampMs: Date.now(),
        };
        setLastPosition({
          latitude: sample.latitude,
          longitude: sample.longitude,
          accuracyM: sample.accuracyM,
          heading: sample.heading,
          speedMps: sample.speedMps,
        });
        publish(sample);
      },
      (error) => {
        // PERMISSION_DENIED is terminal (T3.4: no re-request loop).
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
        stopWatch();
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
  }, [publish, stopWatch]);

  useEffect(() => {
    if (!enabled) {
      stopWatch();
      setStatus('idle');
      return;
    }
    if (status === 'denied') return; // terminal — the toggle UI guides to settings

    startWatch();

    // Foreground only: hidden tab pauses the watch, return resumes it.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stopWatch();
      else startWatch();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stopWatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, startWatch, stopWatch]);

  const stopSharing = useCallback(async () => {
    stopWatch();
    setStatus('idle');
    publishedRef.current = null;
    try {
      await fetch(endpoint, { method: 'DELETE', headers: { 'x-tour-room-auth': roomSession } });
    } catch {
      /* the sharing flag also times out server-side via last_seen */
    }
  }, [endpoint, roomSession, stopWatch]);

  return { status, lastPosition, stopSharing };
}
