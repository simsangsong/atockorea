/**
 * Google OAuth sign-in for the app.
 * Uses Supabase Auth (same as web); redirect URL must be allowed in Supabase Dashboard > Auth > URL Configuration.
 */
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '@/lib/supabase';

export type GoogleSignInResult = { ok: true } | { ok: false; error: string };

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (!supabase) {
    return { ok: false, error: 'Auth not configured.' };
  }

  try {
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: 'mobile',
      path: 'auth/callback',
      preferLocalhost: false,
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data?.url) {
      return { ok: false, error: 'No auth URL returned.' };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri, {
      showInRecents: true,
    });

    if (result.type !== 'success' || !result.url) {
      if (result.type === 'cancel') {
        return { ok: false, error: 'Sign in was cancelled.' };
      }
      return { ok: false, error: 'Sign in did not complete.' };
    }

    const url = result.url;
    const hash = url.includes('#') ? url.split('#')[1] : '';
    const params = new URLSearchParams(hash);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (!access_token || !refresh_token) {
      const err = params.get('error_description') || params.get('error') || 'No tokens in redirect.';
      return { ok: false, error: err };
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (sessionError) {
      return { ok: false, error: sessionError.message };
    }

    if (sessionData?.user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', sessionData.user.id)
        .single();

      if (!profile) {
        const meta = sessionData.user.user_metadata || {};
        const full_name =
          (meta.name as string) ||
          (meta.full_name as string) ||
          [meta.given_name, meta.family_name].filter(Boolean).join(' ').trim() ||
          sessionData.user.email?.split('@')[0] ||
          'User';
        await supabase.from('user_profiles').insert({
          id: sessionData.user.id,
          full_name,
          avatar_url: (meta.avatar_url as string) || null,
          role: 'customer',
        });
      }
    }

    WebBrowser.maybeCompleteAuthSession();
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Google sign-in failed.';
    return { ok: false, error: message };
  }
}
