import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireMerchant } from '@/lib/auth';

/**
 * GET /api/merchant/settings
 * Get merchant settings
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireMerchant(req);
    const merchantId = user.merchantId;
    
    if (!merchantId) {
      return NextResponse.json(
        { error: 'User is not associated with a merchant' },
        { status: 403 }
      );
    }

    const supabase = createServerClient();

    // Get merchant info
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Get merchant settings
    const { data: settings, error: settingsError } = await supabase
      .from('merchant_settings')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();

    // If settings don't exist, create default
    let merchantSettings = settings;
    if (settingsError && settingsError.code === 'PGRST116') {
      const { data: newSettings } = await supabase
        .from('merchant_settings')
        .insert({ merchant_id: merchantId })
        .select()
        .single();
      merchantSettings = newSettings;
    }

    return NextResponse.json({
      merchant: {
        company_name: merchant.company_name,
        contact_email: merchant.contact_email,
        contact_phone: merchant.contact_phone,
        bank_name: merchant.bank_name,
        bank_account_number: merchant.bank_account_number,
        account_holder_name: merchant.account_holder_name,
      },
      settings: merchantSettings || {},
    });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/merchant/settings
 * Update merchant settings
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireMerchant(req);
    const merchantId = user.merchantId;
    
    if (!merchantId) {
      return NextResponse.json(
        { error: 'User is not associated with a merchant' },
        { status: 403 }
      );
    }

    const supabase = createServerClient();
    const body = await req.json();

    // Separate merchant info and settings
    const { merchant, settings } = body;

    // Update merchant info
    if (merchant) {
      const { error: merchantError } = await supabase
        .from('merchants')
        .update(merchant)
        .eq('id', merchantId);

      if (merchantError) {
        return NextResponse.json(
          { error: merchantError.message },
          { status: 400 }
        );
      }
    }

    // Update or create settings
    if (settings) {
      const { error: settingsError } = await supabase
        .from('merchant_settings')
        .upsert({
          merchant_id: merchantId,
          ...settings,
        }, {
          onConflict: 'merchant_id',
        });

      if (settingsError) {
        return NextResponse.json(
          { error: settingsError.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

