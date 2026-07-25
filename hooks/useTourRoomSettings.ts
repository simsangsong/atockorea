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

/**
 * P1-6 — text size is 5 steps (1 = smallest … 5 = largest), 3 being the
 * default. It used to be a 2-value 'normal' | 'large' that only swapped two
 * chat-bubble classes; the step now drives --tr-font-scale on .tr-root, so the
 * whole surface moves together.
 */
export type TextScaleStep = 1 | 2 | 3 | 4 | 5;

export const TEXT_SCALE_STEPS: TextScaleStep[] = [1, 2, 3, 4, 5];
export const DEFAULT_TEXT_SCALE: TextScaleStep = 3;

/** Multiplier per step, applied to every .tr-* size (tour-room-theme.css). */
export const TEXT_SCALE_FACTORS: Record<TextScaleStep, number> = {
  1: 0.85,
  2: 0.925,
  3: 1,
  4: 1.15,
  5: 1.35,
};

export function textScaleFactor(step: TextScaleStep): number {
  return TEXT_SCALE_FACTORS[step] ?? 1;
}

export interface TourRoomSettings {
  theme: 'light' | 'dark' | 'system';
  voiceConfirm: boolean;
  autoRead: boolean;
  textScale: TextScaleStep;
}

export const DEFAULT_TOUR_ROOM_SETTINGS: TourRoomSettings = {
  theme: 'system',
  voiceConfirm: true,
  autoRead: false,
  textScale: DEFAULT_TEXT_SCALE,
};

/**
 * Accept the new 1–5 step and migrate the two legacy values in place, so a
 * guest who had already chosen "크게" keeps a large size instead of being
 * silently reset to the default.
 */
function normalizeTextScale(raw: unknown): TextScaleStep {
  if (raw === 'large') return 4;
  if (raw === 'normal') return DEFAULT_TEXT_SCALE;
  const step = typeof raw === 'number' ? Math.round(raw) : Number.NaN;
  return (TEXT_SCALE_STEPS as number[]).includes(step) ? (step as TextScaleStep) : DEFAULT_TEXT_SCALE;
}

function sanitize(raw: unknown): TourRoomSettings {
  const value = (raw ?? {}) as Partial<TourRoomSettings>;
  return {
    theme: value.theme === 'light' || value.theme === 'dark' || value.theme === 'system'
      ? value.theme
      : DEFAULT_TOUR_ROOM_SETTINGS.theme,
    voiceConfirm: typeof value.voiceConfirm === 'boolean' ? value.voiceConfirm : DEFAULT_TOUR_ROOM_SETTINGS.voiceConfirm,
    autoRead: typeof value.autoRead === 'boolean' ? value.autoRead : DEFAULT_TOUR_ROOM_SETTINGS.autoRead,
    textScale: normalizeTextScale(value.textScale),
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
