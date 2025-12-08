import { NextRequest, NextResponse } from 'next/server';

/**
 * OAuth callback handler
 * Redirects to client-side callback page
 */
export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/mypage';

  // Redirect to client-side callback page
  const redirectUrl = new URL('/auth/callback', req.url);
  if (code) redirectUrl.searchParams.set('code', code);
  if (next) redirectUrl.searchParams.set('next', next);

  return NextResponse.redirect(redirectUrl);
}

