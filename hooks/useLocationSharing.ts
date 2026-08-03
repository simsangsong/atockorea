'use client';

/**
 * The guest's location-sharing opt-in, owned ABOVE the tab switch.
 *
 * 🔴 It used to be `useState(false)` inside RoomMapTab, and RoomShell renders
 * tabs with `{tab === 'map' && …}` — the panel UNMOUNTS on every tab change.
 * So the switch a guest flipped on the map was silently discarded the moment
 * they opened Chat, and with it went the arrival geofence and the 1 km
 * approach preview, which ride the same sample stream. The app promises in the
 * manual that "each stop explains itself"; in practice that only held while
 * the guest sat and stared at the map tab.
 *
 * Two things move here:
 *   1. the flag lives in TourRoomLive, which stays mounted across tabs;
 *   2. the choice survives a reload, scoped to `booking:tour_date` and only
 *      restored on the tour day (`live`) — so it can never quietly switch
 *      itself back on for a later booking or a later day.
 *
 * The watcher itself is unchanged and still foreground-only (useGeoWatcher
 * pauses on `visibilitychange`), so the consent line — "only while this screen
 * is open, only with your guide and group" — stays true.
 */

import { useCallback, useState } from 'react';

const STORAGE_PREFIX = 'tour_mode_geo_share:';

export function locationSharingKey(bookingId: string, tourDate: string | null): string {
  return `${STORAGE_PREFIX}${bookingId}:${tourDate ?? 'no-date'}`;
}

function readRemembered(bookingId: string, tourDate: string | null, live: boolean): boolean {
  if (!live || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(locationSharingKey(bookingId, tourDate)) === '1';
  } catch {
    // private mode / storage disabled — the toggle simply starts off
    return false;
  }
}

export interface UseLocationSharing {
  sharing: boolean;
  setSharing: (next: boolean) => void;
}

export function useLocationSharing(options: {
  bookingId: string;
  tourDate: string | null;
  /** Only the tour day restores a remembered opt-in. */
  live: boolean;
}): UseLocationSharing {
  const { bookingId, tourDate, live } = options;
  // Lazy initializer, not an effect: TourRoomLive is client-only (it renders
  // after the join resolves), so reading storage once at mount is hydration-safe
  // and matches how this file's neighbours read their own device state. An
  // effect here would be a setState-in-effect cascade for no benefit.
  const [sharing, setSharingState] = useState(() => readRemembered(bookingId, tourDate, live));

  const setSharing = useCallback(
    (next: boolean) => {
      setSharingState(next);
      try {
        const key = locationSharingKey(bookingId, tourDate);
        if (next) window.localStorage.setItem(key, '1');
        else window.localStorage.removeItem(key);
      } catch {
        /* the flag still holds for this session */
      }
    },
    [bookingId, tourDate],
  );

  return { sharing, setSharing };
}
