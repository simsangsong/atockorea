'use client';

/**
 * T3.6 — screen wake lock while location sharing / navigation is active.
 *
 * Wake Lock API where available (re-acquired on tab return — the browser
 * silently releases it when the tab hides); harmless no-op elsewhere.
 * Callers pair it with a "keep your screen on" hint for unsupported engines.
 */

interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
}

export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export interface WakeLockHandle {
  /** True while a sentinel is actually held. */
  isActive(): boolean;
  release(): Promise<void>;
}

/**
 * Acquire a screen wake lock and keep re-acquiring it whenever the tab
 * becomes visible again. Returns a handle; release() also stops the
 * re-acquisition listener. Never throws — unsupported/denied is a no-op.
 */
export async function acquireWakeLock(): Promise<WakeLockHandle> {
  let sentinel: WakeLockSentinelLike | null = null;
  let released = false;

  const request = async () => {
    if (released || !isWakeLockSupported()) return;
    try {
      const wakeLock = (navigator as unknown as { wakeLock: { request(type: 'screen'): Promise<WakeLockSentinelLike> } })
        .wakeLock;
      sentinel = await wakeLock.request('screen');
      sentinel.addEventListener?.('release', () => {
        sentinel = null;
      });
    } catch {
      sentinel = null; // low battery / iframe policy — the hint banner covers it
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') void request();
  };
  document.addEventListener('visibilitychange', onVisibility);
  await request();

  return {
    isActive: () => sentinel !== null,
    async release() {
      released = true;
      document.removeEventListener('visibilitychange', onVisibility);
      try {
        await sentinel?.release();
      } catch {
        /* already released */
      }
      sentinel = null;
    },
  };
}
