import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * PATCH /api/auth/update-profile
 * 이미 생성된 프로필에 고객정보 보충. 인증된 사용자만 본인 프로필 수정 가능.
 * body: { full_name?, phone?, birth_year?, nationality? } — 보내진 필드만 업데이트.
 */
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if (body.full_name !== undefined) {
      updates.full_name = body.full_name != null && String(body.full_name).trim() ? String(body.full_name).trim() : null;
    }
    if (body.phone !== undefined) {
      updates.phone = body.phone != null && String(body.phone).trim() ? String(body.phone).trim() : null;
    }
    if (body.birth_year !== undefined) {
      const n = Number(body.birth_year);
      updates.birth_year = Number.isNaN(n) ? null : n;
    }
    if (body.nationality !== undefined) {
      updates.nationality = body.nationality != null && String(body.nationality).trim() ? String(body.nationality).trim() : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, message: 'Nothing to update' });
    }

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update(updates as Record<string, unknown>)
      .eq('id', user.id);

    if (updateError) {
      if (updateError.code === '23503') {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }
      console.error('update-profile error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('update-profile error:', e);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
