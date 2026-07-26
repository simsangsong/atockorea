'use client';

/**
 * U4-D11 — one theme answer for every tour-mode surface.
 *
 * The join/check-in/companion landings used to read prefers-color-scheme
 * directly, so a guest who pinned Light in the room's header still got a
 * dark landing on a dark-OS phone (and vice versa). This resolves the SAME
 * `tour_mode_settings` store the room shell and cockpit use: an explicit
 * choice wins, 'system' falls back to the OS.
 *
 * SSR-deterministic: both inputs start from their defaults ('system' + not
 * dark) and settle in an effect, so the first client paint always matches
 * the server markup (the iOS hydration-sweep invariant).
 */

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useTourRoomSettings } from '@/hooks/useTourRoomSettings';

export function useResolvedTourTheme(): 'light' | 'dark' {
  const { settings } = useTourRoomSettings();
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  return settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme;
}
