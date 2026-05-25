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
import { useSession } from '@/lib/auth-session';

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

/**
 * /mypage-specific session wrapper. Reads the global Supabase session
 * from `lib/auth-session` (one shared subscription for the whole app —
 * see the docblock there for the deadlock that motivated it) and adds
 * the profile-row loading + auth-metadata supplement that only /mypage
 * and its children care about.
 */
export function MyPageSessionProvider({ children }: { children: ReactNode }) {
  const {
    status,
    session,
    user,
    accessToken,
    getAccessToken,
  } = useSession();

  const [profile, setProfile] = useState<MyPageProfile | null>(null);
  const supplementAttemptedRef = useRef(false);
  const lastLoadedUserIdRef = useRef<string | null>(null);

  const loadProfile = useCallback(async (activeSession: Session | null) => {
    if (!activeSession?.user) {
      setProfile(null);
      lastLoadedUserIdRef.current = null;
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
    lastLoadedUserIdRef.current = activeSession.user.id;

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

  // Load the profile when the signed-in user actually changes. Keyed on
  // user.id (not the whole session object) so a TOKEN_REFRESHED event
  // for the same user does NOT re-hit user_profiles every time the token
  // rotates — the cascade that pinned /mypage on its skeleton before.
  useEffect(() => {
    const uid = session?.user?.id ?? null;
    if (uid === lastLoadedUserIdRef.current) return;
    if (!uid) {
      setProfile(null);
      supplementAttemptedRef.current = false;
      lastLoadedUserIdRef.current = null;
      return;
    }
    void loadProfile(session);
  }, [session, loadProfile]);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session);
  }, [loadProfile, session]);

  const value = useMemo<MyPageSessionContextValue>(
    () => ({
      status,
      session,
      user,
      accessToken,
      profile,
      refreshProfile,
      getAccessToken,
    }),
    [accessToken, getAccessToken, profile, refreshProfile, session, status, user],
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
