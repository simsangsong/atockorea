import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import { validateAppPassword } from '@/lib/password-policy';

/**
 * POST /api/auth/change-password
 * Verifies current password via sign-in, then sets new password (email/password accounts).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'currentPassword and newPassword are required' }, { status: 400 });
    }
    const policy = validateAppPassword(newPassword);
    if (!policy.valid) {
      return NextResponse.json({ error: policy.message ?? 'Invalid password' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: signErr } = await anon.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signErr) {
      return NextResponse.json(
        {
          error:
            'Current password is incorrect, or password sign-in is not enabled for this account (e.g. social login only).',
        },
        { status: 401 },
      );
    }

    const { error: updErr } = await anon.auth.updateUser({ password: newPassword });
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[change-password]', e);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
