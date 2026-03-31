import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { mergeMypagePreferences } from '@/lib/mypage-preferences-merge';

const ALLOWED_LANGUAGE_PREFERENCE = new Set(['en', 'ko', 'zh', 'zh-TW', 'es', 'ja']);

/**
 * PATCH /api/auth/update-profile
 * 인증된 사용자만 본인 프로필 수정.
 * body: { full_name?, phone?, birth_year?, nationality?, language_preference?, mypage_preferences? } — 보내진 필드만 반영.
 * mypage_preferences 는 기존 JSON과 병합(알림·비상연락처 등 중첩 필드 병합).
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

    if (body.language_preference !== undefined) {
      const v = String(body.language_preference).trim();
      if (ALLOWED_LANGUAGE_PREFERENCE.has(v)) {
        updates.language_preference = v;
      }
    }

    if (
      body.mypage_preferences !== undefined &&
      typeof body.mypage_preferences === 'object' &&
      body.mypage_preferences !== null &&
      !Array.isArray(body.mypage_preferences)
    ) {
      const { data: row, error: prefFetchErr } = await supabase
        .from('user_profiles')
        .select('mypage_preferences')
        .eq('id', user.id)
        .single();

      if (prefFetchErr) {
        console.error('update-profile fetch mypage_preferences:', prefFetchErr);
        return NextResponse.json({ error: prefFetchErr.message }, { status: 500 });
      }

      const prev = row?.mypage_preferences as Record<string, unknown> | null | undefined;
      updates.mypage_preferences = mergeMypagePreferences(
        prev ?? null,
        body.mypage_preferences as Record<string, unknown>,
      );
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
