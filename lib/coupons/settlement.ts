// Service-role helpers for coupon settlement — the redemption/grant transitions
// that follow the BOOKING lifecycle (not the PI lifecycle; a PI can be
// cancel-and-recreated on checkout retry without the coupon moving).
//
// pending → captured  : PI captured (webhook `payment_intent.succeeded`,
//                       admin settle capture, offline collection)
// pending → released  : booking cancelled (customer/admin), hold released by
//                       admin, or the 24h abandoned-booking sweep
//
// A released grant restores to `active` when still inside its validity window
// (restore-by-default — losing the coupon to a failed booking causes churn),
// else `expired`. All helpers are idempotent: transitions are guarded on the
// current status, so webhook/admin double-fires are no-ops.

import type { createServerClient } from '@/lib/supabase';

type ServiceClient = ReturnType<typeof createServerClient>;

export interface PendingRedemption {
  id: string;
  grant_id: string;
  promo_code_id: string;
  booking_id: string;
  payment_intent_id: string | null;
  discount_minor: number;
  subtotal_minor: number;
  final_minor: number;
  currency: string;
  code?: string | null;
}

/** The booking's pending redemption (with code) — for PI metadata + checkout badge. */
export async function getPendingCouponRedemption(
  supabase: ServiceClient,
  bookingId: string,
): Promise<PendingRedemption | null> {
  try {
    const { data, error } = await supabase
      .from('coupon_redemptions')
      .select(
        'id, grant_id, promo_code_id, booking_id, payment_intent_id, discount_minor, subtotal_minor, final_minor, currency, promo_codes ( code )',
      )
      .eq('booking_id', bookingId)
      .eq('status', 'pending')
      .maybeSingle();
    if (error || !data) return null;
    const promo = Array.isArray(data.promo_codes) ? data.promo_codes[0] : data.promo_codes;
    return { ...(data as unknown as PendingRedemption), code: promo?.code ?? null };
  } catch (err) {
    console.error('[coupons] getPendingCouponRedemption failed:', err);
    return null;
  }
}

/** Record the (re)minted PaymentIntent on the booking's pending redemption. */
export async function attachPaymentIntentToCouponRedemption(
  supabase: ServiceClient,
  bookingId: string,
  paymentIntentId: string,
): Promise<void> {
  try {
    await supabase
      .from('coupon_redemptions')
      .update({ payment_intent_id: paymentIntentId })
      .eq('booking_id', bookingId)
      .eq('status', 'pending');
  } catch (err) {
    console.error('[coupons] attachPaymentIntentToCouponRedemption failed:', err);
  }
}

/** Capture happened → redemption captured, grant redeemed. Idempotent. */
export async function redeemCouponForBooking(
  supabase: ServiceClient,
  bookingId: string,
): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    const { data: redeemed, error } = await supabase
      .from('coupon_redemptions')
      .update({ status: 'captured', settled_at: nowIso })
      .eq('booking_id', bookingId)
      .eq('status', 'pending')
      .select('grant_id');
    if (error || !redeemed || redeemed.length === 0) return; // no pending redemption (or already settled)

    await supabase
      .from('coupon_grants')
      .update({ status: 'redeemed', redeemed_at: nowIso, updated_at: nowIso })
      .eq('id', redeemed[0]!.grant_id)
      .eq('status', 'locked');
  } catch (err) {
    console.error('[coupons] redeemCouponForBooking failed:', err);
  }
}

/**
 * Booking died (cancelled / hold released / abandoned) → redemption released,
 * grant restored to `active` if still valid, else `expired`. Idempotent.
 */
export async function releaseCouponForBooking(
  supabase: ServiceClient,
  bookingId: string,
  reason: string,
): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    const { data: released, error } = await supabase
      .from('coupon_redemptions')
      .update({ status: 'released', settled_at: nowIso })
      .eq('booking_id', bookingId)
      .eq('status', 'pending')
      .select('grant_id');
    if (error || !released || released.length === 0) return;

    await restoreGrant(supabase, released[0]!.grant_id, nowIso);
    console.log(`[coupons] released coupon for booking ${bookingId} (${reason})`);
  } catch (err) {
    console.error('[coupons] releaseCouponForBooking failed:', err);
  }
}

/** locked → active (inside validity window) | expired (window passed). */
async function restoreGrant(supabase: ServiceClient, grantId: string, nowIso: string) {
  const { data: grant } = await supabase
    .from('coupon_grants')
    .select('id, expires_at, status')
    .eq('id', grantId)
    .maybeSingle();
  if (!grant || grant.status !== 'locked') return;

  const stillValid = !grant.expires_at || new Date(grant.expires_at).getTime() > Date.now();
  await supabase
    .from('coupon_grants')
    .update({
      status: stillValid ? 'active' : 'expired',
      locked_booking_id: null,
      updated_at: nowIso,
    })
    .eq('id', grantId)
    .eq('status', 'locked');
}

const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Sweep for the daily cron: a coupon locked to a booking that was created >24h
 * ago and never reached checkout (status AND payment_status still 'pending',
 * or already dead) is released so the customer can reuse it. Confirmed
 * >7-day bookings (payment_status='pending' but status='confirmed', waiting on
 * the re-auth cron) are deliberately NOT swept. Also restores grants stuck in
 * `locked` with no booking attached (a failed revert).
 */
export async function sweepAbandonedCouponLocks(
  supabase: ServiceClient,
): Promise<{ released: number; orphansRestored: number }> {
  const summary = { released: 0, orphansRestored: 0 };
  try {
    const cutoffIso = new Date(Date.now() - ABANDON_AFTER_MS).toISOString();
    const nowIso = new Date().toISOString();

    const { data: stale } = await supabase
      .from('coupon_redemptions')
      .select('booking_id, created_at, bookings!inner ( status, payment_status )')
      .eq('status', 'pending')
      .lt('created_at', cutoffIso);

    for (const row of stale ?? []) {
      const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings;
      if (!booking) continue;
      const dead = ['cancelled', 'expired'].includes(String(booking.status));
      const neverCheckedOut =
        booking.status === 'pending' && booking.payment_status === 'pending';
      if (dead || neverCheckedOut) {
        await releaseCouponForBooking(
          supabase,
          String(row.booking_id),
          dead ? 'sweep_dead_booking' : 'sweep_abandoned_booking',
        );
        summary.released += 1;
      }
    }

    // Orphaned locks: claimed but the booking insert failed AND the revert
    // also failed. No redemption row exists, locked_booking_id is null.
    const { data: orphans } = await supabase
      .from('coupon_grants')
      .select('id, expires_at')
      .eq('status', 'locked')
      .is('locked_booking_id', null)
      .lt('updated_at', cutoffIso);

    for (const grant of orphans ?? []) {
      const stillValid = !grant.expires_at || new Date(grant.expires_at).getTime() > Date.now();
      await supabase
        .from('coupon_grants')
        .update({
          status: stillValid ? 'active' : 'expired',
          locked_booking_id: null,
          updated_at: nowIso,
        })
        .eq('id', grant.id)
        .eq('status', 'locked');
      summary.orphansRestored += 1;
    }
  } catch (err) {
    console.error('[coupons] sweepAbandonedCouponLocks failed:', err);
  }
  return summary;
}
