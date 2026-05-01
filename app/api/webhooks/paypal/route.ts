// app/api/webhooks/paypal/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@/lib/supabase';
import { getPayPalAccessToken, getPayPalApiBaseUrl } from '@/lib/paypal';

const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';

/** Verify PayPal webhook signature via PayPal API */
async function verifyPayPalWebhook(
  rawBody: string,
  headers: Headers
): Promise<boolean> {
  if (!PAYPAL_WEBHOOK_ID || !PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    return false;
  }
  const transmissionId = headers.get('paypal-transmission-id');
  const transmissionSig = headers.get('paypal-transmission-sig');
  const transmissionTime = headers.get('paypal-transmission-time');
  const authAlgo = headers.get('paypal-auth-algo');
  const certUrl = headers.get('paypal-cert-url');
  if (!transmissionId || !transmissionSig || !transmissionTime || !authAlgo || !certUrl) {
    return false;
  }
  const token = await getPayPalAccessToken();
  const apiBase = getPayPalApiBaseUrl();
  const verifyRes = await fetch(`${apiBase}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: JSON.parse(rawBody),
    }),
  });
  if (!verifyRes.ok) {
    return false;
  }
  const result = await verifyRes.json();
  return result.verification_status === 'SUCCESS';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const headers = req.headers;

    const event = JSON.parse(body);
    const eventType = event.event_type;

    // Payment events require full credentials and signature verification (no weak webhook-id-only path)
    if (eventType && String(eventType).startsWith('PAYMENT.')) {
      if (!PAYPAL_WEBHOOK_ID || !PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
        return NextResponse.json(
          { error: 'Webhook not configured for payment events' },
          { status: 503 }
        );
      }
      const verified = await verifyPayPalWebhook(body, headers);
      if (!verified) {
        return NextResponse.json(
          { error: 'Webhook signature verification failed' },
          { status: 401 }
        );
      }
    } else if (PAYPAL_WEBHOOK_ID && PAYPAL_CLIENT_ID && PAYPAL_SECRET) {
      const verified = await verifyPayPalWebhook(body, headers);
      if (!verified) {
        return NextResponse.json(
          { error: 'Webhook signature verification failed' },
          { status: 401 }
        );
      }
    } else if (PAYPAL_WEBHOOK_ID) {
      const webhookId = headers.get('paypal-webhook-id');
      if (webhookId !== PAYPAL_WEBHOOK_ID) {
        return NextResponse.json(
          { error: 'Webhook ID mismatch' },
          { status: 401 }
        );
      }
    }

    const resource = event.resource;

    const supabase = createServerClient();

    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        // Payment capture completed
        const captureId = resource.id;
        const orderId = resource.supplementary_data?.related_ids?.order_id;
        const amount = parseFloat(resource.amount?.value || '0');
        const currency = resource.amount?.currency_code;

        // Look up across ALL bookings (paid + pending) so we can detect a
        // duplicate webhook delivery for the same capture_id.
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, tour_id, booking_date, number_of_guests, final_price, pickup_point_id, payment_provider_data, payment_status, user_profiles (email, full_name), tours (id, title, image_url)')
          .not('payment_provider_data', 'is', null);

        let targetBooking: any = null;
        let existingProviderData: any = {};
        for (const booking of bookings || []) {
          try {
            const providerData = JSON.parse(booking.payment_provider_data || '{}');
            if (providerData.order_id === orderId || providerData.capture_id === captureId) {
              targetBooking = booking;
              existingProviderData = providerData;
              break;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }

        if (!targetBooking) {
          console.warn('PayPal webhook: no booking matched', { orderId, captureId });
          break;
        }

        // Idempotency — same capture already processed
        if (
          targetBooking.payment_status === 'paid' &&
          existingProviderData.capture_id === captureId
        ) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('PayPal webhook idempotent skip:', captureId);
          }
          break;
        }

        // Server-authoritative amount check — refuse partial / inflated captures
        const expectedPrice = parseFloat(String(targetBooking.final_price ?? 0));
        if (!Number.isFinite(amount) || Math.abs(amount - expectedPrice) > 0.01) {
          console.warn('PayPal amount mismatch', {
            received: amount,
            expected: expectedPrice,
            bookingId: targetBooking.id,
            captureId,
          });
          return NextResponse.json(
            { error: 'amount_mismatch', code: 'AMOUNT_MISMATCH' },
            { status: 400 }
          );
        }

        // Atomic transition pending → paid; if another worker already updated,
        // updatedRows will be empty and we skip the side-effects (email, etc.)
        const { data: updatedRows, error: updErr } = await supabase
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
          .eq('id', targetBooking.id)
          .eq('payment_status', 'pending')
          .select('id');

        if (updErr) {
          console.error('PayPal update error:', updErr.code, updErr.message);
          return NextResponse.json({ error: 'update_failed' }, { status: 500 });
        }
        if (!updatedRows || updatedRows.length === 0) {
          // Race — another delivery already moved this booking to paid
          if (process.env.NODE_ENV !== 'production') {
            console.log('PayPal webhook: lost the race for', captureId);
          }
          break;
        }

        {

          // Send confirmation email
          try {
            let customerEmail = resource.payer?.email_address;
            let customerName = resource.payer?.name?.given_name || 'Guest';

            if (!customerEmail && targetBooking.user_profiles) {
              const profile = targetBooking.user_profiles as { email?: string; full_name?: string } | null;
              customerEmail = profile?.email;
              customerName = profile?.full_name || customerName;
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

              const tour = targetBooking.tours as { id?: number; title?: string; image_url?: string } | null;
              const { sendBookingConfirmationEmail } = await import('@/lib/email');
              await sendBookingConfirmationEmail({
                to: customerEmail,
                bookingId: targetBooking.id,
                tourTitle: tour?.title ?? '',
                bookingDate: targetBooking.booking_date,
                numberOfGuests: targetBooking.number_of_guests,
                totalPrice: parseFloat(String(targetBooking.final_price ?? 0)),
                pickupPoint: pickupPointName || undefined,
                paymentMethod: 'paypal',
                paymentStatus: 'paid',
                customerName,
                tourId: tour?.id != null ? String(tour.id) : undefined,
                tourImageUrl: tour?.image_url,
              });
            }
          } catch (emailError) {
            console.error('Error sending confirmation email:', emailError);
          }

        }

        break;
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.REFUNDED': {
        // Handle payment failures or refunds
        const orderId = resource.supplementary_data?.related_ids?.order_id;

        // Look across all bookings (paid/refunded/failed) for idempotency
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, payment_provider_data, payment_status')
          .not('payment_provider_data', 'is', null);

        for (const booking of bookings || []) {
          try {
            const providerData = JSON.parse(booking.payment_provider_data || '{}');
            if (providerData.order_id !== orderId) continue;

            if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
              if (booking.payment_status === 'refunded') break; // idempotent
              await supabase
                .from('bookings')
                .update({
                  payment_status: 'refunded',
                  status: 'cancelled',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', booking.id)
                .neq('payment_status', 'refunded');
            } else {
              if (booking.payment_status === 'failed') break; // idempotent
              await supabase
                .from('bookings')
                .update({
                  payment_status: 'failed',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', booking.id)
                .neq('payment_status', 'failed');
            }
            break;
          } catch (e) {
            // Skip invalid JSON
          }
        }

        break;
      }

      default:
        break;
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

