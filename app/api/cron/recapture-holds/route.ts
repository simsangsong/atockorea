import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';
import {
  getPendingCouponRedemption,
  attachPaymentIntentToCouponRedemption,
  sweepAbandonedCouponLocks,
} from '@/lib/coupons/settlement';

/**
 * GET /api/cron/recapture-holds
 *
 * Daily cron (Vercel Cron) that closes the gap left by Stripe's 7-day
 * manual-capture authorization window:
 *
 *   - When a tour is > 7 days away, `/api/stripe/checkout` skips the
 *     immediate PaymentIntent and instead vaults the card via SetupIntent.
 *   - This cron runs daily and finds bookings whose tour_date is now within
 *     the next REAUTH_WINDOW_DAYS days but still has no PaymentIntent.
 *   - For each, it creates an off-session PaymentIntent with
 *     `capture_method: 'manual'` using the saved payment method, placing
 *     the tour-day auto-charge authorization ~5 days before the tour.
 *
 * Failures (e.g. card declined, 3DS required) are logged and the booking
 * is flagged `payment_intent_status='failed'`. Future iterations should
 * email the customer with a re-confirmation link.
 *
 * Auth: Vercel Cron sets `Authorization: Bearer ${CRON_SECRET}`. Only that
 * header is accepted — no `?secret=` query fallback (W-3: query strings leak via
 * logs/Referer and would let anyone trigger off-session charges).
 */

const REAUTH_WINDOW_DAYS = 6; // Run when tour is ≤ 6 days away (one buffer day below Stripe's 7-day cap)
const HOLD_VALIDITY_DAYS = 7;
const MS_PER_DAY = 86400000;

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key, { apiVersion: '2025-11-17.clover' });
};

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${expected}`;
}

function ymdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Email the customer that the card on file couldn't be re-authorized before
 * their upcoming tour. Only sent on the *first* transition to `failed` (the
 * cron retries daily and would otherwise spam them). Fails open.
 */
async function notifyReauthFailed(booking: {
  id: string;
  payment_intent_status?: string | null;
  contact_email?: string | null;
  contact_name?: string | null;
  tour_date?: string | null;
  tours?: unknown;
}) {
  if (booking.payment_intent_status === 'failed') return; // already notified on a prior run
  if (!booking.contact_email) return;
  const tour = (Array.isArray(booking.tours) ? booking.tours[0] : booking.tours) as
    | { title?: string }
    | null;
  try {
    const { sendCardReauthFailedEmail } = await import('@/lib/email');
    await sendCardReauthFailedEmail({
      to: booking.contact_email,
      customerName: booking.contact_name ?? 'Guest',
      bookingId: booking.id,
      tourTitle: tour?.title ?? 'Your tour',
      tourDate: booking.tour_date ?? undefined,
    });
  } catch (err) {
    console.error(`[recapture-holds] booking ${booking.id} reauth-failed email error:`, err);
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const supabase = createServerClient();
  const stripe = getStripe();

  /** Window: tour_date in [today, today + REAUTH_WINDOW_DAYS] AND payment_intent_id IS NULL
   *  AND status='confirmed' (SetupIntent succeeded) AND stripe_customer_id IS NOT NULL. */
  const today = new Date();
  const todayYmd = ymdUtc(today);
  const cutoffYmd = ymdUtc(new Date(today.getTime() + REAUTH_WINDOW_DAYS * MS_PER_DAY));

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(
      `
      id, tour_id, tour_date, final_price, currency, source, no_show_fee_usd_cents,
      stripe_customer_id, stripe_payment_method_id, contact_email, contact_name,
      payment_intent_id, payment_intent_status, card_collection_method, status,
      tours ( title )
    `,
    )
    .eq('status', 'confirmed')
    .eq('card_collection_method', 'setup_intent_then_hold')
    .is('payment_intent_id', null)
    .gte('tour_date', todayYmd)
    .lte('tour_date', cutoffYmd);

  if (error) {
    console.error('[recapture-holds] query error:', error);
    return NextResponse.json({ error: 'DB query failed', details: error.message }, { status: 500 });
  }

  const summary = {
    scanned: bookings?.length ?? 0,
    authorized: 0,
    requires_action: 0,
    failed: 0,
    skipped: 0,
  };

  for (const booking of bookings ?? []) {
    if (!booking.stripe_customer_id) {
      summary.skipped += 1;
      continue;
    }

    /**
     * Compute the hold amount in the booking's minor units. USD final_price is
     * two-decimal (× 100 → cents); KRW final_price is whole won already (× 1).
     * For USD we prefer the immutable `no_show_fee_usd_cents` snapshot taken
     * at booking time. For KRW we always derive from `final_price` (the snapshot
     * column is USD-only and is NULL for KRW bookings).
     * Phase 10 D16 — see /api/stripe/checkout.
     */
    const holdCurrency: 'usd' | 'krw' =
      (booking as { currency?: string }).currency === 'krw' ? 'krw' : 'usd';
    let amountMinor: number | null = null;
    if (holdCurrency === 'usd') {
      amountMinor = booking.no_show_fee_usd_cents
        ? Number(booking.no_show_fee_usd_cents)
        : Number.isFinite(Number(booking.final_price))
          ? Math.round(Number(booking.final_price) * 100)
          : null;
    } else {
      amountMinor = Number.isFinite(Number(booking.final_price))
        ? Math.round(Number(booking.final_price))
        : null;
    }
    if (!amountMinor || amountMinor <= 0) {
      summary.skipped += 1;
      continue;
    }

    /** Resolve the saved payment method. Fall back to the customer's default
     *  payment method or the most recently attached card. */
    let paymentMethodId = booking.stripe_payment_method_id as string | null;
    if (!paymentMethodId) {
      try {
        const methods = await stripe.paymentMethods.list({
          customer: booking.stripe_customer_id as string,
          type: 'card',
          limit: 1,
        });
        paymentMethodId = methods.data[0]?.id ?? null;
      } catch (err) {
        console.error(`[recapture-holds] booking ${booking.id} payment method lookup failed:`, err);
      }
    }
    if (!paymentMethodId) {
      console.warn(`[recapture-holds] booking ${booking.id} has no saved payment method`);
      await notifyReauthFailed(booking);
      await supabase
        .from('bookings')
        .update({
          payment_intent_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);
      summary.failed += 1;
      continue;
    }

    const tour = Array.isArray(booking.tours) ? booking.tours[0] : booking.tours;
    const tourTitle = (tour as { title?: string } | null)?.title ?? 'Tour';
    const isBuilder = (booking as { source?: string }).source === 'itinerary_builder';
    const description = isBuilder
      ? `Custom itinerary auto charge authorization (re-auth, booking ${booking.id})`
      : `Tour-day auto charge authorization (re-auth): ${tourTitle} (booking ${booking.id})`;
    const piMetadata: Record<string, string> = {
      booking_id: booking.id,
      kind: 'tour_day_auto_charge_reauth',
    };
    if (booking.tour_id != null) piMetadata.tour_id = String(booking.tour_id);
    if (isBuilder) piMetadata.source = 'itinerary_builder';

    /** Welcome coupon: the discount is already inside final_price /
     *  no_show_fee_usd_cents (both snapshotted post-discount) — mirror it into
     *  PI metadata and remember the PI id on the redemption ledger row. */
    const couponRedemption = await getPendingCouponRedemption(supabase, booking.id);
    if (couponRedemption) {
      piMetadata.promo_code = couponRedemption.code ?? '';
      piMetadata.coupon_grant_id = couponRedemption.grant_id;
      piMetadata.coupon_discount_minor = String(couponRedemption.discount_minor);
    }

    try {
      const pi = await stripe.paymentIntents.create({
        amount: amountMinor,
        currency: holdCurrency,
        capture_method: 'manual',
        customer: booking.stripe_customer_id as string,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        payment_method_types: ['card'],
        receipt_email: booking.contact_email ?? undefined,
        description,
        statement_descriptor_suffix: 'TOUR HOLD',
        metadata: piMetadata,
      });

      const expiresAt = new Date(Date.now() + HOLD_VALIDITY_DAYS * MS_PER_DAY).toISOString();

      if (couponRedemption) {
        await attachPaymentIntentToCouponRedemption(supabase, booking.id, pi.id);
      }

      await supabase
        .from('bookings')
        .update({
          payment_intent_id: pi.id,
          payment_intent_status:
            pi.status === 'requires_capture' ? 'authorized' : 'auth_pending',
          payment_status: pi.status === 'requires_capture' ? 'authorized' : 'pending',
          authorization_expires_at: expiresAt,
          payment_reference: pi.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      summary.authorized += 1;
      console.log(`[recapture-holds] booking ${booking.id} hold placed (${pi.status})`);
    } catch (err: unknown) {
      /** off-session PI can return { code: 'authentication_required' } when the issuer
       *  demands 3DS — we can't satisfy that from a cron, so flag for follow-up. */
      const stripeErr = err as { code?: string; raw?: { code?: string } };
      const code = stripeErr?.code ?? stripeErr?.raw?.code;
      if (code === 'authentication_required') {
        await notifyReauthFailed(booking);
        await supabase
          .from('bookings')
          .update({
            payment_intent_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.id);
        summary.requires_action += 1;
        console.warn(
          `[recapture-holds] booking ${booking.id} requires 3DS — customer follow-up needed`,
        );
        continue;
      }

      await notifyReauthFailed(booking);
      await supabase
        .from('bookings')
        .update({
          payment_intent_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);
      summary.failed += 1;
      console.error(`[recapture-holds] booking ${booking.id} re-auth failed:`, err);
    }
  }

  /** Welcome coupon housekeeping: restore coupons locked to bookings that were
   *  abandoned before checkout (>24h old, still pending/pending) or died. */
  const couponSweep = await sweepAbandonedCouponLocks(supabase);

  return NextResponse.json({ ok: true, ...summary, couponSweep });
}
