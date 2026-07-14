'use client';

/**
 * T1.12 — per-device room preferences (설정 탭, user decision 2026-07-14).
 *
 * Stored in localStorage (device-scoped, like device_key) and shared across
 * components via useSyncExternalStore so every subscriber re-renders on a
 * change from anywhere:
 *   - theme: light / dark / system (class-based Tailwind dark mode)
 *   - voiceConfirm: review & edit the STT transcript BEFORE it is sent
 *     (default ON — consumed by the Wave T2 voice flow)
 *   - autoRead: speak incoming guide notices aloud (wired in T2.5)
 *   - textScale: normal / large (senior-friendly, §E)
 */

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'tour_mode_settings';

export interface TourRoomSettings {
  theme: 'light' | 'dark' | 'system';
  voiceConfirm: boolean;
  autoRead: boolean;
  textScale: 'normal' | 'large';
}

export const DEFAULT_TOUR_ROOM_SETTINGS: TourRoomSettings = {
  theme: 'system',
  voiceConfirm: true,
  autoRead: false,
  textScale: 'normal',
};

function sanitize(raw: unknown): TourRoomSettings {
  const value = (raw ?? {}) as Partial<TourRoomSettings>;
  return {
    theme: value.theme === 'light' || value.theme === 'dark' || value.theme === 'system'
      ? value.theme
      : DEFAULT_TOUR_ROOM_SETTINGS.theme,
    voiceConfirm: typeof value.voiceConfirm === 'boolean' ? value.voiceConfirm : DEFAULT_TOUR_ROOM_SETTINGS.voiceConfirm,
    autoRead: typeof value.autoRead === 'boolean' ? value.autoRead : DEFAULT_TOUR_ROOM_SETTINGS.autoRead,
    textScale: value.textScale === 'large' || value.textScale === 'normal'
      ? value.textScale
      : DEFAULT_TOUR_ROOM_SETTINGS.textScale,
  };
}

export function readTourRoomSettings(): TourRoomSettings {
  if (typeof window === 'undefined') return DEFAULT_TOUR_ROOM_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : DEFAULT_TOUR_ROOM_SETTINGS;
  } catch {
    return DEFAULT_TOUR_ROOM_SETTINGS;
  }
}

// ---- external store (module-level, one per tab) ----------------------------

let cached: TourRoomSettings = DEFAULT_TOUR_ROOM_SETTINGS;
let cacheInitialized = false;
const listeners = new Set<() => void>();

function getSnapshot(): TourRoomSettings {
  if (!cacheInitialized) {
    cached = readTourRoomSettings();
    cacheInitialized = true;
  }
  return cached;
}

function getServerSnapshot(): TourRoomSettings {
  return DEFAULT_TOUR_ROOM_SETTINGS;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function writeTourRoomSettings(patch: Partial<TourRoomSettings>): TourRoomSettings {
  cached = sanitize({ ...getSnapshot(), ...patch });
  cacheInitialized = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    /* private mode — settings live for the tab only */
  }
  listeners.forEach((listener) => listener());
  return cached;
}

/** Test hook: reset the module cache (jest re-reads localStorage next time). */
export function __resetTourRoomSettingsForTests(): void {
  cacheInitialized = false;
  cached = DEFAULT_TOUR_ROOM_SETTINGS;
  listeners.clear();
}

export function useTourRoomSettings(): {
  settings: TourRoomSettings;
  update: (patch: Partial<TourRoomSettings>) => void;
} {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const update = useCallback((patch: Partial<TourRoomSettings>) => {
    writeTourRoomSettings(patch);
  }, []);
  return { settings, update };
}
