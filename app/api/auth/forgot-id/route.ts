import { NextRequest, NextResponse } from 'next/server';
import { createAnonServerClient } from '@/lib/supabase';

/**
 * POST /api/auth/forgot-id
 * Registered users receive the same sign-in OTP email as "magic link" flow.
 * Response is always { ok: true } to avoid leaking whether the email exists.
 * Unregistered emails: Supabase returns an error; we ignore it and still return ok.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const raw = typeof body?.email === 'string' ? body.email.trim() : '';
    const email = raw.toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const supabase = createAnonServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) {
      // Expected for unknown emails or rate limits; never expose to client
      console.warn('[forgot-id] signInWithOtp:', error.message);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('[forgot-id]', e);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
