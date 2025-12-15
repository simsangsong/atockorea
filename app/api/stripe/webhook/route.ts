import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';
import { headers } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events (payment success, failure, etc.)
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !webhookSecret) {
      console.error('Stripe webhook secret not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    const body = await req.text();
    const signature = headers().get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.client_reference_id || session.metadata?.booking_id;

        if (!bookingId) {
          console.error('No booking ID found in Stripe session');
          break;
        }

        // Update booking payment status
        const { error: updateError } = await supabase
          .from('bookings')
          .update({
            payment_status: 'paid',
            payment_method: 'stripe',
            status: 'confirmed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId);

        if (updateError) {
          console.error('Error updating booking:', updateError);
          return NextResponse.json(
            { error: 'Failed to update booking' },
            { status: 500 }
          );
        }

        // Send confirmation email
        try {
          const { data: booking } = await supabase
            .from('bookings')
            .select(`
              id,
              tour_id,
              booking_date,
              number_of_guests,
              final_price,
              tours (
                id,
                title
              ),
              user_profiles (
                email,
                full_name
              )
            `)
            .eq('id', bookingId)
            .single();

          if (booking) {
            // Get customer email
            let customerEmail = session.customer_email;
            let customerName = session.metadata?.customer_name || 'Guest';

            if (!customerEmail && booking.user_profiles) {
              customerEmail = (booking.user_profiles as any).email;
              customerName = (booking.user_profiles as any).full_name || customerName;
            }

            if (customerEmail && booking.tours) {
              // Get pickup point if available
              let pickupPointName = null;
              if (booking.pickup_point_id) {
                const { data: pickupData } = await supabase
                  .from('pickup_points')
                  .select('name, address')
                  .eq('id', booking.pickup_point_id)
                  .single();
                pickupPointName = pickupData?.name || pickupData?.address || null;
              }

              const { sendBookingConfirmationEmail } = await import('@/lib/email');
              const emailResult = await sendBookingConfirmationEmail({
                to: customerEmail,
                bookingId: booking.id,
                tourTitle: (booking.tours as any).title,
                bookingDate: booking.booking_date,
                numberOfGuests: booking.number_of_guests,
                totalPrice: parseFloat(booking.final_price.toString()),
                pickupPoint: pickupPointName || undefined,
                paymentMethod: 'stripe',
                customerName,
              });

              if (emailResult.success) {
                console.log(`Confirmation email sent to ${customerEmail} for booking ${booking.id}`);
              } else {
                console.error(`Failed to send confirmation email: ${emailResult.error}`);
              }
            }

            // Create notification for payment completion
            if (booking.user_id) {
              try {
                const { notifyPaymentCompleted, notifyBookingConfirmed } = await import('@/lib/notifications');
                await notifyPaymentCompleted(booking.id, booking.user_id, parseFloat(booking.final_price.toString()));
                await notifyBookingConfirmed(booking.id, booking.user_id, (booking.tours as any).title);
              } catch (notificationError) {
                console.error('Error creating notification:', notificationError);
              }
            }
          }
        } catch (emailError) {
          // Log error but don't fail the webhook
          console.error('Error sending confirmation email:', emailError);
        }

        console.log(`Booking ${bookingId} payment confirmed via Stripe`);
        break;
      }

      case 'checkout.session.async_payment_succeeded': {
        // Handle async payment methods (e.g., bank transfers)
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.client_reference_id || session.metadata?.booking_id;

        if (bookingId) {
          await supabase
            .from('bookings')
            .update({
              payment_status: 'paid',
              status: 'confirmed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', bookingId);
        }
        break;
      }

      case 'checkout.session.async_payment_failed': {
        // Handle failed async payments
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.client_reference_id || session.metadata?.booking_id;

        if (bookingId) {
          // Optionally update booking status or send notification
          console.log(`Async payment failed for booking ${bookingId}`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const bookingId = paymentIntent.metadata?.booking_id;

        if (bookingId) {
          console.log(`Payment failed for booking ${bookingId}`);
          // Optionally update booking status
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed', details: error.message },
      { status: 500 }
    );
  }
}

