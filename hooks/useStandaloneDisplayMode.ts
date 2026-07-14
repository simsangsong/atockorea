'use client';

/**
 * W1.4 — detects whether the page runs as an installed PWA
 * (display-mode: standalone) vs a regular browser tab.
 *
 * useSyncExternalStore keeps hydration safe: the server snapshot is always
 * false, so first paint renders the browser variant and standalone chrome
 * activates right after hydration.
 */

import { useSyncExternalStore } from 'react';

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // iOS Safari legacy signal for A2HS web apps.
  return (navigator as { standalone?: boolean }).standalone === true;
}

function subscribe(onStoreChange: () => void): () => void {
  const query = window.matchMedia?.('(display-mode: standalone)');
  if (!query) return () => {};
  query.addEventListener('change', onStoreChange);
  return () => query.removeEventListener('change', onStoreChange);
}

export function useStandaloneDisplayMode(): boolean {
  return useSyncExternalStore(subscribe, isStandaloneDisplayMode, () => false);
}
