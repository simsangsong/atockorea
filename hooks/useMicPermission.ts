'use client';

/**
 * Phase 1 (input-pipeline fix) — a small, robust microphone-permission hook
 * shared by every Tour Mode voice surface (guest Composer, driver cockpit,
 * guide broadcast).
 *
 * The Permissions-Policy header fix (Phase 0) lets `getUserMedia()` prompt at
 * all; this hook makes the *first-use* experience deliberate instead of
 * hoping the user taps the mic and figures out a silent rejection:
 *   - it reads the live permission state via `navigator.permissions.query`
 *     (where supported — Firefox/older Safari can't query 'microphone', so we
 *     fall back to 'prompt' and let `prime()` be the real gate),
 *   - `prime()` triggers the browser prompt by opening (and immediately
 *     releasing) an audio stream, then reports granted/denied,
 *   - it distinguishes a hard 'denied' (needs a browser-settings reset — a
 *     re-prompt won't appear) from 'prompt' (a tap will ask).
 *
 * Devices that can't record at all (no MediaRecorder / no getUserMedia — e.g.
 * some in-app webviews) resolve to 'unsupported' so callers hide the mic and
 * lean on the text path, never a dead button.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isVoiceRecordingSupported } from '@/lib/tour-room/recorder';

export type MicPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

interface PermissionStatusLike extends EventTarget {
  state: PermissionState;
  onchange: ((this: PermissionStatusLike, ev: Event) => unknown) | null;
}

async function queryMicStatus(): Promise<PermissionStatusLike | null> {
  try {
    const permissions = (navigator as Navigator & { permissions?: Permissions }).permissions;
    if (!permissions?.query) return null;
    // 'microphone' isn't in the standard PermissionName union but is honoured
    // by Chromium/WebKit; unsupported engines throw and we fall back to prompt.
    return (await permissions.query({ name: 'microphone' as PermissionName })) as unknown as PermissionStatusLike;
  } catch {
    return null;
  }
}

export interface UseMicPermission {
  /** Live permission state; 'unsupported' when recording can't work at all. */
  state: MicPermissionState;
  /**
   * Trigger the browser prompt (opens then releases a stream). Resolves true
   * when the mic is now usable. Safe to call from a click handler only —
   * getUserMedia requires a user gesture on most engines.
   */
  prime: () => Promise<boolean>;
}

export function useMicPermission(): UseMicPermission {
  const [state, setState] = useState<MicPermissionState>('prompt');
  const statusRef = useRef<PermissionStatusLike | null>(null);

  useEffect(() => {
    let alive = true;
    // All setState happens inside the async closure (never synchronously in the
    // effect body) so there's no cascading-render on mount.
    void (async () => {
      if (!isVoiceRecordingSupported()) {
        if (alive) setState('unsupported');
        return;
      }
      const status = await queryMicStatus();
      if (!alive) return;
      if (status) {
        statusRef.current = status;
        const sync = () => setState(status.state === 'prompt' ? 'prompt' : status.state);
        sync();
        status.onchange = sync;
      } else {
        // Can't introspect — assume a prompt is possible; prime() is the truth.
        setState('prompt');
      }
    })();
    return () => {
      alive = false;
      if (statusRef.current) statusRef.current.onchange = null;
    };
  }, []);

  const prime = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setState('granted');
      return true;
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      // NotAllowedError = user (or a prior block) said no → hard denied.
      // Other errors (NotFoundError, etc.) leave state as-is so a retry works.
      if (name === 'NotAllowedError' || name === 'SecurityError') setState('denied');
      return false;
    }
  }, []);

  return { state, prime };
}
