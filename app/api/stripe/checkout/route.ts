import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * POST /api/stripe/checkout
 * Create Stripe Checkout Session for booking payment
 */
export async function POST(req: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { amount, currency = 'usd', bookingId, bookingData } = body;

    // Validate required fields
    if (!amount || !bookingId) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, bookingId' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Verify booking exists
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        tour_id,
        final_price,
        payment_status,
        status,
        tours (
          id,
          title,
          image_url
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Check if already paid
    if (booking.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'Booking already paid' },
        { status: 400 }
      );
    }

    // Convert amount to cents (Stripe uses smallest currency unit)
    const amountInCents = Math.round(parseFloat(amount) * 100);

    if (amountInCents <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Get customer info from bookingData or booking
    const customerEmail = bookingData?.customerInfo?.email || null;
    const customerName = bookingData?.customerInfo?.name || null;

    // Create Stripe Checkout Session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Tour Booking: ${booking.tours?.title || 'Tour'}`,
              description: `Booking ID: ${bookingId}`,
              images: booking.tours?.image_url ? [booking.tours.image_url] : undefined,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${APP_URL}/tour/${booking.tour_id}/confirmation?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
      cancel_url: `${APP_URL}/tour/${booking.tour_id}/checkout?booking_id=${bookingId}&cancelled=true`,
      client_reference_id: bookingId,
      metadata: {
        booking_id: bookingId,
        tour_id: booking.tour_id as string,
      },
    };

    // Add customer email if available
    if (customerEmail) {
      sessionParams.customer_email = customerEmail;
    }

    // Add customer name to metadata
    if (customerName) {
      sessionParams.metadata.customer_name = customerName;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Update booking with Stripe session ID
    await supabase
      .from('bookings')
      .update({
        payment_method: 'stripe',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      bookingId,
    });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    
    // Handle Stripe-specific errors
    if (error.type === 'StripeCardError') {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: 'Invalid request to Stripe', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session', details: error.message },
      { status: 500 }
    );
  }
}
