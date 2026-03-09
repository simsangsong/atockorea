import { useEffect, useRef, useCallback, useState } from 'react';
import * as Location from 'expo-location';
import type { TourSpot } from '@/constants/mockTourSpots';
import { getDistanceMeters } from '@/utils/distance';

export interface UseLocationTriggerOptions {
  /** List of tour spots with coordinates and triggerRadius */
  spots: TourSpot[];
  /** Callback when user enters a spot's triggerRadius; pass the spot to auto-play */
  onEnterSpot: (spot: TourSpot) => void;
  /** Whether location-based auto-trigger is enabled (e.g. user toggles it) */
  enabled?: boolean;
  /** Minimum distance (m) the user must move before we re-check; reduces redundant triggers */
  minMovementMeters?: number;
}

/**
 * Tracks the user's location and triggers onEnterSpot when the user
 * enters the triggerRadius of any tour spot.
 *
 * Logic:
 * 1. Request location permission (foreground; for background you may need extra config).
 * 2. Subscribe to location updates (foreground or background per permission).
 * 3. On each update, compute distance from current position to each spot.
 * 4. If distance <= spot.triggerRadius and we haven't recently triggered this spot, call onEnterSpot(spot).
 * 5. Optionally throttle by minMovementMeters to avoid re-triggering while standing still.
 */
export function useLocationTrigger({
  spots,
  onEnterSpot,
  enabled = true,
  minMovementMeters = 10,
}: UseLocationTriggerOptions): {
  locationError: string | null;
  lastLocation: { lat: number; lon: number } | null;
  requestPermission: () => Promise<boolean>;
} {
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lastLocation, setLastLocation] = useState<{ lat: number; lon: number } | null>(null);
  const lastTriggeredSpotIdRef = useRef<string | null>(null);
  const lastLatRef = useRef<number | null>(null);
  const lastLonRef = useRef<number | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        return false;
      }
      setLocationError(null);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Permission request failed';
      setLocationError(msg);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || spots.length === 0) return;

    let subscription: Location.LocationSubscription | null = null;

    const startWatching = async () => {
      const granted = await requestPermission();
      if (!granted) return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: minMovementMeters,
        },
        (loc) => {
          const { latitude, longitude } = loc.coords;
          setLastLocation({ lat: latitude, lon: longitude });
          lastLatRef.current = latitude;
          lastLonRef.current = longitude;

          for (const spot of spots) {
            const distance = getDistanceMeters(
              latitude,
              longitude,
              spot.latitude,
              spot.longitude
            );
            if (distance <= spot.triggerRadius) {
              if (lastTriggeredSpotIdRef.current !== spot.id) {
                lastTriggeredSpotIdRef.current = spot.id;
                onEnterSpot(spot);
              }
              break;
            }
          }
          if (
            !spots.some(
              (s) =>
                getDistanceMeters(latitude, longitude, s.latitude, s.longitude) <= s.triggerRadius
            )
          ) {
            lastTriggeredSpotIdRef.current = null;
          }
        }
      );
    };

    startWatching();
    return () => {
      subscription?.remove();
    };
  }, [enabled, spots, onEnterSpot, minMovementMeters, requestPermission]);

  return { locationError, lastLocation, requestPermission };
}
