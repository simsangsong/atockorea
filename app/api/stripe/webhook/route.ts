import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';
import { headers } from 'next/headers';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key, { apiVersion: '2025-11-17.clover' });
};

/**
 * POST /api/stripe/webhook
 *
 * Handles two payment flows:
 *
 *   1. **No-show authorization hold (current)** — booking confirmed once card
 *      is authorized; charge only happens on no-show capture.
 *        - `payment_intent.amount_capturable_updated` → status='confirmed',
 *          payment_intent_status='authorized', payment_status='authorized'
 *        - `payment_intent.succeeded`                 → payment_intent_status='captured',
 *          payment_status='paid' (this fires only after admin captures)
 *        - `payment_intent.canceled`                  → payment_intent_status='canceled'
 *        - `payment_intent.payment_failed`            → payment_intent_status='failed'
 *        - `setup_intent.succeeded`                   → status='confirmed',
 *          payment_intent_status='setup_pending_hold' (re-auth cron will run)
 *        - `setup_intent.setup_failed`                → payment_intent_status='failed'
 *
 *   2. **Legacy Checkout Session (kept for backward compat)** — pre-existing
 *      bookings created before the no-show hold rollout.
 *        - `checkout.session.completed`, async variants
 *
 * Signature verified with STRIPE_WEBHOOK_SECRET.
 * Local test: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !webhookSecret) {
      console.error('Stripe webhook secret not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const body = await req.text();
    const h = await headers();
    const signature = h.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Webhook signature verification failed:', message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${message}` },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    switch (event.type) {
      /* =========================================================================
       * NO-SHOW AUTHORIZATION HOLD FLOW
       * ========================================================================= */

      case 'payment_intent.amount_capturable_updated': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingId = pi.metadata?.booking_id;
        console.log(`[webhook] amount_capturable_updated pi=${pi.id} booking=${bookingId ?? '<none>'} status=${pi.status}`);
        if (!bookingId) break;

        /** Card auth succeeded — booking is now confirmed (no charge yet). */
        const { data: existing, error: existingErr } = await supabase
          .from('bookings')
          .select('id, payment_intent_status, status')
          .eq('id', bookingId)
          .single();

        if (existingErr) {
          console.error(`[webhook] existing-fetch error for booking ${bookingId}:`, existingErr);
        }
        if (existing?.payment_intent_status === 'captured') {
          // Already captured — don't downgrade.
          break;
        }

        const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();

        const { data: updated, error: updateErr } = await supabase
          .from('bookings')
          .update({
            status: 'confirmed',
            payment_status: 'authorized',
            payment_intent_status: 'authorized',
            payment_method: 'stripe',
            payment_intent_id: pi.id,
            authorization_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId)
          .neq('payment_intent_status', 'captured')
          .select()
          .single();

        if (updateErr) {
          console.error(`[webhook] update error for booking ${bookingId}:`, updateErr);
        }

        if (!updated) {
          console.log(`Booking ${bookingId} already authorized (idempotent), skipping email`);
          break;
        }

        /** Send "card on file — no charge today" confirmation email. */
        await sendCardOnFileEmail(supabase, bookingId, pi).catch((err) =>
          console.error('Card-on-file email failed:', err),
        );

        console.log(`Booking ${bookingId} card authorized (hold placed) via Stripe`);
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingId = pi.metadata?.booking_id;
        if (!bookingId) break;

        /** Capture happened — typically admin marked no-show. */
        await supabase
          .from('bookings')
          .update({
            payment_status: 'paid',
            payment_intent_status: 'captured',
            payment_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId);

        console.log(`Booking ${bookingId} no-show fee captured: ${pi.amount_received} ${pi.currency}`);
        break;
      }

      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingId = pi.metadata?.booking_id;
        if (!bookingId) break;

        await supabase
          .from('bookings')
          .update({
            payment_intent_status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId)
          .neq('payment_intent_status', 'captured');

        console.log(`Booking ${bookingId} hold canceled (no charge)`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingId = pi.metadata?.booking_id;
        if (!bookingId) break;

        await supabase
          .from('bookings')
          .update({
            payment_intent_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId)
          .in('payment_intent_status', ['auth_pending', 'setup_pending_hold']);

        console.log(`Booking ${bookingId} card auth failed`);
        break;
      }

      case 'setup_intent.succeeded': {
        const si = event.data.object as Stripe.SetupIntent;
        const bookingId = si.metadata?.booking_id;
        if (!bookingId) break;

        const paymentMethodId =
          typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id;

        const { data: updated } = await supabase
          .from('bookings')
          .update({
            status: 'confirmed',
            payment_status: 'pending', // not authorized yet — cron will hold the card 5d before tour
            payment_intent_status: 'setup_pending_hold',
            payment_method: 'stripe',
            setup_intent_id: si.id,
            stripe_payment_method_id: paymentMethodId ?? null,
            stripe_customer_id: typeof si.customer === 'string' ? si.customer : si.customer?.id ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId)
          .neq('payment_intent_status', 'authorized')
          .neq('payment_intent_status', 'captured')
          .select()
          .single();

        if (!updated) {
          console.log(`Booking ${bookingId} setup_intent already processed (idempotent), skipping email`);
          break;
        }

        /** Same "card on file" email — re-auth happens 5 days before tour via cron. */
        await sendCardOnFileEmail(supabase, bookingId, si).catch((err) =>
          console.error('Card-on-file email (setup) failed:', err),
        );

        console.log(`Booking ${bookingId} card vaulted via SetupIntent (cron will hold pre-tour)`);
        break;
      }

      case 'setup_intent.setup_failed': {
        const si = event.data.object as Stripe.SetupIntent;
        const bookingId = si.metadata?.booking_id;
        if (!bookingId) break;

        await supabase
          .from('bookings')
          .update({
            payment_intent_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId)
          .eq('payment_intent_status', 'setup_pending_hold');

        console.log(`Booking ${bookingId} card vault failed`);
        break;
      }

      /* =========================================================================
       * LEGACY CHECKOUT SESSION FLOW (backward compat for bookings created before rollout)
       * ========================================================================= */

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.client_reference_id || session.metadata?.booking_id;
        if (!bookingId) break;
        if (session.payment_status !== 'paid') break;

        const { data: existingBooking } = await supabase
          .from('bookings')
          .select('id, payment_status')
          .eq('id', bookingId)
          .single();
        if (existingBooking?.payment_status === 'paid') break;

        const { data: updatedRow } = await supabase
          .from('bookings')
          .update({
            payment_status: 'paid',
            payment_method: 'stripe',
            payment_reference: session.id,
            payment_date: new Date().toISOString(),
            status: 'confirmed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId)
          .eq('payment_status', 'pending')
          .select()
          .single();

        if (!updatedRow) break;

        try {
          await sendLegacyConfirmationEmail(supabase, bookingId, session);
        } catch (emailError) {
          console.error('Error sending legacy confirmation email:', emailError);
        }
        console.log(`Booking ${bookingId} payment confirmed via legacy Stripe Checkout`);
        break;
      }

      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.client_reference_id || session.metadata?.booking_id;
        if (bookingId) {
          const { data: existing } = await supabase
            .from('bookings')
            .select('payment_status')
            .eq('id', bookingId)
            .single();
          if (existing?.payment_status !== 'paid') {
            await supabase
              .from('bookings')
              .update({
                payment_status: 'paid',
                status: 'confirmed',
                updated_at: new Date().toISOString(),
              })
              .eq('id', bookingId);
          }
        }
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.client_reference_id || session.metadata?.booking_id;
        if (bookingId) console.log(`Async payment failed for booking ${bookingId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Webhook handler failed', details: message },
      { status: 500 },
    );
  }
}

/* ============================================================================
 * Email helpers — extracted from the old in-handler bodies to keep the switch
 * statement readable. Both fail open (errors logged but never fail the webhook).
 * ============================================================================ */

async function sendCardOnFileEmail(
  supabase: ReturnType<typeof createServerClient>,
  bookingId: string,
  intent: Stripe.PaymentIntent | Stripe.SetupIntent,
) {
  const { data: booking } = await supabase
    .from('bookings')
    .select(
      `
      id, tour_id, user_id, booking_date, tour_date, number_of_guests, final_price,
      pickup_point_id, contact_email, contact_name,
      tours ( id, title, image_url ),
      user_profiles ( email, full_name )
    `,
    )
    .eq('id', bookingId)
    .single();

  if (!booking) return;

  const profile = (booking.user_profiles ?? null) as { email?: string; full_name?: string } | null;
  const customerEmail =
    (intent.metadata?.customer_email as string | undefined) ??
    (booking as { contact_email?: string }).contact_email ??
    profile?.email ??
    null;
  const customerName =
    (intent.metadata?.customer_name as string | undefined) ??
    (booking as { contact_name?: string }).contact_name ??
    profile?.full_name ??
    'Guest';

  if (!customerEmail || !booking.tours) return;

  let pickupPointName: string | null = null;
  if (booking.pickup_point_id) {
    const { data: pickupData } = await supabase
      .from('pickup_points')
      .select('name, address')
      .eq('id', booking.pickup_point_id)
      .single();
    pickupPointName = pickupData?.name || pickupData?.address || null;
  }

  const tour = booking.tours as { id?: number; title?: string; image_url?: string } | null;
  const { sendBookingConfirmationEmail } = await import('@/lib/email');
  await sendBookingConfirmationEmail({
    to: customerEmail,
    bookingId: booking.id,
    tourTitle: tour?.title ?? '',
    bookingDate: booking.booking_date,
    numberOfGuests: booking.number_of_guests,
    totalPrice: parseFloat(String(booking.final_price ?? 0)),
    pickupPoint: pickupPointName ?? undefined,
    paymentMethod: 'stripe',
    paymentStatus: 'authorized',
    customerName,
    tourId: tour?.id != null ? String(tour.id) : undefined,
    tourImageUrl: tour?.image_url,
  });

  if (booking.user_id) {
    try {
      const { notifyBookingConfirmed } = await import('@/lib/notifications');
      await notifyBookingConfirmed(
        booking.id,
        booking.user_id,
        (booking.tours as { title?: string } | null)?.title ?? 'Booking',
      );
    } catch (notificationError) {
      console.error('Error creating notification:', notificationError);
    }
  }
}

async function sendLegacyConfirmationEmail(
  supabase: ReturnType<typeof createServerClient>,
  bookingId: string,
  session: Stripe.Checkout.Session,
) {
  const { data: booking } = await supabase
    .from('bookings')
    .select(
      `
      id, tour_id, user_id, booking_date, number_of_guests, final_price, pickup_point_id,
      contact_email, contact_name,
      tours ( id, title, image_url ),
      user_profiles ( email, full_name )
    `,
    )
    .eq('id', bookingId)
    .single();

  if (!booking) return;

  const profile = (booking.user_profiles ?? null) as { email?: string; full_name?: string } | null;
  let customerEmail: string | null = session.customer_details?.email ?? session.customer_email ?? null;
  let customerName = (session.metadata?.customer_name as string) || 'Guest';
  if (!customerEmail && profile) {
    customerEmail = profile.email ?? null;
    customerName = profile.full_name || customerName;
  }
  if (!customerEmail && (booking as { contact_email?: string }).contact_email) {
    customerEmail = (booking as { contact_email: string }).contact_email;
  }
  if ((!customerName || customerName === 'Guest') && (booking as { contact_name?: string }).contact_name) {
    customerName = (booking as { contact_name: string }).contact_name;
  }

  if (!customerEmail || !booking.tours) return;

  let pickupPointName: string | null = null;
  if (booking.pickup_point_id) {
    const { data: pickupData } = await supabase
      .from('pickup_points')
      .select('name, address')
      .eq('id', booking.pickup_point_id)
      .single();
    pickupPointName = pickupData?.name || pickupData?.address || null;
  }

  const tour = booking.tours as { id?: number; title?: string; image_url?: string } | null;
  const { sendBookingConfirmationEmail } = await import('@/lib/email');
  await sendBookingConfirmationEmail({
    to: customerEmail,
    bookingId: booking.id,
    tourTitle: tour?.title ?? '',
    bookingDate: booking.booking_date,
    numberOfGuests: booking.number_of_guests,
    totalPrice: parseFloat(String(booking.final_price ?? 0)),
    pickupPoint: pickupPointName ?? undefined,
    paymentMethod: 'stripe',
    paymentStatus: 'paid',
    customerName,
    tourId: tour?.id != null ? String(tour.id) : undefined,
    tourImageUrl: tour?.image_url,
  });

  if (booking.user_id) {
    try {
      const { notifyPaymentCompleted, notifyBookingConfirmed } = await import('@/lib/notifications');
      await notifyPaymentCompleted(
        booking.id,
        booking.user_id,
        parseFloat(String(booking.final_price ?? 0)),
      );
      await notifyBookingConfirmed(
        booking.id,
        booking.user_id,
        (booking.tours as { title?: string } | null)?.title ?? 'Booking',
      );
    } catch (notificationError) {
      console.error('Error creating notification:', notificationError);
    }
  }
}
