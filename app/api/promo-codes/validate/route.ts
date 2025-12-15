import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/promo-codes/validate
 * Validate and calculate discount for a promo code
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    const { code, purchaseAmount, userId } = body;

    if (!code || !purchaseAmount) {
      return NextResponse.json(
        { error: 'code and purchaseAmount are required' },
        { status: 400 }
      );
    }

    // Get promo code
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

    // Validate dates
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

    // Check max uses
    if (promoCode.max_uses && promoCode.used_count >= promoCode.max_uses) {
      return NextResponse.json(
        { error: 'Promo code has reached maximum uses', valid: false },
        { status: 400 }
      );
    }

    // Check min purchase amount
    if (promoCode.min_purchase_amount && purchaseAmount < parseFloat(promoCode.min_purchase_amount.toString())) {
      return NextResponse.json(
        {
          error: `Minimum purchase amount is $${promoCode.min_purchase_amount}`,
          valid: false,
          minPurchaseAmount: parseFloat(promoCode.min_purchase_amount.toString()),
        },
        { status: 400 }
      );
    }

    // Calculate discount
    let discountAmount = 0;
    if (promoCode.discount_type === 'percentage') {
      discountAmount = (purchaseAmount * parseFloat(promoCode.discount_value.toString())) / 100;
    } else {
      discountAmount = parseFloat(promoCode.discount_value.toString());
    }

    // Apply max discount limit
    if (promoCode.max_discount_amount) {
      discountAmount = Math.min(discountAmount, parseFloat(promoCode.max_discount_amount.toString()));
    }

    const finalAmount = Math.max(0, purchaseAmount - discountAmount);

    return NextResponse.json({
      valid: true,
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        discountType: promoCode.discount_type,
        discountValue: parseFloat(promoCode.discount_value.toString()),
      },
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      originalAmount: purchaseAmount,
      finalAmount: parseFloat(finalAmount.toFixed(2)),
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}



