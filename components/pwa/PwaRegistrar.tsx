'use client';

/**
 * W1.2 — registers a scope-specific service worker so the surface becomes
 * installable. Shared by the tour-mode and tour-ops shells; each passes its
 * own sw file + scope so the two PWAs stay independent (§3-A).
 *
 * Production-only: a dev service worker fights HMR and stale-caches local
 * iteration for zero benefit.
 */

import { useEffect } from 'react';

export default function PwaRegistrar({ swPath, scope }: { swPath: string; scope: string }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(swPath, { scope }).catch(() => {
      /* registration failure just means no install prompt — never break the room */
    });
  }, [swPath, scope]);

  return null;
}
