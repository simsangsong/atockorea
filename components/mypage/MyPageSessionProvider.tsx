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

type MyPageProfile = {
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  birth_year?: number | null;
  nationality?: string | null;
  language_preference?: string | null;
  mypage_preferences?: unknown;
};

type MyPageSessionContextValue = {
  status: 'checking' | 'ready';
  session: Session | null;
  user: User | null;
  accessToken: string | null;
  profile: MyPageProfile | null;
  refreshProfile: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};

const MyPageSessionContext = createContext<MyPageSessionContextValue | null>(null);
const PROFILE_COLUMNS =
  'full_name, avatar_url, phone, birth_year, nationality, language_preference, mypage_preferences';
const PROFILE_COLUMNS_WITHOUT_PREFS =
  'full_name, avatar_url, phone, birth_year, nationality, language_preference';

function isMissingMypagePreferencesColumn(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { message?: string; details?: string };
  return `${maybeError.message ?? ''} ${maybeError.details ?? ''}`.includes('mypage_preferences');
}

async function getSessionWithRetry() {
  const { supabase } = await import('@/lib/supabase');
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 600));
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) return data.session;
    } catch {
      // fall through
    }
  }
  return null;
}

export function MyPageSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'ready'>('checking');
  const [session, setSessionState] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MyPageProfile | null>(null);
  const supplementAttemptedRef = useRef(false);
  /**
   * Ref mirror of `session` so `getAccessToken` / `refreshProfile` can read
   * the latest value without depending on it in `useCallback`. Without this
   * the callbacks change identity every time supabase emits a new Session
   * object (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED), which used to
   * cascade into /mypage's fetchAll re-firing on every event and pinning
   * the page on the "verifying session" spinner (reported 2026-05-25).
   */
  const sessionRef = useRef<Session | null>(null);

  /**
   * Dedupe Session objects whose access_token + user.id are unchanged.
   * @supabase/ssr re-emits a fresh Session reference on every auth event
   * (and `getSession()` call), and React treats those as state changes
   * even though the user identity hasn't moved — feeding the render
   * cascade above.
   */
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

  const loadProfile = useCallback(async (activeSession: Session | null) => {
    if (!activeSession?.user) {
      setProfile(null);
      return;
    }

    const { supabase } = await import('@/lib/supabase');
    if (!supabase) return;

    let { data, error } = await supabase
      .from('user_profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', activeSession.user.id)
      .single();

    if (error && isMissingMypagePreferencesColumn(error)) {
      const fallback = await supabase
        .from('user_profiles')
        .select(PROFILE_COLUMNS_WITHOUT_PREFS)
        .eq('id', activeSession.user.id)
        .single();
      data = fallback.data ? { ...fallback.data, mypage_preferences: {} } : null;
      error = fallback.error;
    }

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[mypage/session] Failed to load profile:', error.message);
      }
      setProfile(null);
      return;
    }

    setProfile((data as MyPageProfile | null) ?? null);

    if (supplementAttemptedRef.current || !data) return;
    supplementAttemptedRef.current = true;

    const meta = activeSession.user.user_metadata || {};
    const supplement: Record<string, string | number | null> = {};
    if (!data.full_name?.trim() && meta.full_name != null && String(meta.full_name).trim()) {
      supplement.full_name = String(meta.full_name).trim();
    }
    if (!data.phone?.trim() && meta.phone != null && String(meta.phone).trim()) {
      supplement.phone = String(meta.phone).trim();
    }
    if (data.birth_year == null && meta.birth_year != null) {
      const y = Number(meta.birth_year);
      if (!Number.isNaN(y)) supplement.birth_year = y;
    }
    if (!data.nationality?.trim() && meta.nationality != null && String(meta.nationality).trim()) {
      supplement.nationality = String(meta.nationality).trim();
    }

    if (Object.keys(supplement).length > 0 && activeSession.access_token) {
      try {
        await fetch('/api/auth/update-profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeSession.access_token}`,
          },
          body: JSON.stringify(supplement),
        });
        await loadProfile(activeSession);
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[mypage/session] Failed to supplement profile:', e);
        }
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      const initialSession = await getSessionWithRetry();
      if (cancelled) return;
      setSession(initialSession);
      setStatus('ready');
      if (initialSession) await loadProfile(initialSession);

      const { supabase } = await import('@/lib/supabase');
      if (!supabase || cancelled) return;
      const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        const prev = sessionRef.current;
        const sameSession =
          prev?.access_token === nextSession?.access_token &&
          (prev?.user?.id ?? null) === (nextSession?.user?.id ?? null);
        setSession(nextSession);
        if (sameSession) return;
        if (!nextSession) {
          setProfile(null);
          supplementAttemptedRef.current = false;
          return;
        }
        void loadProfile(nextSession);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [loadProfile, setSession]);

  const refreshProfile = useCallback(async () => {
    await loadProfile(sessionRef.current);
  }, [loadProfile]);

  const getAccessToken = useCallback(async () => {
    if (sessionRef.current?.access_token) return sessionRef.current.access_token;
    const nextSession = await getSessionWithRetry();
    setSession(nextSession);
    if (nextSession) {
      void loadProfile(nextSession);
    }
    return nextSession?.access_token ?? null;
  }, [loadProfile, setSession]);

  const value = useMemo<MyPageSessionContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      accessToken: session?.access_token ?? null,
      profile,
      refreshProfile,
      getAccessToken,
    }),
    [getAccessToken, profile, refreshProfile, session, status],
  );

  return (
    <MyPageSessionContext.Provider value={value}>
      {children}
    </MyPageSessionContext.Provider>
  );
}

export function useMyPageSession() {
  const value = useContext(MyPageSessionContext);
  if (!value) {
    throw new Error('useMyPageSession must be used within MyPageSessionProvider');
  }
  return value;
}
