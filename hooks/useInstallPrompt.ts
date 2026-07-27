'use client';

/**
 * T-D2 (docs/pwa-ui-theme-design-master-plan-2026-07-27.md) — shared PWA
 * install eligibility for every "앱 설치" entry point (Settings card, drawer
 * tile, home row). InstallBanner keeps its own capture on purpose (its
 * tour-date window + once-per-booking rules are tested and live); both
 * listeners receive the same one-shot event, and whoever consumes it first
 * wins — `appinstalled` clears everyone.
 *
 * Why module-level capture: `beforeinstallprompt` fires ONCE, early. A hook
 * that only starts listening when a Settings tab mounts has already missed
 * it, so the listener binds at module import (client bundle evaluation) and
 * late subscribers read the stored event.
 *
 * Modes:
 *   'native'      — Chromium captured the event → one-tap prompt available.
 *   'ios'         — iOS Safari (no programmatic install): show the
 *                   share-sheet guide instead.
 *   'unavailable' — already standalone / in-app webview / installed this
 *                   session / desktop browser that never fired the event.
 *                   Entry points render NOTHING in this mode.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { isInAppWebview } from '@/components/tour-mode/WebviewEscapeBanner';
import { isStandaloneDisplayMode } from '@/hooks/useStandaloneDisplayMode';

export type InstallMode = 'native' | 'ios' | 'unavailable';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/** Same predicate InstallBanner ships — iOS Safari proper, not CriOS/FxiOS. */
export function isIosSafariUa(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

// ---- module store (one per tab) --------------------------------------------

let deferred: BeforeInstallPromptEvent | null = null;
let installedThisSession = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // preventDefault keeps Chrome's mini-infobar quiet; our UI drives it.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedThisSession = true;
    emit();
  });
}

function computeMode(): InstallMode {
  if (typeof window === 'undefined') return 'unavailable';
  if (installedThisSession || isStandaloneDisplayMode()) return 'unavailable';
  const ua = navigator.userAgent || '';
  // The webview escape banner owns the in-app-browser case.
  if (isInAppWebview(ua)) return 'unavailable';
  if (deferred) return 'native';
  if (isIosSafariUa(ua)) return 'ios';
  return 'unavailable';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getServerSnapshot(): InstallMode {
  return 'unavailable';
}

/**
 * Fire the captured native prompt. Resolves true on accept. The event is
 * one-shot: consumed (accepted, dismissed OR thrown), it is dropped so no
 * entry point dangles on a dead event — Chrome re-fires later if eligible.
 */
export async function promptNativeInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    deferred = null;
    emit();
    return choice.outcome === 'accepted';
  } catch {
    deferred = null;
    emit();
    return false;
  }
}

export function useInstallPrompt(): {
  mode: InstallMode;
  promptInstall: () => Promise<boolean>;
} {
  const mode = useSyncExternalStore(subscribe, computeMode, getServerSnapshot);
  const promptInstall = useCallback(() => promptNativeInstall(), []);
  return { mode, promptInstall };
}

/** Test hook: inject/clear the captured event (jsdom never fires the real one). */
export function __setInstallPromptStateForTests(next: {
  deferred?: BeforeInstallPromptEvent | null;
  installed?: boolean;
}): void {
  if ('deferred' in next) deferred = next.deferred ?? null;
  if (typeof next.installed === 'boolean') installedThisSession = next.installed;
  emit();
}
