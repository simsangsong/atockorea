'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Global Supabase auth session — one subscription for the whole app.
 *
 * Why this exists
 *   Before this provider, both `components/Header.tsx` and
 *   `components/mypage/MyPageSessionProvider.tsx` (plus a few one-shot
 *   pages) called `supabase.auth.getSession()` from their own
 *   `useEffect`s and registered their own `onAuthStateChange` listeners.
 *   After the `@supabase/ssr` migration in PR #84 each of those paths
 *   started hanging — surfaced as the 5–6s `[Header] auth.getSession
 *   timed out` console spam, with `/api/bookings/...` returning 403
 *   because the session never resolved and the Bearer token was missing
 *   on the request. Same root cause as the spinner bugs already patched
 *   in `auth/callback` (PR #88) and `MyPageSessionProvider` (commit
 *   346bd593): calling `auth.getSession()` from inside an
 *   `onAuthStateChange` callback is a documented Supabase deadlock.
 *
 * Pattern
 *   - One `onAuthStateChange` subscription mounted at the root layout.
 *   - Inside the callback we use the `nextSession` argument directly —
 *     never re-call `auth.getSession()`. Doing so would re-enter the
 *     auth lock the SDK holds while emitting the event.
 *   - `setSession` dedupes by access_token + user.id so identical
 *     re-emissions (TOKEN_REFRESHED with the same payload, repeated
 *     INITIAL_SESSION on tab focus, etc.) do not cause React state
 *     thrash in downstream consumers.
 *   - `sessionRef` mirrors the latest value so `getAccessToken` /
 *     consumer callbacks stay stable across renders.
 */

type SessionStatus = 'checking' | 'ready';

type SessionContextValue = {
  status: SessionStatus;
  session: Session | null;
  user: User | null;
  accessToken: string | null;
  /**
   * Returns the current access token, refreshing the cached session if
   * needed. Use this before making authenticated `fetch` calls so the
   * Bearer header reflects a freshly rotated token.
   */
  getAccessToken: () => Promise<string | null>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const BOOTSTRAP_TIMEOUT_MS = 6000;

/**
 * One-shot session bootstrap. Calling `auth.getSession()` outside any
 * `onAuthStateChange` callback is safe (it's the SDK's recommended
 * "what's the current session?" probe); the timeout is the same defensive
 * fallback the Header used to apply locally, kept here in case a stale
 * cookie or supabase outage stalls the first read.
 */
async function bootstrapSession(): Promise<Session | null> {
  const { supabase } = await import('@/lib/supabase');
  if (!supabase) return null;

  const probe = supabase.auth.getSession().then((r) => r.data?.session ?? null);
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[SessionProvider] getSession bootstrap timed out — falling back to signed-out. ' +
            'If you see this in production, suspect malformed sb-* cookies.',
        );
      }
      resolve(null);
    }, BOOTSTRAP_TIMEOUT_MS);
  });

  try {
    return await Promise.race([probe, timeout]);
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [session, setSessionState] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const setSession = useCallback((next: Session | null) => {
    const prev = sessionRef.current;
    if (
      prev?.access_token === next?.access_token &&
      (prev?.user?.id ?? null) === (next?.user?.id ?? null)
    ) {
      return;
    }
    sessionRef.current = next;
    setSessionState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      const initial = await bootstrapSession();
      if (cancelled) return;
      setSession(initial);
      setStatus('ready');

      const { supabase } = await import('@/lib/supabase');
      if (!supabase || cancelled) return;

      const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        // Use the callback argument directly. Calling `getSession()` here
        // would deadlock against the auth lock supabase holds during the
        // event — the symptom this provider exists to prevent.
        setSession(nextSession);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [setSession]);

  const getAccessToken = useCallback(async () => {
    const current = sessionRef.current?.access_token;
    if (current) return current;
    const next = await bootstrapSession();
    setSession(next);
    return next?.access_token ?? null;
  }, [setSession]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      accessToken: session?.access_token ?? null,
      getAccessToken,
    }),
    [getAccessToken, session, status],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * Subscribe to the global auth session. Safe to call from any client
 * component below `<SessionProvider>` in the tree. Returns a stable
 * "checking, signed-out" shape when called outside a provider (storybook,
 * legacy bundles) so consumers never have to null-check the hook itself.
 */
export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    return {
      status: 'checking',
      session: null,
      user: null,
      accessToken: null,
      getAccessToken: async () => null,
    };
  }
  return value;
}
