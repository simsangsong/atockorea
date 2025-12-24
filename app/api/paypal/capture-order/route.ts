// app/api/paypal/capture-order/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@/lib/supabase';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';
const PAYPAL_API_BASE =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString(
    "base64"
  );
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to get PayPal access token: ${error}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
      return NextResponse.json(
        { error: 'PayPal credentials not configured' },
        { status: 500 }
      );
    }

    const { orderId, bookingId } = await req.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    // Capture PayPal order
    const response = await fetch(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('PayPal capture order error:', errorData);
      return NextResponse.json(
        { error: 'Failed to capture PayPal order', details: errorData },
        { status: response.status }
      );
    }

    const captureData = await response.json();

    // Update booking status if capture is successful
    if (captureData.status === 'COMPLETED' && bookingId) {
      const supabase = createServerClient();

      // Get booking details for email
      const { data: booking } = await supabase
        .from('bookings')
        .select(`
          id,
          tour_id,
          booking_date,
          number_of_guests,
          final_price,
          pickup_point_id,
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
        // Update booking status
        await supabase
          .from('bookings')
          .update({
            payment_status: 'paid',
            status: 'confirmed',
            payment_provider_data: JSON.stringify({
              provider: 'paypal',
              order_id: orderId,
              capture_id: captureData.id,
              status: captureData.status,
              payer_email: captureData.payer?.email_address,
            }),
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId);

        // Send confirmation email
        try {
          let customerEmail = captureData.payer?.email_address;
          let customerName = captureData.payer?.name?.given_name || 'Guest';

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
              paymentMethod: 'paypal',
              customerName,
            });

            if (emailResult.success) {
              console.log(`Confirmation email sent to ${customerEmail} for booking ${booking.id}`);
            } else {
              console.error(`Failed to send confirmation email: ${emailResult.error}`);
            }
          }
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
          // Don't fail the capture if email fails
        }
      }
    }

    return NextResponse.json({
      success: true,
      orderId: captureData.id,
      status: captureData.status,
      details: captureData,
    });
  } catch (error: any) {
    console.error('PayPal capture order error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}





