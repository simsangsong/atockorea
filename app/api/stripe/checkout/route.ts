import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';
import { verifyCheckoutOwnership } from '@/lib/checkout-auth';

/**
 * Card-on-file checkout — authorizes now and collects automatically on tour day.
 *
 * Branches on lead time:
 *   - tour ≤ 7 days away → PaymentIntent with `capture_method: 'manual'`
 *     (full amount authorized but not charged until tour-day auto capture).
 *   - tour > 7 days away → SetupIntent (saves card to a Stripe Customer; no
 *     hold today). The daily re-auth cron creates the manual-capture PI
 *     ~5 days before the tour.
 *
 * Both paths return a `clientSecret` the browser confirms via Stripe Elements.
 * Card-on-file UX: customer is never charged at booking time. We capture
 * automatically at 10:00 AM Korea time on the tour date after pickup has passed.
 */

const HOLD_WINDOW_DAYS = 7;
const MS_PER_DAY = 86400000;

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key, { apiVersion: '2025-11-17.clover' });
};

function daysUntil(tourDateYmd: string): number {
  const [y, m, d] = tourDateYmd.split('-').map(Number);
  if (!y || !m || !d) return Number.NaN;
  const tour = Date.UTC(y, m - 1, d);
  const today = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  );
  return Math.round((tour - today) / MS_PER_DAY);
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.' },
        { status: 500 },
      );
    }
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured' },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { bookingId, bookingData } = body as {
      bookingId?: string;
      bookingData?: { customerInfo?: { name?: string; email?: string; phone?: string } };
    };

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Missing required field: bookingId' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(
        `
        id,
        tour_id,
        tour_date,
        final_price,
        currency,
        source,
        payment_status,
        status,
        user_id,
        contact_email,
        contact_name,
        contact_phone,
        stripe_customer_id,
        payment_intent_id,
        setup_intent_id,
        payment_intent_status,
        tours ( id, title, image_url )
      `,
      )
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    /**
     * N14 — ownership guard. This route mutates Stripe state on a booking that
     * is addressed only by a public UUID, so we require the caller to also prove
     * they know an email tied to the booking before we cancel prior holds or
     * create new intents. The check runs against the *caller-supplied* email
     * (request body), never the server-resolved fallback below.
     */
    const suppliedEmail = bookingData?.customerInfo?.email;
    const ownerEmails: Array<string | null | undefined> = [
      (booking as { contact_email?: string | null }).contact_email,
    ];
    // Fallback for logged-in bookings stored with a user link but no contact_email.
    if (!ownerEmails.some(Boolean) && (booking as { user_id?: string | null }).user_id) {
      try {
        const { data: ownerUser } = await supabase.auth.admin.getUserById(
          String((booking as { user_id?: string | null }).user_id),
        );
        if (ownerUser?.user?.email) ownerEmails.push(ownerUser.user.email);
      } catch (lookupErr) {
        console.warn('[stripe/checkout] owner user lookup failed:', lookupErr);
      }
    }
    const ownership = verifyCheckoutOwnership(suppliedEmail, ownerEmails);
    if (!ownership.ok) {
      console.warn(`[stripe/checkout] ownership check failed (${ownership.reason}) for booking ${bookingId}`);
      return NextResponse.json(
        { error: 'Could not verify booking ownership. Please use the email on the booking.' },
        { status: 403 },
      );
    }

    if (
      booking.payment_intent_status === 'authorized' ||
      booking.payment_intent_status === 'captured'
    ) {
      return NextResponse.json({ error: 'Booking already authorized' }, { status: 400 });
    }

    const finalPrice = Number(booking.final_price);
    if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
      return NextResponse.json({ error: 'Booking has no valid price' }, { status: 400 });
    }

    /**
     * Per Phase 10 D16: bookings.currency tells us whether `final_price` is in
     * USD (legacy tour-product, two-decimal — convert to cents) or KRW
     * (itinerary-builder, zero-decimal — already whole minor units). Stripe
     * supports both natively. Existing rows default to 'usd' so the legacy
     * path is unchanged.
     */
    const currency: 'usd' | 'krw' = booking.currency === 'krw' ? 'krw' : 'usd';
    const amountMinor =
      currency === 'krw' ? Math.round(finalPrice) : Math.round(finalPrice * 100);

    const customerEmail =
      bookingData?.customerInfo?.email ?? (booking as { contact_email?: string }).contact_email ?? null;
    const customerName =
      bookingData?.customerInfo?.name ?? (booking as { contact_name?: string }).contact_name ?? null;
    const customerPhone =
      bookingData?.customerInfo?.phone ?? (booking as { contact_phone?: string }).contact_phone ?? null;

    const tour = Array.isArray(booking.tours) ? booking.tours[0] : booking.tours;
    const tourTitle = tour?.title || 'Tour';

    const stripe = getStripe();

    /** Find/create a Stripe customer. Reuse one if already attached to this booking
     *  or one already exists for the email — keeps the saved card portable across
     *  bookings (helpful for repeat guests). */
    let customerId = (booking.stripe_customer_id as string | null) ?? null;
    if (!customerId && customerEmail) {
      const existing = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0]!.id;
      } else {
        const created = await stripe.customers.create({
          email: customerEmail,
          name: customerName ?? undefined,
          phone: customerPhone ?? undefined,
          metadata: { booking_id: bookingId },
        });
        customerId = created.id;
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer email is required to create a payment hold.' },
        { status: 400 },
      );
    }

    /** Best-effort cancel any prior intent on this booking (e.g. user retry after card decline). */
    if (booking.payment_intent_id) {
      try {
        await stripe.paymentIntents.cancel(booking.payment_intent_id as string);
      } catch (err) {
        console.warn('Failed to cancel prior PaymentIntent:', err);
      }
    }
    if (booking.setup_intent_id) {
      try {
        await stripe.setupIntents.cancel(booking.setup_intent_id as string);
      } catch (err) {
        console.warn('Failed to cancel prior SetupIntent:', err);
      }
    }

    const tourDateStr = booking.tour_date as string | null;
    if (!tourDateStr) {
      return NextResponse.json({ error: 'Booking has no tour_date' }, { status: 400 });
    }
    const lead = daysUntil(tourDateStr);

    /** Source-aware metadata: tour_id is NULL for itinerary-builder bookings. */
    const baseMetadata: Record<string, string> = {
      booking_id: bookingId,
      kind: '__placeholder__',
      ...(customerName ? { customer_name: customerName } : {}),
    };
    if (booking.tour_id != null) baseMetadata.tour_id = String(booking.tour_id);
    if ((booking as { source?: string }).source) baseMetadata.source = String((booking as { source?: string }).source);

    /** Description differs slightly for builder bookings (no parent tour title). */
    const intentDescription = booking.tour_id
      ? `Tour-day auto charge authorization: ${tourTitle} (booking ${bookingId})`
      : `Custom itinerary auto charge authorization (booking ${bookingId})`;
    const setupDescription = booking.tour_id
      ? `Card on file for tour-day auto charge: ${tourTitle} (booking ${bookingId})`
      : `Card on file for custom itinerary auto charge (booking ${bookingId})`;

    if (lead <= HOLD_WINDOW_DAYS) {
      /* === Path A — tour within 7 days: place the auth hold immediately. === */
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountMinor,
        currency,
        capture_method: 'manual',
        customer: customerId,
        setup_future_usage: 'off_session',
        payment_method_types: ['card'],
        receipt_email: customerEmail ?? undefined,
        description: intentDescription,
        statement_descriptor_suffix: 'TOUR HOLD',
        metadata: { ...baseMetadata, kind: 'tour_day_auto_charge_hold' },
      });

      const expiresAt = new Date(Date.now() + HOLD_WINDOW_DAYS * MS_PER_DAY).toISOString();

      await supabase
        .from('bookings')
        .update({
          payment_method: 'stripe',
          payment_intent_id: paymentIntent.id,
          setup_intent_id: null,
          stripe_customer_id: customerId,
          payment_intent_status: 'auth_pending',
          authorization_expires_at: expiresAt,
          /** Legacy USD-cents mirror — preserved for cron compatibility. KRW
           *  bookings still write a USD-cents-shaped int here (it's the same
           *  amount in minor units; the cron reads `final_price` + `currency`
           *  in §2-cron-verify so this stays informational only). */
          no_show_fee_usd_cents: currency === 'usd' ? amountMinor : null,
          card_collection_method: 'immediate_hold',
          payment_reference: paymentIntent.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      return NextResponse.json({
        intentType: 'payment_intent' as const,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        publishableKey,
        bookingId,
        currency,
        amountMinor,
        /** @deprecated USD-only callers — use `currency` + `amountMinor`. */
        amountUsdCents: currency === 'usd' ? amountMinor : undefined,
        leadDays: lead,
      });
    }

    /* === Path B — tour > 7 days away: vault the card now, authorize it before tour. === */
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
      description: setupDescription,
      metadata: { ...baseMetadata, kind: 'tour_day_auto_charge_setup' },
    });

    await supabase
      .from('bookings')
      .update({
        payment_method: 'stripe',
        setup_intent_id: setupIntent.id,
        payment_intent_id: null,
        stripe_customer_id: customerId,
        payment_intent_status: 'setup_pending_hold',
        authorization_expires_at: null,
        no_show_fee_usd_cents: currency === 'usd' ? amountMinor : null,
        card_collection_method: 'setup_intent_then_hold',
        payment_reference: setupIntent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    return NextResponse.json({
      intentType: 'setup_intent' as const,
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      publishableKey,
      bookingId,
      currency,
      amountMinor,
      /** @deprecated USD-only callers — use `currency` + `amountMinor`. */
      amountUsdCents: currency === 'usd' ? amountMinor : undefined,
      leadDays: lead,
    });
  } catch (error: unknown) {
    console.error('Stripe checkout error:', error);
    const stripeErr = error as { type?: string; message?: string };
    if (stripeErr?.type === 'StripeCardError') {
      return NextResponse.json({ error: stripeErr.message ?? 'Card error' }, { status: 400 });
    }
    if (stripeErr?.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: 'Invalid request to Stripe', details: stripeErr.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to create payment hold', details: stripeErr?.message ?? String(error) },
      { status: 500 },
    );
  }
}
