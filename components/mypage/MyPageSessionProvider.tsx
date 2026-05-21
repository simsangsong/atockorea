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
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MyPageProfile | null>(null);
  const supplementAttemptedRef = useRef(false);

  const loadProfile = useCallback(async (activeSession: Session | null) => {
    if (!activeSession?.user) {
      setProfile(null);
      return;
    }

    const { supabase } = await import('@/lib/supabase');
    if (!supabase) return;

    const { data } = await supabase
      .from('user_profiles')
      .select('full_name, avatar_url, phone, birth_year, nationality, language_preference, mypage_preferences')
      .eq('id', activeSession.user.id)
      .single();

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
        setSession(nextSession);
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
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session);
  }, [loadProfile, session]);

  const getAccessToken = useCallback(async () => {
    if (session?.access_token) return session.access_token;
    const nextSession = await getSessionWithRetry();
    setSession(nextSession);
    if (nextSession) {
      void loadProfile(nextSession);
    }
    return nextSession?.access_token ?? null;
  }, [loadProfile, session]);

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
