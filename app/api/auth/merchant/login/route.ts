import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { loginRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/auth/merchant/login
 * Merchant login endpoint
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting for login attempts
    const rateLimitResponse = loginRateLimit(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Authenticate user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user is a merchant
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    if (!profile || (profile.role !== 'merchant' && profile.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Access denied. Merchant account required.' },
        { status: 403 }
      );
    }

    // Get merchant info
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, company_name, status, is_verified')
      .eq('user_id', authData.user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant record not found' },
        { status: 404 }
      );
    }

    // Check if merchant is active
    if (merchant.status !== 'active') {
      return NextResponse.json(
        { error: `Merchant account is ${merchant.status}. Please contact support.` },
        { status: 403 }
      );
    }

    // Check if password needs to be changed (first login)
    const needsPasswordChange = authData.user.user_metadata?.needs_password_change === true;

    return NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: profile.role,
        merchantId: merchant.id,
        companyName: merchant.company_name,
      },
      session: authData.session,
      needsPasswordChange,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

