import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';

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
 *     the no-show hold ~5 days before the tour.
 *
 * Failures (e.g. card declined, 3DS required) are logged and the booking
 * is flagged `payment_intent_status='failed'`. Future iterations should
 * email the customer with a re-confirmation link.
 *
 * Auth: Vercel Cron sets `Authorization: Bearer ${CRON_SECRET}`. We accept
 * that or a shared `?secret=` query for one-off manual triggers.
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
  if (header === `Bearer ${expected}`) return true;
  const querySecret = req.nextUrl.searchParams.get('secret');
  return querySecret === expected;
}

function ymdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
      id, tour_id, tour_date, final_price, no_show_fee_usd_cents,
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

    /** Compute the hold amount. Prefer the stored cents (immutable at booking time)
     *  over the live final_price (which may have changed for some reason). */
    let amountCents = booking.no_show_fee_usd_cents ? Number(booking.no_show_fee_usd_cents) : null;
    if (!amountCents && Number.isFinite(Number(booking.final_price))) {
      amountCents = Math.round(Number(booking.final_price) * 100);
    }
    if (!amountCents || amountCents <= 0) {
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

    try {
      const pi = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        capture_method: 'manual',
        customer: booking.stripe_customer_id as string,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        payment_method_types: ['card'],
        receipt_email: booking.contact_email ?? undefined,
        description: `No-show hold (re-auth): ${tourTitle} (booking ${booking.id})`,
        statement_descriptor_suffix: 'TOUR HOLD',
        metadata: {
          booking_id: booking.id,
          tour_id: String(booking.tour_id),
          kind: 'no_show_hold_reauth',
        },
      });

      const expiresAt = new Date(Date.now() + HOLD_VALIDITY_DAYS * MS_PER_DAY).toISOString();

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

  return NextResponse.json({ ok: true, ...summary });
}
