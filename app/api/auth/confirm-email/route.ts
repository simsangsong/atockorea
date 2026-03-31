import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/auth/confirm-email
 * Service role로 `email_confirm`을 강제합니다. 웹 회원가입은 Supabase OTP(verifyOtp)로
 * 이미 이메일이 확정되는 경우가 많아 호출이 필수는 아닙니다. 모바일/커스텀 가입 경로에서
 * 필요하면 클라이언트에서 호출하세요. body: { userId: string, accessToken?: string }
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
