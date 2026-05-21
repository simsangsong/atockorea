import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { getMerchantProfileMap } from '@/lib/admin/merchant-profiles';

/**
 * GET /api/admin/merchants
 * Get all merchants (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    // Check admin authentication
    await requireAdmin(req);
    
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let query = supabase
      .from('merchants')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`company_name.ilike.%${search}%,contact_email.ilike.%${search}%,contact_person.ilike.%${search}%`);
    }

    const { data: merchants, error } = await query;

    if (error) {
      console.error('Error fetching merchants:', error);
      return NextResponse.json(
        { error: 'Failed to fetch merchants', details: error.message },
        { status: 500 }
      );
    }

    const merchantRows = merchants || [];
    const profileMap = await getMerchantProfileMap(
      supabase,
      merchantRows.map((merchant: any) => merchant.user_id),
    );
    const enrichedMerchants = merchantRows.map((merchant: any) => ({
      ...merchant,
      user_profiles: merchant.user_id ? profileMap.get(merchant.user_id) ?? null : null,
    }));

    return NextResponse.json({ merchants: enrichedMerchants });
  } catch (error: any) {
    console.error('Error fetching merchants:', error);
    
    if (error instanceof AdminAuthFailure) {
      return adminAuthJsonResponse(error);
    }

    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/merchants
 * Create a new merchant (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    // Check admin authentication
    await requireAdmin(req);
    
    const supabase = createServerClient();
    const body = await req.json();

    const {
      userId,
      companyName,
      businessRegistrationNumber,
      contactPerson,
      contactEmail,
      contactPhone,
      addressLine1,
      addressLine2,
      city,
      province,
      postalCode,
      country,
      createUser, // If true, create user account first
    } = body;

    if (!companyName || !contactPerson || !contactEmail || !contactPhone) {
      return NextResponse.json(
        { error: 'Missing required fields: companyName, contactPerson, contactEmail, contactPhone' },
        { status: 400 }
      );
    }

    let finalUserId = userId;
    let temporaryPassword: string | null = null;

    // Create user account if requested
    if (createUser && !userId) {
      // Generate temporary password
      temporaryPassword = `Temp${Math.random().toString(36).slice(-8)}!`;
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: contactEmail,
        password: temporaryPassword,
        email_confirm: true,
      });

      if (authError || !authData.user) {
        return NextResponse.json(
          { error: 'Failed to create user account', details: authError?.message },
          { status: 500 }
        );
      }

      finalUserId = authData.user.id;

      // Create user profile
      const { error: profileInsertError } = await supabase
        .from('user_profiles')
        .upsert({
          id: finalUserId,
          full_name: contactPerson,
          email: contactEmail,
          role: 'merchant',
        }, { onConflict: 'id' });

      if (profileInsertError) {
        return NextResponse.json(
          { error: 'Failed to create user profile', details: profileInsertError.message },
          { status: 500 }
        );
      }
    } else if (userId) {
      // Check if user exists
      const { data: user } = await supabase.auth.admin.getUserById(userId);
      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Either userId or createUser must be provided' },
        { status: 400 }
      );
    }

    // Create merchant
    const { data: merchant, error } = await supabase
      .from('merchants')
      .insert({
        user_id: finalUserId,
        company_name: companyName,
        business_registration_number: businessRegistrationNumber || null,
        contact_person: contactPerson,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        address_line1: addressLine1 || null,
        address_line2: addressLine2 || null,
        city: city || null,
        province: province || null,
        postal_code: postalCode || null,
        country: country || 'South Korea',
        status: 'pending',
        is_verified: false,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating merchant:', error);
      return NextResponse.json(
        { error: 'Failed to create merchant', details: error.message },
        { status: 500 }
      );
    }

    // Update user profile role to merchant
    await supabase
      .from('user_profiles')
      .update({ role: 'merchant', email: contactEmail })
      .eq('id', finalUserId);

    const profileMap = await getMerchantProfileMap(supabase, [merchant.user_id]);
    const merchantWithProfile = {
      ...merchant,
      user_profiles: merchant.user_id ? profileMap.get(merchant.user_id) ?? null : null,
    };

    // Send welcome email with login credentials
    if (createUser && temporaryPassword) {
      try {
        const { sendMerchantWelcomeEmail } = await import('@/lib/email');
        await sendMerchantWelcomeEmail({
          to: contactEmail,
          companyName: companyName,
          contactPerson: contactPerson,
          loginEmail: contactEmail,
          temporaryPassword: temporaryPassword,
          loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com'}/merchant/login`,
        });
      } catch (emailError) {
        // Log error but don't fail merchant creation
        console.error('Error sending welcome email:', emailError);
      }
    }

    return NextResponse.json(
      { merchant: merchantWithProfile, message: 'Merchant created successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating merchant:', error);
    
    if (error instanceof AdminAuthFailure) {
      return adminAuthJsonResponse(error);
    }

    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
