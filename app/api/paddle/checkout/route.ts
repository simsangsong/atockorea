import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const PADDLE_API_KEY = process.env.PADDLE_API_KEY || '';
const PADDLE_VENDOR_ID = process.env.PADDLE_VENDOR_ID || '';
const PADDLE_ENVIRONMENT = process.env.PADDLE_ENVIRONMENT || 'sandbox'; // 'sandbox' or 'production'

const PADDLE_API_BASE = PADDLE_ENVIRONMENT === 'production'
  ? 'https://api.paddle.com'
  : 'https://sandbox-api.paddle.com';

/**
 * POST /api/paddle/checkout
 * Create Paddle checkout transaction for booking payment
 */
export async function POST(req: NextRequest) {
  try {
    // Check if Paddle is configured
    if (!PADDLE_API_KEY || !PADDLE_VENDOR_ID) {
      return NextResponse.json(
        { error: 'Paddle is not configured. Please set PADDLE_API_KEY and PADDLE_VENDOR_ID in environment variables.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { amount, currency = 'USD', bookingId, bookingData } = body;

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

    // Get customer info from bookingData
    const customerEmail = bookingData?.customerInfo?.email || null;
    const customerName = bookingData?.customerInfo?.name || null;

    // Extract tour data
    const tour = Array.isArray(booking.tours) ? booking.tours[0] : booking.tours;
    const tourTitle = tour?.title || 'Tour';

    // Create Paddle transaction
    // Using Paddle's Transaction API to create a checkout
    const transactionPayload = {
      items: [
        {
          price_id: process.env.PADDLE_PRICE_ID || '', // You need to create a price in Paddle first
          quantity: 1,
        },
      ],
      customer_id: null, // Will be created during checkout
      custom_data: {
        booking_id: bookingId.toString(),
        tour_id: booking.tour_id?.toString() || '',
        tour_title: tourTitle,
        customer_name: customerName || '',
      },
      customer_email: customerEmail,
      locale: 'en',
      success_url: `${APP_URL}/tour/${booking.tour_id}/confirmation?transaction_id={transaction_id}&booking_id=${bookingId}`,
      // Alternative: Use Paddle.js overlay checkout
      // This is simpler and doesn't require creating a transaction first
    };

    // Update booking with Paddle payment method
    await supabase
      .from('bookings')
      .update({
        payment_method: 'paddle',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    // Return checkout configuration for Paddle.js
    // Paddle.js will handle the checkout overlay
    return NextResponse.json({
      bookingId,
      paddleConfig: {
        environment: PADDLE_ENVIRONMENT,
        vendorId: PADDLE_VENDOR_ID,
        amount: parseFloat(amount),
        currency: currency.toUpperCase(),
        productId: process.env.PADDLE_PRODUCT_ID || '',
        priceId: process.env.PADDLE_PRICE_ID || '',
        customData: {
          booking_id: bookingId.toString(),
          tour_id: booking.tour_id?.toString() || '',
        },
        customerEmail: customerEmail,
        successUrl: `${APP_URL}/tour/${booking.tour_id}/confirmation?transaction_id={transaction_id}&booking_id=${bookingId}`,
      },
    });
  } catch (error: any) {
    console.error('Paddle checkout error:', error);
    
    return NextResponse.json(
      { error: 'Failed to create Paddle checkout', details: error.message },
      { status: 500 }
    );
  }
}








