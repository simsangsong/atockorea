import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/auth/create-profile
 * 회원가입 직후 user_profiles 행 생성. 서버(service role)에서 insert 하므로 RLS 영향 없음.
 * body: { userId, full_name, accessToken?, phone?, birth_year?, nationality? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body?.userId;
    const fullName = body?.full_name ?? body?.fullName ?? '';
    const accessToken = body?.accessToken;
    const phone = body?.phone ?? null;
    const birthYear = body?.birth_year != null ? Number(body.birth_year) : null;
    const nationality = body?.nationality ?? null;

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

    const basePayload: Record<string, unknown> = {
      id: userId,
      full_name: fullName || null,
      role: 'customer',
      phone: phone && String(phone).trim() ? String(phone).trim() : null,
    };
    const fullPayload = { ...basePayload };
    if (birthYear != null && !Number.isNaN(birthYear)) fullPayload.birth_year = birthYear;
    if (nationality != null && String(nationality).trim()) fullPayload.nationality = String(nationality).trim();

    let insertError = (await supabase.from('user_profiles').insert(fullPayload)).error;

    if (insertError && /birth_year|nationality/.test(insertError.message || '')) {
      insertError = (await supabase.from('user_profiles').insert(basePayload)).error;
    }

    // 23505 = 이미 존재 (트리거로 생성된 경우 등). INSERT 대신 UPDATE로 프로필만 갱신
    if (insertError?.code === '23505') {
      const updatePayload: Record<string, unknown> = {
        full_name: fullName || null,
        phone: phone && String(phone).trim() ? String(phone).trim() : null,
      };
      if (birthYear != null && !Number.isNaN(birthYear)) updatePayload.birth_year = birthYear;
      if (nationality != null && String(nationality).trim()) updatePayload.nationality = String(nationality).trim();
      const updateError = (await supabase.from('user_profiles').update(updatePayload).eq('id', userId)).error;
      if (updateError) {
        console.error('create-profile update error:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // 23503 = FK violation (auth.users에 아직 반영 안 됨). 회원가입 직후 타이밍 이슈로 한 번 재시도
    if (insertError?.code === '23503') {
      await new Promise((r) => setTimeout(r, 1500));
      insertError = (await supabase.from('user_profiles').insert(fullPayload)).error;
      if (insertError && /birth_year|nationality/.test(insertError.message || '')) {
        insertError = (await supabase.from('user_profiles').insert(basePayload)).error;
      }
    }

    if (insertError) {
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
