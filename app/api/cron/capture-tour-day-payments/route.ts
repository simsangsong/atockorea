import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/capture-tour-day-payments
 *
 * Captures authorized Stripe card holds on the tour date at 10:00 AM Korea time.
 * This is the actual collection step for card-on-file bookings: the customer
 * is not charged at booking time, but the authorized amount is collected after
 * the morning pickup window has passed.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const CAPTURE_HOUR_KST = 10;

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key, { apiVersion: '2025-11-17.clover' });
};

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  // Only the Authorization header is accepted — no `?secret=` query fallback
  // (W-3: query strings leak via logs/Referer and would let anyone trigger
  // off-session charges). Vercel Cron sets `Authorization: Bearer ${CRON_SECRET}`.
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${expected}`;
}

function nowInKst(): Date {
  return new Date(Date.now() + KST_OFFSET_MS);
}

function ymdKst(date = new Date()): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function currentKstHour(): number {
  return nowInKst().getUTCHours();
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const force = req.nextUrl.searchParams.get('force') === '1';
  const targetDate = req.nextUrl.searchParams.get('date') || ymdKst();
  const hourKst = currentKstHour();
  if (!force && hourKst < CAPTURE_HOUR_KST) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'before_10am_kst',
      hourKst,
      targetDate,
    });
  }

  const supabase = createServerClient();
  const stripe = getStripe();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(
      `
      id, booking_reference, tour_id, tour_date, booking_date, status,
      payment_method, payment_status, payment_intent_status, payment_intent_id,
      final_price, no_show_fee_usd_cents, contact_email,
      tours ( title )
    `,
    )
    .eq('status', 'confirmed')
    .eq('payment_method', 'stripe')
    .eq('payment_status', 'authorized')
    .eq('payment_intent_status', 'authorized')
    .not('payment_intent_id', 'is', null)
    .or(`tour_date.eq.${targetDate},booking_date.eq.${targetDate}`);

  if (error) {
    console.error('[capture-tour-day-payments] query error:', error);
    return NextResponse.json({ error: 'DB query failed', details: error.message }, { status: 500 });
  }

  const summary = {
    targetDate,
    hourKst,
    scanned: bookings?.length ?? 0,
    captured: 0,
    alreadyCaptured: 0,
    skipped: 0,
    failed: 0,
    failures: [] as Array<{ bookingId: string; reason: string }>,
  };

  for (const booking of bookings ?? []) {
    const piId = booking.payment_intent_id as string | null;
    if (!piId) {
      summary.skipped += 1;
      continue;
    }

    let pi: Stripe.PaymentIntent;
    try {
      pi = await stripe.paymentIntents.retrieve(piId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      summary.failed += 1;
      summary.failures.push({ bookingId: booking.id, reason });
      console.error(`[capture-tour-day-payments] retrieve failed booking=${booking.id}:`, error);
      continue;
    }

    const paidAt = new Date().toISOString();
    if (pi.status === 'succeeded') {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          payment_intent_status: 'captured',
          paid_at: paidAt,
          updated_at: paidAt,
        })
        .eq('id', booking.id);

      if (updateError) {
        summary.failed += 1;
        summary.failures.push({ bookingId: booking.id, reason: updateError.message });
      } else {
        summary.alreadyCaptured += 1;
      }
      continue;
    }

    if (pi.status !== 'requires_capture') {
      summary.skipped += 1;
      summary.failures.push({ bookingId: booking.id, reason: `not_capturable_${pi.status}` });
      continue;
    }

    try {
      const captured = await stripe.paymentIntents.capture(
        piId,
        {
          metadata: {
            ...pi.metadata,
            settle_reason: 'tour_day_auto_capture_10_kst',
          },
        },
        {
          idempotencyKey: `tour-day-auto-capture-${booking.id}-${targetDate}`,
        },
      );

      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          payment_intent_status: 'captured',
          payment_method: 'stripe',
          paid_at: paidAt,
          updated_at: paidAt,
        })
        .eq('id', booking.id);

      if (updateError) {
        summary.failed += 1;
        summary.failures.push({ bookingId: booking.id, reason: updateError.message });
        console.error(
          `[capture-tour-day-payments] Stripe captured but DB update failed booking=${booking.id}:`,
          updateError,
        );
        continue;
      }

      summary.captured += 1;
      console.log(
        `[capture-tour-day-payments] captured booking=${booking.id} amount=${captured.amount_received} ${captured.currency}`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      summary.failed += 1;
      summary.failures.push({ bookingId: booking.id, reason });
      console.error(`[capture-tour-day-payments] capture failed booking=${booking.id}:`, error);
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
