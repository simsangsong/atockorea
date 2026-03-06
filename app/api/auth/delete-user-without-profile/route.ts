import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

/**
 * POST /api/auth/delete-user-without-profile
 * 회원가입 후 user_profiles 생성 실패 시, 방금 생성된 auth 사용자를 정리하기 위해 호출.
 * 본인(userId)만 삭제 가능.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body?.userId;
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    let currentUser: { id: string } | null = null;

    // 가입 직후엔 쿠키가 없을 수 있음 → body.accessToken 으로 인증 허용
    const accessToken = body?.accessToken;
    if (accessToken && typeof accessToken === 'string') {
      const { data: { user }, error } = await supabase.auth.getUser(accessToken);
      if (!error && user) currentUser = user;
    }
    if (!currentUser) {
      const authUser = await getAuthUser(req);
      if (authUser) currentUser = authUser;
    }

    if (!currentUser || currentUser.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized or userId mismatch' },
        { status: 401 }
      );
    }

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error('delete-user-without-profile:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('delete-user-without-profile error:', e);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
