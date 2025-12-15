import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/promo-codes
 * Get promo codes (admin only) or validate a specific code
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);

    const code = searchParams.get('code');
    const isActive = searchParams.get('isActive') !== 'false';

    // If code is provided, validate it
    if (code) {
      const { data: promoCode, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !promoCode) {
        return NextResponse.json(
          { error: 'Invalid promo code', valid: false },
          { status: 404 }
        );
      }

      // Check if code is still valid
      const now = new Date();
      const validFrom = promoCode.valid_from ? new Date(promoCode.valid_from) : null;
      const validUntil = promoCode.valid_until ? new Date(promoCode.valid_until) : null;

      if (validFrom && now < validFrom) {
        return NextResponse.json(
          { error: 'Promo code is not yet valid', valid: false },
          { status: 400 }
        );
      }

      if (validUntil && now > validUntil) {
        return NextResponse.json(
          { error: 'Promo code has expired', valid: false },
          { status: 400 }
        );
      }

      if (promoCode.max_uses && promoCode.used_count >= promoCode.max_uses) {
        return NextResponse.json(
          { error: 'Promo code has reached maximum uses', valid: false },
          { status: 400 }
        );
      }

      return NextResponse.json({
        promoCode,
        valid: true,
      });
    }

    // Otherwise, get all promo codes (admin only - add auth check if needed)
    let query = supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    }

    const { data: promoCodes, error } = await query;

    if (error) {
      console.error('Error fetching promo codes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch promo codes', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ promoCodes: promoCodes || [] });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/promo-codes
 * Create a new promo code (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    const {
      code,
      description,
      discountType,
      discountValue,
      maxUses,
      minPurchaseAmount,
      maxDiscountAmount,
      validFrom,
      validUntil,
    } = body;

    if (!code || !discountType || !discountValue) {
      return NextResponse.json(
        { error: 'code, discountType, and discountValue are required' },
        { status: 400 }
      );
    }

    if (discountType !== 'percentage' && discountType !== 'fixed_amount') {
      return NextResponse.json(
        { error: 'discountType must be "percentage" or "fixed_amount"' },
        { status: 400 }
      );
    }

    if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
      return NextResponse.json(
        { error: 'Percentage discount must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Check if code already exists
    const { data: existing } = await supabase
      .from('promo_codes')
      .select('id')
      .eq('code', code.toUpperCase())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Promo code already exists' },
        { status: 409 }
      );
    }

    // Create promo code
    const promoCodeData: any = {
      code: code.toUpperCase(),
      description: description || null,
      discount_type: discountType,
      discount_value: discountValue,
      max_uses: maxUses || null,
      min_purchase_amount: minPurchaseAmount || null,
      max_discount_amount: maxDiscountAmount || null,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      is_active: true,
      used_count: 0,
    };

    const { data: promoCode, error } = await supabase
      .from('promo_codes')
      .insert(promoCodeData)
      .select()
      .single();

    if (error) {
      console.error('Error creating promo code:', error);
      return NextResponse.json(
        { error: 'Failed to create promo code', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { promoCode, message: 'Promo code created successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}


