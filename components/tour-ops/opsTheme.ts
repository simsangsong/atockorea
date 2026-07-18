'use client';

/**
 * Ops console theme (사용자 요청 2026-07-18) — one persisted light/dark
 * switch for the WHOLE 관제센터: the OpsApp shell applies `.ops-light` on the
 * root and a globals.css override block remaps the console's dark utility
 * palette, so every tab (홈/대시보드/지도/SOS/설정) flips together; the room
 * manager reads the same key for its explicit palette. LIGHT is the default.
 */

import { useCallback, useSyncExternalStore } from 'react';

export type OpsTheme = 'light' | 'dark';

export const OPS_THEME_KEY = 'tour_ops_theme';
/** Pre-unification key (room manager shipped first) — migrated on read. */
const LEGACY_KEY = 'tour_ops_room_theme';

const listeners = new Set<() => void>();

export function getOpsTheme(): OpsTheme {
  try {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem(OPS_THEME_KEY) ?? window.localStorage.getItem(LEGACY_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function setOpsTheme(theme: OpsTheme): void {
  try {
    window.localStorage.setItem(OPS_THEME_KEY, theme);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* in-memory only */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOpsTheme(): [OpsTheme, () => void] {
  const theme = useSyncExternalStore(subscribe, getOpsTheme, () => 'light' as OpsTheme);
  const toggle = useCallback(() => setOpsTheme(getOpsTheme() === 'dark' ? 'light' : 'dark'), []);
  return [theme, toggle];
}
