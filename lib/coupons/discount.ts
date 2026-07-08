// Pure coupon discount math — currency-aware rounding for the two booking
// currencies (USD tour-product = 2-decimal, KRW itinerary-builder = zero-decimal).
// All "major" amounts match the numeric `bookings.final_price` column; all
// "minor" amounts match Stripe (cents / whole won). Golden-tested in
// __tests__/lib/coupons/discount.test.ts.

import { isZeroDecimalCurrency } from '@/lib/payments/refund';

export type BookingCurrency = 'usd' | 'krw';

export interface CouponDefinition {
  /** promo_codes.discount_type — existing table uses 'percentage' | 'fixed_amount'. */
  discountType: string;
  discountValue: number;
  /** Legacy promo_codes column, dollar-denominated → applied only to USD bookings. */
  maxDiscountAmount?: number | null;
  /** Legacy promo_codes column, dollar-denominated → enforced only on USD bookings. */
  minPurchaseAmount?: number | null;
}

export interface DiscountBreakdown {
  currency: BookingCurrency;
  subtotalMajor: number;
  discountMajor: number;
  finalMajor: number;
  subtotalMinor: number;
  discountMinor: number;
  finalMinor: number;
}

/** Round a major-unit amount to the currency's precision (KRW → whole won, USD → cents). */
export function roundMajor(amount: number, currency: string): number {
  return isZeroDecimalCurrency(currency) ? Math.round(amount) : Math.round(amount * 100) / 100;
}

/** Convert a major-unit amount to Stripe minor units (KRW ×1, USD ×100). */
export function majorToMinor(amountMajor: number, currency: string): number {
  return isZeroDecimalCurrency(currency)
    ? Math.round(amountMajor)
    : Math.round(amountMajor * 100);
}

/**
 * Compute the discount a coupon yields on a booking subtotal.
 *
 * Returns `null` when the coupon cannot apply (below min purchase, non-positive
 * result, fixed-amount coupon on a non-USD booking, unknown type) — callers
 * treat `null` as "book at full price", never as an error.
 */
export function computeCouponDiscount(opts: {
  subtotalMajor: number;
  currency: BookingCurrency;
  coupon: CouponDefinition;
}): DiscountBreakdown | null {
  const { subtotalMajor, currency, coupon } = opts;
  if (!Number.isFinite(subtotalMajor) || subtotalMajor <= 0) return null;

  // min_purchase_amount is dollar-denominated (legacy promo_codes semantics) —
  // enforce on USD bookings only. WELCOME10 ships with min=0 so KRW is unaffected.
  if (
    currency === 'usd' &&
    coupon.minPurchaseAmount != null &&
    subtotalMajor < Number(coupon.minPurchaseAmount)
  ) {
    return null;
  }

  let rawDiscount: number;
  if (coupon.discountType === 'percentage') {
    const pct = Number(coupon.discountValue);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
    rawDiscount = (subtotalMajor * pct) / 100;
  } else if (coupon.discountType === 'fixed_amount') {
    // fixed_amount is dollar-denominated — USD bookings only.
    if (currency !== 'usd') return null;
    rawDiscount = Number(coupon.discountValue);
    if (!Number.isFinite(rawDiscount) || rawDiscount <= 0) return null;
  } else {
    return null;
  }

  // max_discount_amount cap — dollar-denominated, USD only (same legacy caveat).
  if (currency === 'usd' && coupon.maxDiscountAmount != null) {
    rawDiscount = Math.min(rawDiscount, Number(coupon.maxDiscountAmount));
  }

  const discountMajor = roundMajor(Math.min(rawDiscount, subtotalMajor), currency);
  const finalMajor = roundMajor(subtotalMajor - discountMajor, currency);
  // A discount that zeroes (or floors past) the price is refused — Stripe can't
  // hold a 0-amount PI and a free booking is never the welcome-coupon intent.
  if (discountMajor <= 0 || finalMajor <= 0) return null;

  return {
    currency,
    subtotalMajor: roundMajor(subtotalMajor, currency),
    discountMajor,
    finalMajor,
    subtotalMinor: majorToMinor(subtotalMajor, currency),
    discountMinor: majorToMinor(discountMajor, currency),
    finalMinor: majorToMinor(finalMajor, currency),
  };
}
