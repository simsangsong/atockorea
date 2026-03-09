import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Profile data is read from the same Supabase as the web (user_profiles).
 * Same DB = same account, same name/avatar/phone on web and app.
 */
interface UserProfile {
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!supabase || !session?.user) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('user_profiles')
      .select('full_name, avatar_url, phone')
      .eq('id', session.user.id)
      .single();
    setProfile(data || null);
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          const { data } = await supabase
            .from('user_profiles')
            .select('full_name, avatar_url, phone')
            .eq('id', newSession.user.id)
            .single();
          setProfile(data || null);
        } else {
          setProfile(null);
        }
      }
    );
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        const { data } = await supabase
          .from('user_profiles')
          .select('full_name, avatar_url, phone')
          .eq('id', s.user.id)
          .single();
        setProfile(data || null);
      }
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      session: null,
      user: null,
      profile: null,
      loading: false,
      signOut: async () => {},
      refreshProfile: async () => {},
    };
  }
  return ctx;
}
