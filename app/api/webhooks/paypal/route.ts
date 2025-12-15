// app/api/webhooks/paypal/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@/lib/supabase';
import crypto from 'crypto';

const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const headers = req.headers;

    // Verify webhook signature (in production, verify PayPal webhook signature)
    // For now, we'll trust webhook ID matching
    const webhookId = headers.get('paypal-webhook-id');
    
    if (PAYPAL_WEBHOOK_ID && webhookId !== PAYPAL_WEBHOOK_ID) {
      console.warn('PayPal webhook ID mismatch');
      // In production, should verify signature properly
    }

    const event = JSON.parse(body);
    const eventType = event.event_type;
    const resource = event.resource;

    console.log(`PayPal webhook received: ${eventType}`);

    const supabase = createServerClient();

    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        // Payment capture completed
        const captureId = resource.id;
        const orderId = resource.supplementary_data?.related_ids?.order_id;
        const amount = parseFloat(resource.amount?.value || '0');
        const currency = resource.amount?.currency_code;

        // Find booking by PayPal order ID in payment_provider_data
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, tour_id, booking_date, number_of_guests, final_price, pickup_point_id, payment_provider_data, user_profiles (email, full_name), tours (id, title)')
          .eq('status', 'pending')
          .not('payment_provider_data', 'is', null);

        let targetBooking = null;
        for (const booking of bookings || []) {
          try {
            const providerData = JSON.parse(booking.payment_provider_data || '{}');
            if (providerData.order_id === orderId || providerData.capture_id === captureId) {
              targetBooking = booking;
              break;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }

        if (targetBooking) {
          // Update booking status
          await supabase
            .from('bookings')
            .update({
              payment_status: 'paid',
              status: 'confirmed',
              payment_provider_data: JSON.stringify({
                provider: 'paypal',
                order_id: orderId,
                capture_id: captureId,
                amount,
                currency,
                status: 'completed',
              }),
              updated_at: new Date().toISOString(),
            })
            .eq('id', targetBooking.id);

          // Send confirmation email
          try {
            let customerEmail = resource.payer?.email_address;
            let customerName = resource.payer?.name?.given_name || 'Guest';

            if (!customerEmail && targetBooking.user_profiles) {
              customerEmail = (targetBooking.user_profiles as any).email;
              customerName = (targetBooking.user_profiles as any).full_name || customerName;
            }

            if (customerEmail && targetBooking.tours) {
              // Get pickup point if available
              let pickupPointName = null;
              if (targetBooking.pickup_point_id) {
                const { data: pickupData } = await supabase
                  .from('pickup_points')
                  .select('name, address')
                  .eq('id', targetBooking.pickup_point_id)
                  .single();
                pickupPointName = pickupData?.name || pickupData?.address || null;
              }

              const { sendBookingConfirmationEmail } = await import('@/lib/email');
              await sendBookingConfirmationEmail({
                to: customerEmail,
                bookingId: targetBooking.id,
                tourTitle: (targetBooking.tours as any).title,
                bookingDate: targetBooking.booking_date,
                numberOfGuests: targetBooking.number_of_guests,
                totalPrice: parseFloat(targetBooking.final_price.toString()),
                pickupPoint: pickupPointName || undefined,
                paymentMethod: 'paypal',
                customerName,
              });
            }
          } catch (emailError) {
            console.error('Error sending confirmation email:', emailError);
          }

          console.log(`Booking ${targetBooking.id} payment confirmed via PayPal webhook`);
        }

        break;
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.REFUNDED': {
        // Handle payment failures or refunds
        const orderId = resource.supplementary_data?.related_ids?.order_id;

        // Find and update booking if needed
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, payment_provider_data')
          .eq('status', 'pending')
          .not('payment_provider_data', 'is', null);

        for (const booking of bookings || []) {
          try {
            const providerData = JSON.parse(booking.payment_provider_data || '{}');
            if (providerData.order_id === orderId) {
              if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
                // Mark as refunded
                await supabase
                  .from('bookings')
                  .update({
                    payment_status: 'refunded',
                    status: 'cancelled',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', booking.id);
              } else {
                // Mark as failed
                await supabase
                  .from('bookings')
                  .update({
                    payment_status: 'failed',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', booking.id);
              }
              break;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }

        break;
      }

      default:
        console.log(`Unhandled PayPal webhook event: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('PayPal webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}

