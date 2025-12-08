import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/merchants - Get all merchants
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();

    const { data: merchants, error } = await supabase
      .from('merchants')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ merchants });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/merchants - Create new merchant
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const body = await req.json();

    // First create user account
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: body.contact_email,
      password: body.password || 'TempPassword123!',
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Failed to create user account' }, { status: 400 });
    }

    // Create user profile with merchant role
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        full_name: body.contact_person,
        role: 'merchant',
      });

    if (profileError) {
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 400 });
    }

    // Create merchant record
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .insert({
        user_id: authData.user.id,
        company_name: body.company_name,
        business_registration_number: body.business_registration_number,
        contact_person: body.contact_person,
        contact_email: body.contact_email,
        contact_phone: body.contact_phone,
        address_line1: body.address_line1,
        city: body.city,
        status: 'pending',
      })
      .select()
      .single();

    if (merchantError) {
      return NextResponse.json({ error: merchantError.message }, { status: 400 });
    }

    // Create default merchant settings
    await supabase
      .from('merchant_settings')
      .insert({
        merchant_id: merchant.id,
      });

    return NextResponse.json({ merchant }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

