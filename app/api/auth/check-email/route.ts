import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/auth/check-email
 * 가입 전 이메일 중복 검사. 이미 auth.users에 있으면 { exists: true } 반환.
 * body: { email: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required', exists: false },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // getUserByEmail (Supabase JS v2.39+)
    const admin = supabase.auth.admin as { getUserByEmail?: (email: string) => Promise<{ data: { user: unknown }; error: unknown }> };
    if (typeof admin.getUserByEmail === 'function') {
      const { data: userData } = await admin.getUserByEmail(email);
      return NextResponse.json({ exists: !!userData?.user });
    }

    // Fallback: paginate listUsers and search by email
    let page = 1;
    const perPage = 50;
    while (true) {
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });
      if (listError || !listData?.users?.length) {
        return NextResponse.json({ exists: false });
      }
      const found = listData.users.some((u: { email?: string }) => (u.email || '').toLowerCase() === email);
      if (found) return NextResponse.json({ exists: true });
      if (listData.users.length < perPage) return NextResponse.json({ exists: false });
      page += 1;
      if (page > 20) return NextResponse.json({ exists: false });
    }
  } catch (e) {
    console.error('[check-email]', e);
    return NextResponse.json({ exists: false }, { status: 200 });
  }
}
