import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/auth/confirm-email
 * 커스텀 이메일 인증(인증번호)으로 가입한 사용자의 Supabase 이메일을 확정 처리합니다.
 * 가입 직후에만 호출하며, signInWithPassword 시 "Email not confirmed"가 나오지 않도록 합니다.
 * body: { userId: string, accessToken?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body?.userId;
    const accessToken = body?.accessToken;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // 선택: accessToken이 있으면 해당 사용자 본인 요청인지 확인
    if (accessToken && typeof accessToken === 'string') {
      const { data: { user }, error } = await supabase.auth.getUser(accessToken);
      if (error || !user || user.id !== userId) {
        return NextResponse.json({ error: 'Invalid or mismatched token' }, { status: 401 });
      }
    }

    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    if (error) {
      console.error('[confirm-email] updateUserById error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to confirm email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, user: data?.user?.id });
  } catch (e) {
    console.error('[confirm-email]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
