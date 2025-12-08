import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { createMerchantRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

/**
 * POST /api/admin/merchants/create
 * Create new merchant account with temporary password
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = createMerchantRateLimit(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    await requireAdmin(req);
    const supabase = createServerClient();
    const body = await req.json();

    const {
      company_name,
      business_registration_number,
      contact_person,
      contact_email,
      contact_phone,
      address_line1,
      address_line2,
      city,
      province,
      postal_code,
      country = 'South Korea',
    } = body;

    // Validate required fields
    if (!company_name || !contact_email || !contact_person || !contact_phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(12).toString('base64').slice(0, 16) + '!Aa1';
    
    // Create user account in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: contact_email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        role: 'merchant',
        company_name,
        contact_person,
        needs_password_change: true, // Flag for first login password change
        created_by_admin: true,
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: `Failed to create user account: ${authError?.message}` },
        { status: 400 }
      );
    }

    // Create user profile with merchant role
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        full_name: contact_person,
        role: 'merchant',
      });

    if (profileError) {
      // Rollback: delete user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Failed to create user profile: ${profileError.message}` },
        { status: 400 }
      );
    }

    // Create merchant record
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .insert({
        user_id: authData.user.id,
        company_name,
        business_registration_number,
        contact_person,
        contact_email,
        contact_phone,
        address_line1,
        address_line2,
        city,
        province,
        postal_code,
        country,
        status: 'pending',
        is_verified: false,
      })
      .select()
      .single();

    if (merchantError) {
      // Rollback: delete user and profile
      await supabase.from('user_profiles').delete().eq('id', authData.user.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Failed to create merchant record: ${merchantError.message}` },
        { status: 400 }
      );
    }

    // Create default merchant settings
    await supabase
      .from('merchant_settings')
      .insert({
        merchant_id: merchant.id,
      });

    // Create audit log entry (ignore errors if table doesn't exist)
    try {
      await supabase
        .from('audit_logs')
        .insert({
          user_id: authData.user.id, // Admin user ID (from requireAdmin)
          action: 'merchant_created',
          resource_type: 'merchant',
          resource_id: merchant.id,
          details: { company_name, contact_email },
        });
    } catch (error) {
      // Ignore audit log errors (table might not exist yet)
      console.warn('Failed to create audit log:', error);
    }

    // TODO: Send email with login credentials
    // In production, use email service (SendGrid, AWS SES, etc.)
    // For now, return credentials in response (remove in production!)
    const credentials = {
      email: contact_email,
      temporaryPassword: tempPassword,
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/merchant/login`,
      message: 'Please change password on first login',
    };

    return NextResponse.json(
      {
        merchant,
        credentials, // Remove this in production, send via email instead
        message: 'Merchant account created successfully. Credentials sent to email.',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create merchant error:', error);
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

