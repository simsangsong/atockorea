import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/auth/verify-code
 * 验证验证码
 */
export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and verification code are required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // 查找验证码
    const { data: verificationData, error: findError } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (findError || !verificationData) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    // 标记验证码为已使用
    await supabase
      .from('verification_codes')
      .update({ used: true })
      .eq('id', verificationData.id);

    return NextResponse.json({
      success: true,
      message: 'Verification code verified successfully',
    });
  } catch (error: any) {
    console.error('Verify code error:', error);
    return NextResponse.json(
      { error: 'Failed to verify code', details: error.message },
      { status: 500 }
    );
  }
}

