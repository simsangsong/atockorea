// app/api/paypal/create-order/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@/lib/supabase';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';
const PAYPAL_API_BASE =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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

    const { bookingId, amount, currency = 'USD', tourId, customerEmail, customerName } = await req.json();

    if (!bookingId || !amount) {
      return NextResponse.json(
        { error: 'Booking ID and amount are required' },
        { status: 400 }
      );
    }

    // Verify booking exists
    const supabase = createServerClient();
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, tour_id, final_price, status')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    if (booking.status !== 'pending') {
      return NextResponse.json(
        { error: 'Booking is not in pending status' },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    // Create PayPal order
    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: bookingId,
            description: `Tour Booking - ${tourId || 'Tour'}`,
            amount: {
              currency_code: currency,
              value: amount.toString(), // Must be string
            },
          },
        ],
        application_context: {
          brand_name: "AtoCKorea",
          landing_page: "NO_PREFERENCE",
          user_action: "PAY_NOW",
          return_url: `${APP_URL}/api/paypal/callback?success=true&bookingId=${bookingId}`,
          cancel_url: `${APP_URL}/api/paypal/callback?canceled=true&bookingId=${bookingId}`,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('PayPal create order error:', errorData);
      return NextResponse.json(
        { error: 'Failed to create PayPal order', details: errorData },
        { status: response.status }
      );
    }

    const orderData = await response.json();

    // Store PayPal order ID in booking metadata or separate table
    await supabase
      .from('bookings')
      .update({
        payment_provider_data: JSON.stringify({
          provider: 'paypal',
          order_id: orderData.id,
          status: orderData.status,
        }),
      })
      .eq('id', bookingId);

    return NextResponse.json({
      orderId: orderData.id,
      status: orderData.status,
      links: orderData.links,
    });
  } catch (error: any) {
    console.error('PayPal create order error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
