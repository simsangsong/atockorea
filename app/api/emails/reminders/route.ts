import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendBookingReminderEmail } from '@/lib/email';

/**
 * POST /api/emails/reminders
 * Send reminder emails for bookings happening tomorrow
 * This should be called by a cron job or scheduled task
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Find all confirmed bookings for tomorrow
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        *,
        tours (
          id,
          title
        ),
        pickup_points (
          id,
          name,
          address,
          pickup_time
        ),
        user_profiles (
          id,
          email,
          full_name
        )
      `)
      .eq('status', 'confirmed')
      .eq('booking_date', tomorrowStr);

    if (error) {
      console.error('Error fetching bookings for reminders:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bookings', details: error.message },
        { status: 500 }
      );
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({
        message: 'No bookings found for tomorrow',
        sent: 0,
      });
    }

    // Send reminder emails
    const results = [];
    for (const booking of bookings) {
      try {
        const tour = booking.tours as any;
        const pickupPoint = booking.pickup_points as any;
        const userProfile = booking.user_profiles as any;

        let customerEmail = null;
        let customerName = 'Guest';
        let contactPhone = null;

        if (userProfile) {
          customerEmail = userProfile.email;
          customerName = userProfile.full_name || customerName;
        } else {
          // Try to get from special_requests
          try {
            const specialRequests = JSON.parse(booking.special_requests || '{}');
            customerEmail = specialRequests.email || specialRequests.customer_email;
            customerName = specialRequests.name || specialRequests.customer_name || customerName;
            contactPhone = specialRequests.phone || specialRequests.customer_phone;
          } catch (e) {
            // Ignore parse errors
          }
        }

        if (customerEmail && tour) {
          const result = await sendBookingReminderEmail({
            to: customerEmail,
            bookingId: booking.id,
            tourTitle: tour.title,
            bookingDate: booking.booking_date,
            bookingTime: booking.tour_time || undefined,
            numberOfGuests: booking.number_of_guests || 1,
            pickupPoint: pickupPoint?.name || undefined,
            pickupAddress: pickupPoint?.address || undefined,
            pickupTime: pickupPoint?.pickup_time || undefined,
            customerName,
            contactPhone: contactPhone || undefined,
          });

          results.push({
            bookingId: booking.id,
            email: customerEmail,
            success: result.success,
            error: result.error,
          });
        } else {
          results.push({
            bookingId: booking.id,
            email: customerEmail,
            success: false,
            error: 'No email address found',
          });
        }
      } catch (err: any) {
        console.error(`Error sending reminder for booking ${booking.id}:`, err);
        results.push({
          bookingId: booking.id,
          success: false,
          error: err.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      message: `Reminder emails processed`,
      date: tomorrowStr,
      total: bookings.length,
      sent: successCount,
      failed: failureCount,
      results,
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/emails/reminders
 * Test endpoint to manually trigger reminder emails
 */
export async function GET(req: NextRequest) {
  // In production, you might want to add authentication here
  const response = await POST(req);
  return response;
}




