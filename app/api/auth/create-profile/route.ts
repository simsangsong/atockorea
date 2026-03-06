import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/auth/create-profile
 * 회원가입 직후 user_profiles 행 생성. 서버(service role)에서 insert 하므로 RLS 영향 없음.
 * body: { userId, full_name, accessToken } — accessToken 있으면 검증, 없으면 바로 insert 시도.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body?.userId;
    const fullName = body?.full_name ?? body?.fullName ?? '';
    const accessToken = body?.accessToken;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    if (accessToken && typeof accessToken === 'string') {
      const { data: { user }, error } = await supabase.auth.getUser(accessToken);
      if (error || !user || user.id !== userId) {
        return NextResponse.json(
          { error: 'Invalid or mismatched token' },
          { status: 401 }
        );
      }
    }
    // accessToken 없을 때: 바로 insert. auth.users에 없으면 FK(23503)로 실패

    const { error: insertError } = await supabase.from('user_profiles').insert({
      id: userId,
      full_name: fullName || null,
      role: 'customer',
    });

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Profile already exists' },
          { status: 409 }
        );
      }
      if (insertError.code === '23503') {
        return NextResponse.json(
          { error: 'User not found. Please complete sign up and try again.' },
          { status: 404 }
        );
      }
      console.error('create-profile insert error:', insertError);
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('create-profile error:', e);
    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    );
  }
}
