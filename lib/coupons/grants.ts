// Service-role helpers for the coupon-grant lifecycle at BOOKING CREATION time.
//
// Card-on-file hold model (see docs/welcome-coupon-master-plan-2026-07-08.md §D):
// the PaymentIntent amount derives from `bookings.final_price`, and for >7-day
// bookings the PI is only minted by the recapture cron — so the coupon locks
// (and the discount bakes into final_price) when the booking row is created,
// NOT when a PI is created. Settlement transitions live in ./settlement.ts.
//
// Every helper fails OPEN to full price: a coupon error must never block a booking.

import type { createServerClient } from '@/lib/supabase';
import {
  computeCouponDiscount,
  type BookingCurrency,
  type DiscountBreakdown,
} from './discount';

type ServiceClient = ReturnType<typeof createServerClient>;

export interface ClaimedCoupon {
  grantId: string;
  promoCodeId: string;
  code: string;
  breakdown: DiscountBreakdown;
}

interface GrantRow {
  id: string;
  promo_code_id: string;
  expires_at: string | null;
  promo_codes: {
    id: string;
    code: string;
    is_active: boolean;
    discount_type: string;
    discount_value: number;
    max_discount_amount: number | null;
    min_purchase_amount: number | null;
    valid_from: string | null;
    valid_until: string | null;
    first_purchase_only: boolean;
  } | null;
}

/**
 * Claim (lock) the signed-in user's best active coupon grant for a new booking.
 *
 * Race-safe: the final lock is a single conditional UPDATE guarded on
 * `status='active'` — two concurrent bookings can both see the grant, but only
 * one wins the claim; the loser books at full price.
 *
 * Returns `null` when there is nothing to apply (no grant, expired, code
 * inactive, first-purchase rule failed, discount rounds to zero, any error).
 */
export async function claimCouponForBooking(
  supabase: ServiceClient,
  opts: { userId: string; currency: BookingCurrency; subtotalMajor: number },
): Promise<ClaimedCoupon | null> {
  try {
    const { userId, currency, subtotalMajor } = opts;

    const { data: grants, error } = await supabase
      .from('coupon_grants')
      .select(
        `
        id, promo_code_id, expires_at,
        promo_codes (
          id, code, is_active, discount_type, discount_value,
          max_discount_amount, min_purchase_amount,
          valid_from, valid_until, first_purchase_only
        )
      `,
      )
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error || !grants || grants.length === 0) return null;

    const now = Date.now();
    type Candidate = { grant: GrantRow; breakdown: DiscountBreakdown };
    const candidates: Candidate[] = [];
    let needsFirstPurchaseCheck = false;

    for (const raw of grants as unknown as GrantRow[]) {
      const code = Array.isArray(raw.promo_codes) ? raw.promo_codes[0] : raw.promo_codes;
      if (!code || !code.is_active) continue;
      if (raw.expires_at && new Date(raw.expires_at).getTime() <= now) continue;
      if (code.valid_from && new Date(code.valid_from).getTime() > now) continue;
      if (code.valid_until && new Date(code.valid_until).getTime() <= now) continue;

      const breakdown = computeCouponDiscount({
        subtotalMajor,
        currency,
        coupon: {
          discountType: code.discount_type,
          discountValue: Number(code.discount_value),
          maxDiscountAmount: code.max_discount_amount,
          minPurchaseAmount: code.min_purchase_amount,
        },
      });
      if (!breakdown) continue;

      if (code.first_purchase_only) needsFirstPurchaseCheck = true;
      candidates.push({ grant: { ...raw, promo_codes: code }, breakdown });
    }
    if (candidates.length === 0) return null;

    // first_purchase_only — a prior booking that reached authorized/paid
    // disqualifies (cancelled or never-checked-out bookings don't count).
    let hasPriorPurchase = false;
    if (needsFirstPurchaseCheck) {
      const { data: prior } = await supabase
        .from('bookings')
        .select('id')
        .eq('user_id', userId)
        .in('payment_status', ['authorized', 'paid'])
        .limit(1);
      hasPriorPurchase = !!prior && prior.length > 0;
    }

    const eligible = candidates.filter(
      (c) => !(c.grant.promo_codes!.first_purchase_only && hasPriorPurchase),
    );
    if (eligible.length === 0) return null;

    // Best coupon for the customer = biggest discount.
    eligible.sort((a, b) => b.breakdown.discountMajor - a.breakdown.discountMajor);
    const chosen = eligible[0]!;

    // Atomic claim — only transitions active→locked; a raced grant yields 0 rows.
    const { data: locked, error: lockError } = await supabase
      .from('coupon_grants')
      .update({ status: 'locked', updated_at: new Date().toISOString() })
      .eq('id', chosen.grant.id)
      .eq('status', 'active')
      .select('id');

    if (lockError || !locked || locked.length === 0) return null;

    return {
      grantId: chosen.grant.id,
      promoCodeId: chosen.grant.promo_code_id,
      code: chosen.grant.promo_codes!.code,
      breakdown: chosen.breakdown,
    };
  } catch (err) {
    console.error('[coupons] claimCouponForBooking failed (booking proceeds at full price):', err);
    return null;
  }
}

/**
 * Bind a claimed grant to the inserted booking: writes the `coupon_redemptions`
 * ledger row and points the grant at the booking. Returns false on failure so
 * the caller can strip the discount + revert the claim.
 */
export async function attachCouponClaimToBooking(
  supabase: ServiceClient,
  claim: ClaimedCoupon,
  opts: { bookingId: string; userId: string },
): Promise<boolean> {
  try {
    const { error: redemptionError } = await supabase.from('coupon_redemptions').insert({
      grant_id: claim.grantId,
      promo_code_id: claim.promoCodeId,
      user_id: opts.userId,
      booking_id: opts.bookingId,
      subtotal_major: claim.breakdown.subtotalMajor,
      discount_major: claim.breakdown.discountMajor,
      final_major: claim.breakdown.finalMajor,
      subtotal_minor: claim.breakdown.subtotalMinor,
      discount_minor: claim.breakdown.discountMinor,
      final_minor: claim.breakdown.finalMinor,
      currency: claim.breakdown.currency,
      status: 'pending',
    });
    if (redemptionError) {
      console.error('[coupons] redemption insert failed:', redemptionError);
      return false;
    }

    const { error: grantError } = await supabase
      .from('coupon_grants')
      .update({ locked_booking_id: opts.bookingId, updated_at: new Date().toISOString() })
      .eq('id', claim.grantId)
      .eq('status', 'locked');
    if (grantError) {
      // Ledger row exists and is the source of truth for settlement — log only.
      console.error('[coupons] grant locked_booking_id update failed:', grantError);
    }
    return true;
  } catch (err) {
    console.error('[coupons] attachCouponClaimToBooking failed:', err);
    return false;
  }
}

/** Undo a claim whose booking never materialized (insert failed / attach failed). */
export async function revertCouponClaim(
  supabase: ServiceClient,
  grantId: string,
): Promise<void> {
  try {
    await supabase
      .from('coupon_grants')
      .update({
        status: 'active',
        locked_booking_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', grantId)
      .eq('status', 'locked');
  } catch (err) {
    // The abandoned-lock sweep (cron) restores stuck grants within 24h.
    console.error('[coupons] revertCouponClaim failed (sweep will recover):', err);
  }
}
