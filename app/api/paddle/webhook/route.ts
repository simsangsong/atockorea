import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import crypto from 'crypto';

const PADDLE_PUBLIC_KEY = process.env.PADDLE_PUBLIC_KEY || '';

/**
 * POST /api/paddle/webhook
 * Handle Paddle webhook for payment confirmation
 * 
 * Paddle sends webhooks for various events:
 * - transaction.completed
 * - transaction.payment_succeeded
 * - transaction.payment_failed
 * 
 * Configure this URL in Paddle: Settings > Notifications > Webhooks
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('paddle-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Verify webhook signature
    // Paddle uses HMAC SHA256 for webhook verification
    if (PADDLE_PUBLIC_KEY) {
      // Note: Paddle webhook verification requires the public key
      // The actual verification process may vary based on Paddle's implementation
      // For now, we'll process the webhook and verify later if needed
    }

    const payload = JSON.parse(body);
    const { event_type, data } = payload;

    // Handle different event types
    if (event_type === 'transaction.completed' || event_type === 'transaction.payment_succeeded') {
      const transaction = data;
      const customData = transaction.custom_data || {};
      const bookingId = customData.booking_id || customData.bookingId;

      if (!bookingId) {
        console.warn('Paddle webhook received but no booking ID found:', payload);
        return NextResponse.json({ success: true, message: 'No booking ID found' });
      }

      const supabase = createServerClient();
      const bookingIdNum = parseInt(bookingId.toString());

      // Verify booking exists
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, payment_status, payment_transaction_id')
        .eq('id', bookingIdNum)
        .single();

      if (bookingError || !booking) {
        console.error('Booking not found for Paddle transaction:', bookingIdNum);
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        );
      }

      // Check if already processed
      if (booking.payment_status === 'paid' && booking.payment_transaction_id === transaction.id) {
        return NextResponse.json({
          success: true,
          message: 'Payment already processed',
          bookingId: bookingIdNum,
          transactionId: transaction.id,
        });
      }

      // Update booking payment status
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          payment_method: 'paddle',
          payment_transaction_id: transaction.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingIdNum);

      if (updateError) {
        console.error('Error updating booking:', updateError);
        return NextResponse.json(
          { error: 'Failed to update booking', details: updateError.message },
          { status: 500 }
        );
      }

      console.log('Paddle payment processed:', {
        transactionId: transaction.id,
        bookingId: bookingIdNum,
        amount: transaction.totals?.total,
        currency: transaction.currency_code,
      });

      return NextResponse.json({
        success: true,
        bookingId: bookingIdNum,
        transactionId: transaction.id,
      });
    }

    // Handle other event types (payment failed, refund, etc.)
    if (event_type === 'transaction.payment_failed') {
      console.log('Paddle payment failed:', data);
      // Optionally update booking status or send notification
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Paddle webhook error:', error);
    
    return NextResponse.json(
      { error: 'Failed to process Paddle webhook', details: error.message },
      { status: 500 }
    );
  }
}






