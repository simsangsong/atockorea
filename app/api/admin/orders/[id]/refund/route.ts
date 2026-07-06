import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { resolveRefundAmount, toStripeRefundReason, minorToMajor, type RefundAmountError } from '@/lib/payments/refund';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/orders/[id]/refund   (W5.7 / W-10)
 *
 * Refunds a captured Stripe charge for a booking — full by default, or a partial
 * `amountMinor` (cents). Mirrors the settle route's structure. NO settlement
 * reconciliation here (that lands with §G); this only moves the refund + records
 * it on the booking and the audit log.
 *
 * Idempotent: DB writes are re-synced by the `charge.refunded` webhook, and the
 * Stripe call carries an idempotency key keyed on the prior-refunded total.
 *
 * To release an UNcaptured authorization hold (not a refund), use the settle
 * route with action='release'.
 */

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key, { apiVersion: '2025-11-17.clover' });
};

const REFUND_ERROR_STATUS: Record<RefundAmountError, number> = {
  nothing_captured: 400,
  already_fully_refunded: 409,
  amount_must_be_positive: 400,
  exceeds_remaining: 400,
};

const REFUND_ERROR_MESSAGE: Record<RefundAmountError, string> = {
  nothing_captured:
    'No captured charge to refund. If a hold is still open, release it via settle instead.',
  already_fully_refunded: 'This charge has already been fully refunded.',
  amount_must_be_positive: "'amountMinor' must be a positive number of cents.",
  exceeds_remaining: 'Refund amount exceeds the remaining refundable balance.',
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = await requireAdmin(req);

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured (STRIPE_SECRET_KEY missing).' },
        { status: 500 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      amountMinor?: number;
      reason?: string;
      note?: string;
    };

    if (body.amountMinor !== undefined && typeof body.amountMinor !== 'number') {
      return NextResponse.json({ error: "'amountMinor' must be a number (cents)." }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(
        'id, status, payment_status, payment_method, payment_intent_id, payment_intent_status, refund_amount, final_price, currency',
      )
      .eq('id', id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const piId = booking.payment_intent_id as string | null;
    if (!piId) {
      return NextResponse.json(
        {
          error:
            'This booking has no Stripe charge to refund (offline/unpaid). Refund manually and mark it accordingly.',
        },
        { status: 400 },
      );
    }

    const stripe = getStripe();

    let pi: Stripe.PaymentIntent;
    try {
      pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge'] });
    } catch (err) {
      return NextResponse.json(
        { error: 'Could not load the PaymentIntent from Stripe.', details: (err as Error).message },
        { status: 502 },
      );
    }

    if (pi.status !== 'succeeded') {
      return NextResponse.json(
        {
          error: `This charge isn't captured (Stripe status: ${pi.status}), so there is nothing to refund. Release the hold via settle instead.`,
        },
        { status: 409 },
      );
    }

    const charge =
      pi.latest_charge && typeof pi.latest_charge !== 'string'
        ? (pi.latest_charge as Stripe.Charge)
        : null;
    const capturedMinor = charge?.amount_captured ?? pi.amount_received ?? 0;
    const alreadyRefundedMinor = charge?.amount_refunded ?? 0;

    const resolved = resolveRefundAmount({
      capturedMinor,
      alreadyRefundedMinor,
      requestedMinor: body.amountMinor ?? null,
    });
    if (!resolved.ok) {
      return NextResponse.json(
        { error: REFUND_ERROR_MESSAGE[resolved.error] },
        { status: REFUND_ERROR_STATUS[resolved.error] },
      );
    }

    let refund: Stripe.Refund;
    try {
      refund = await stripe.refunds.create(
        {
          payment_intent: piId,
          amount: resolved.amountMinor,
          ...(toStripeRefundReason(body.reason) ? { reason: toStripeRefundReason(body.reason) } : {}),
          metadata: {
            booking_id: id,
            admin_refund: 'true',
            ...(body.note ? { note: String(body.note).slice(0, 480) } : {}),
          },
        },
        // Key on the prior-refunded total so a double-submit of the SAME refund is
        // idempotent, while a later, distinct partial refund is still allowed.
        { idempotencyKey: `refund:${piId}:${alreadyRefundedMinor}:${resolved.amountMinor}` },
      );
    } catch (err) {
      return NextResponse.json(
        { error: 'Stripe refund failed.', details: (err as Error).message },
        { status: 502 },
      );
    }

    const nowIso = new Date().toISOString();
    const totalRefundedMinor = alreadyRefundedMinor + resolved.amountMinor;
    const update: Record<string, unknown> = {
      payment_status: resolved.isFullRefund ? 'refunded' : 'partially_refunded',
      // KRW is zero-decimal — `/100` under-recorded refunds 100× (deep-audit).
      refund_amount: minorToMajor(totalRefundedMinor, refund.currency ?? booking.currency),
      refund_processed: resolved.isFullRefund,
      updated_at: nowIso,
    };
    if (resolved.isFullRefund) update.payment_intent_status = 'refunded';

    const { error: updateError } = await supabase.from('bookings').update(update).eq('id', id);
    if (updateError) {
      return NextResponse.json(
        {
          error:
            'Refund issued in Stripe, but booking update failed. The charge.refunded webhook will reconcile it.',
          details: updateError.message,
          refundId: refund.id,
        },
        { status: 500 },
      );
    }

    // Audit (best-effort — never fail the refund on a logging error).
    try {
      await supabase.from('audit_logs').insert({
        user_id: admin.id,
        action: 'booking_refund',
        resource_type: 'booking',
        resource_id: id,
        details: {
          refund_id: refund.id,
          amount_minor: resolved.amountMinor,
          currency: refund.currency ?? booking.currency ?? null,
          is_full_refund: resolved.isFullRefund,
          total_refunded_minor: totalRefundedMinor,
          reason: body.reason ?? null,
          note: body.note ?? null,
        },
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        user_agent: req.headers.get('user-agent') || null,
      });
    } catch (auditErr) {
      console.error('[refund] audit log insert failed:', auditErr);
    }

    return NextResponse.json({
      ok: true,
      bookingId: id,
      refundId: refund.id,
      amountRefunded: resolved.amountMinor,
      totalRefunded: totalRefundedMinor,
      currency: refund.currency,
      isFullRefund: resolved.isFullRefund,
      message: resolved.isFullRefund
        ? 'Refund issued — booking fully refunded.'
        : 'Partial refund issued.',
    });
  } catch (err) {
    if (err instanceof AdminAuthFailure) {
      return adminAuthJsonResponse(err);
    }
    console.error('POST /api/admin/orders/[id]/refund error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: (err as Error).message },
      { status: 500 },
    );
  }
}
