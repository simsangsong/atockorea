import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';
import { headers } from 'next/headers';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

// Helper to get Stripe instance (lazy initialization to avoid build-time errors)
const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key, {
    apiVersion: '2025-11-17.clover',
  });
};

/**
 * POST /api/stripe/webhook
 * Stripe webhook: payment success → update booking (confirmed, paid) + send confirmation email via Resend.
 * - Signature verified with STRIPE_WEBHOOK_SECRET (required; never skip).
 * - Idempotent: if booking is already paid, skip update and email.
 * Local test: stripe listen --forward-to localhost:3000/api/stripe/webhook
 * Then set .env.local STRIPE_WEBHOOK_SECRET to the printed whsec_... value.
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
      const stripe = getStripe();
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

        // Only activate booking when payment succeeded (prevents unpaid or incomplete sessions from confirming)
        if (session.payment_status !== 'paid') {
          console.warn('Stripe checkout.session.completed ignored: payment_status is not paid', session.payment_status);
          break;
        }

        // Idempotency: if already paid, skip update and email (Stripe may send the webhook more than once)
        const { data: existingBooking } = await supabase
          .from('bookings')
          .select('id, payment_status')
          .eq('id', bookingId)
          .single();

        if (existingBooking?.payment_status === 'paid') {
          console.log(`Booking ${bookingId} already confirmed (idempotent), skipping`);
          break;
        }

        // Update booking payment status and store Stripe session reference (atomic: only if still pending)
        const { data: updatedRow, error: updateError } = await supabase
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

        if (updateError) {
          console.error('Error updating booking:', updateError);
          return NextResponse.json(
            { error: 'Failed to update booking' },
            { status: 500 }
          );
        }

        // Only send email if we actually updated (avoid duplicate when Stripe retries or race)
        if (!updatedRow) {
          console.log(`Booking ${bookingId} already updated (idempotent), skipping email`);
          break;
        }

        // Send confirmation email (Resend via sendBookingConfirmationEmail)
        try {
          const { data: booking } = await supabase
            .from('bookings')
            .select(`
              id,
              tour_id,
              user_id,
              booking_date,
              number_of_guests,
              final_price,
              pickup_point_id,
              contact_email,
              contact_name,
              tours (
                id,
                title,
                image_url
              ),
              user_profiles (
                email,
                full_name
              )
            `)
            .eq('id', bookingId)
            .single();

          if (booking) {
            // Customer email/name: Stripe session → user_profiles → booking contact (guest fallback)
            const sessionEmail = session.customer_details?.email ?? session.customer_email ?? null;
            let customerEmail: string | null = sessionEmail;
            let customerName = (session.metadata?.customer_name as string) || 'Guest';

            if (!customerEmail && booking.user_profiles) {
              const profile = booking.user_profiles as { email?: string; full_name?: string } | null;
              customerEmail = profile?.email ?? null;
              customerName = profile?.full_name || customerName;
            }
            if (!customerEmail && (booking as { contact_email?: string }).contact_email) {
              customerEmail = (booking as { contact_email: string }).contact_email;
            }
            if ((!customerName || customerName === 'Guest') && (booking as { contact_name?: string }).contact_name) {
              customerName = (booking as { contact_name: string }).contact_name;
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

              const tour = booking.tours as { id?: number; title?: string; image_url?: string } | null;
              const { sendBookingConfirmationEmail } = await import('@/lib/email');
              const emailResult = await sendBookingConfirmationEmail({
                to: customerEmail,
                bookingId: booking.id,
                tourTitle: tour?.title ?? '',
                bookingDate: booking.booking_date,
                numberOfGuests: booking.number_of_guests,
                totalPrice: parseFloat(String(booking.final_price ?? 0)),
                pickupPoint: pickupPointName || undefined,
                paymentMethod: 'stripe',
                paymentStatus: 'paid',
                customerName,
                tourId: tour?.id != null ? String(tour.id) : undefined,
                tourImageUrl: tour?.image_url,
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
                await notifyPaymentCompleted(booking.id, booking.user_id, parseFloat(String(booking.final_price ?? 0)));
                const tourTitle = (booking.tours as { title?: string } | null)?.title ?? 'Booking';
                await notifyBookingConfirmed(booking.id, booking.user_id, tourTitle);
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

