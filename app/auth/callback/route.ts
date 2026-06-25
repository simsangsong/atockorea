import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerComponentClient } from '@/lib/supabase';
import { LINE_OAUTH_STATE_COOKIE, statesMatch } from '@/lib/line-auth';

/**
 * OAuth callback — server-side code-for-session exchange.
 *
 * Why a Route Handler instead of the previous client `page.tsx`?
 *   The page-level handler called `supabase.auth.exchangeCodeForSession`
 *   from a `useEffect` after `createBrowserClient` was introduced (PR
 *   #84, @supabase/ssr adoption). With the cookie-based browser client
 *   that exchange can sit forever on the loading spinner ("Completing
 *   authentication." / "처리 중...") — reproduced by the user 2026-05-25
 *   on first login after the migration. The recommended @supabase/ssr
 *   pattern is to exchange the code server-side in a Route Handler so
 *   the session cookies land before any page renders, killing the
 *   infinite-spinner failure mode entirely.
 *
 * Handles:
 *   - `?error=…`          → redirect /signin with the error
 *   - `?provider=line&code=…` → server-side POST to /api/auth/line for
 *                           the magic-link exchange, then redirect
 *   - `?code=…` (regular OAuth) → exchangeCodeForSession via SSR client,
 *                           sets sb-* cookies on the response, redirect
 *                           to `?next` (default /mypage)
 *   - `?next=/signup…` / `?signup=1` → exchange + signOut + redirect
 *                           to /signup?step=verify (signup verify
 *                           callback flow)
 *   - no code, no error  → redirect /signin
 *
 * User-profile maintenance (avatar / display name / auth_provider) is
 * NOT done here — /mypage and the header already lazy-create profiles
 * the first time they're loaded, so we keep the auth path lean. If we
 * later want eager profile creation, do it via /api/auth/create-profile
 * called from this handler.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const provider = url.searchParams.get('provider');
  const errorParam = url.searchParams.get('error');
  const errorDesc = url.searchParams.get('error_description');
  const rawNext = (url.searchParams.get('next') || '/mypage').replace(/^null$/i, '') || '/mypage';
  // Validate `next` so callback can't be turned into an open redirect.
  const next =
    rawNext.startsWith('/') && !rawNext.includes(':') && !rawNext.startsWith('//') && rawNext.length <= 500
      ? rawNext
      : '/mypage';

  // Provider-level error — bounce to /signin with a hint.
  if (errorParam) {
    const reason = errorDesc || errorParam;
    return NextResponse.redirect(
      new URL(`/signin?error=${encodeURIComponent(reason)}`, req.url),
    );
  }

  // LINE provider — call the magic-link endpoint server-side, then redirect.
  if (provider === 'line') {
    if (!code) {
      return NextResponse.redirect(new URL('/signin?error=missing-code', req.url));
    }
    // N18: CSRF — the `state` LINE echoes back must match the per-request state
    // we stashed in an httpOnly cookie when starting the flow (GET /api/auth/line).
    const returnedState = url.searchParams.get('state');
    const expectedState = req.cookies.get(LINE_OAUTH_STATE_COOKIE)?.value ?? null;
    if (!statesMatch(returnedState, expectedState)) {
      const res = NextResponse.redirect(new URL('/signin?error=invalid-state', req.url));
      res.cookies.delete(LINE_OAUTH_STATE_COOKIE);
      return res;
    }
    try {
      const res = await fetch(new URL('/api/auth/line', req.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data?.magicLink === 'string' && data.magicLink) {
        const ok = NextResponse.redirect(data.magicLink);
        ok.cookies.delete(LINE_OAUTH_STATE_COOKIE); // one-time use
        return ok;
      }
      return NextResponse.redirect(
        new URL(`/signin?error=${encodeURIComponent(data?.error || 'line-auth-failed')}`, req.url),
      );
    } catch (e) {
      console.error('[/auth/callback] LINE provider exchange failed', e);
      return NextResponse.redirect(new URL('/signin?error=line-auth-failed', req.url));
    }
  }

  // No code AND no error AND not LINE → nothing actionable, send home.
  if (!code) {
    return NextResponse.redirect(new URL('/signin', req.url));
  }

  // Regular OAuth / email-link callback — exchange the code server-side.
  // `createSupabaseServerComponentClient` reads + writes cookies via the
  // store passed in, so `setAll` lands the fresh session on the redirect
  // response automatically.
  const cookieStore = await cookies();
  const supabase = createSupabaseServerComponentClient(cookieStore);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const msg = String(error.message ?? '').toLowerCase();
    const isPkceArtefact = msg.includes('pkce') || msg.includes('verifier') || msg.includes('code_verifier');
    const reason = isPkceArtefact ? 'expired' : 'exchange-failed';
    if (process.env.NODE_ENV === 'development') {
      console.warn('[/auth/callback] exchange failed', error.message);
    }
    return NextResponse.redirect(new URL(`/signin?reason=${reason}`, req.url));
  }

  // Signup-verify callback (email magic link landing on /signup) — clear
  // the session we just minted and bounce to the signup form so the
  // user completes onboarding before re-signing in.
  const signupFlag = url.searchParams.get('signup') === '1';
  const isSignupVerifyFlow =
    signupFlag || next.startsWith('/signup') || next.includes('signup');
  if (isSignupVerifyFlow && data?.user) {
    const email = data.user.email ?? '';
    try { await supabase.auth.signOut(); } catch { /* noop */ }
    return NextResponse.redirect(
      new URL(`/signup?step=verify&email=${encodeURIComponent(email)}`, req.url),
    );
  }

  return NextResponse.redirect(new URL(next, req.url));
}
