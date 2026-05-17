import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/orders/[id]/settle
 *
 * Finalizes the Stripe no-show authorization hold for a booking — the admin
 * action that was previously missing. Without it, holds were placed at
 * checkout but never converted to money (or released), so nothing could ever
 * actually be collected.
 *
 * Actions:
 *   - `capture` → charges the held card (`paymentIntents.capture`). Used both
 *     for "tour completed, collect via card" (reason `tour_completed`) and
 *     "no-show, charge the penalty" (reason `no_show`).
 *   - `release` → cancels the hold (`paymentIntents.cancel`, or
 *     `setupIntents.cancel` for >7d bookings whose hold isn't placed yet).
 *     With `collectedOffline: true` the booking is additionally marked paid
 *     (cash / transfer received in person).
 *
 * DB writes here are optimistic; the Stripe webhook (`payment_intent.succeeded`
 * / `payment_intent.canceled`) re-syncs the same fields, so a missed webhook
 * doesn't leave the row stale and a double-fire is idempotent.
 */

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key, { apiVersion: '2025-11-17.clover' });
};

type SettleAction = 'capture' | 'release';
type SettleReason = 'tour_completed' | 'no_show' | 'collected_offline' | 'cancelled';

/** Only a manual-capture PI sitting in `requires_capture` can be captured. */
const CAPTURABLE_PI_STATUSES = new Set(['requires_capture']);
/** Any non-terminal PI status can be canceled (terminal = succeeded / canceled). */
const CANCELABLE_PI_STATUSES = new Set([
  'requires_capture',
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'processing',
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireAdmin(req);

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured (STRIPE_SECRET_KEY missing).' },
        { status: 500 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      action?: SettleAction;
      reason?: SettleReason;
      collectedOffline?: boolean;
    };

    const action = body.action;
    if (action !== 'capture' && action !== 'release') {
      return NextResponse.json(
        { error: "Invalid 'action' — expected 'capture' or 'release'." },
        { status: 400 },
      );
    }
    const reason: SettleReason =
      body.reason ?? (action === 'capture' ? 'tour_completed' : 'cancelled');
    const collectedOffline = body.collectedOffline === true;

    const supabase = createServerClient();

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(
        `
        id, status, payment_status, payment_method,
        payment_intent_id, setup_intent_id, payment_intent_status,
        authorization_expires_at, no_show_fee_usd_cents, final_price,
        card_collection_method
      `,
      )
      .eq('id', id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const stripe = getStripe();
    const nowIso = new Date().toISOString();

    /* ============================== CAPTURE ============================== */
    if (action === 'capture') {
      const piId = booking.payment_intent_id as string | null;
      if (!piId) {
        return NextResponse.json(
          {
            error:
              'No payment hold to capture. For a >7-day booking the hold is placed by the daily cron ~6 days before the tour — try again closer to the tour date. Otherwise the card was never authorized.',
          },
          { status: 400 },
        );
      }

      let pi: Stripe.PaymentIntent;
      try {
        pi = await stripe.paymentIntents.retrieve(piId);
      } catch (err) {
        return NextResponse.json(
          {
            error: 'Could not load the PaymentIntent from Stripe.',
            details: (err as Error).message,
          },
          { status: 502 },
        );
      }

      // Already captured — sync the row and report success (idempotent).
      if (pi.status === 'succeeded') {
        const syncUpdate: Record<string, unknown> = {
          payment_status: 'paid',
          payment_intent_status: 'captured',
          updated_at: nowIso,
        };
        if (booking.payment_status !== 'paid') syncUpdate.paid_at = nowIso;
        const { error: syncError } = await supabase.from('bookings').update(syncUpdate).eq('id', id);
        if (syncError) {
          return NextResponse.json(
            { error: 'Stripe is captured, but booking sync failed.', details: syncError.message },
            { status: 500 },
          );
        }
        return NextResponse.json({
          ok: true,
          alreadyDone: true,
          action,
          bookingId: id,
          message: 'This hold was already captured — booking is up to date.',
        });
      }

      if (!CAPTURABLE_PI_STATUSES.has(pi.status)) {
        return NextResponse.json(
          {
            error: `This hold can't be captured (Stripe status: ${pi.status}). It has likely expired or been canceled — collect payment another way.`,
          },
          { status: 409 },
        );
      }

      let captured: Stripe.PaymentIntent;
      try {
        captured = await stripe.paymentIntents.capture(piId, {
          metadata: { ...pi.metadata, settle_reason: reason },
        });
      } catch (err) {
        return NextResponse.json(
          { error: 'Stripe capture failed.', details: (err as Error).message },
          { status: 502 },
        );
      }

      const nextStatus = reason === 'no_show' ? 'no_show' : 'completed';
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          payment_intent_status: 'captured',
          payment_method: 'stripe',
          paid_at: nowIso,
          status: nextStatus,
          updated_at: nowIso,
        })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json(
          {
            error: 'Stripe capture succeeded, but booking update failed. Reconcile this booking manually.',
            details: updateError.message,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        action,
        reason,
        bookingId: id,
        amountCaptured: captured.amount_received,
        currency: captured.currency,
        message:
          reason === 'no_show'
            ? 'No-show fee captured — card charged.'
            : 'Card charged — tour payment collected.',
      });
    }

    /* ============================== RELEASE ============================== */
    // action === 'release'
    const piId = booking.payment_intent_id as string | null;
    const siId = booking.setup_intent_id as string | null;

    let releasedVia: 'payment_intent' | 'setup_intent' | 'none' = 'none';

    if (piId) {
      let pi: Stripe.PaymentIntent | null = null;
      try {
        pi = await stripe.paymentIntents.retrieve(piId);
      } catch {
        pi = null;
      }
      if (pi) {
        if (pi.status === 'succeeded') {
          return NextResponse.json(
            {
              error:
                'This hold was already captured (card charged). Releasing is no longer possible — issue a refund instead.',
            },
            { status: 409 },
          );
        }
        if (pi.status === 'canceled') {
          releasedVia = 'payment_intent'; // already released
        } else if (CANCELABLE_PI_STATUSES.has(pi.status)) {
          try {
            await stripe.paymentIntents.cancel(piId);
            releasedVia = 'payment_intent';
          } catch (err) {
            return NextResponse.json(
              {
                error: 'Stripe cancel (PaymentIntent) failed.',
                details: (err as Error).message,
              },
              { status: 502 },
            );
          }
        }
      }
    }

    if (releasedVia === 'none' && siId) {
      let si: Stripe.SetupIntent | null = null;
      try {
        si = await stripe.setupIntents.retrieve(siId);
      } catch {
        si = null;
      }
      if (si) {
        if (si.status === 'canceled' || si.status === 'succeeded') {
          releasedVia = 'setup_intent';
        } else {
          try {
            await stripe.setupIntents.cancel(siId);
            releasedVia = 'setup_intent';
          } catch (err) {
            return NextResponse.json(
              {
                error: 'Stripe cancel (SetupIntent) failed.',
                details: (err as Error).message,
              },
              { status: 502 },
            );
          }
        }
      }
    }

    const update: Record<string, unknown> = { updated_at: nowIso };
    if (releasedVia !== 'none') update.payment_intent_status = 'canceled';
    if (collectedOffline) {
      update.payment_status = 'paid';
      update.payment_method = 'offline';
      update.paid_at = nowIso;
      update.status = 'completed';
    }
    const { error: releaseUpdateError } = await supabase.from('bookings').update(update).eq('id', id);
    if (releaseUpdateError) {
      return NextResponse.json(
        { error: 'Hold action completed, but booking update failed.', details: releaseUpdateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      action,
      reason,
      bookingId: id,
      collectedOffline,
      releasedVia,
      message: collectedOffline
        ? 'Hold released — booking marked paid (collected offline).'
        : releasedVia === 'none'
          ? 'No active hold found — booking updated.'
          : 'Hold released — the card will not be charged.',
    });
  } catch (err) {
    if (err instanceof AdminAuthFailure) {
      return adminAuthJsonResponse(err);
    }
    console.error('POST /api/admin/orders/[id]/settle error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: (err as Error).message },
      { status: 500 },
    );
  }
}
