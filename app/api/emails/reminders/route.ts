import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendBookingReminderEmail } from '@/lib/email';
import { checkCronAuth } from '@/lib/cron-auth';
import { isTourModeEnabled } from '@/lib/tour-room/flags';
import { kstToday } from '@/lib/tour-room/time';
import {
  dispatchRoomInvites,
  hasActiveCustomerInvite,
  type DispatchDbClient,
} from '@/lib/tour-room/dispatch';
import type { TourRelation, UserProfileRelation, PickupPointRelation } from '@/lib/db-relations';

/**
 * T5.4 — Tour Mode D-1 auto-dispatch, riding the same cron invocation.
 * Additive: the legacy reminder loop above is untouched. Gated by the launch
 * flag (links open the coming-soon page while it's off) and deduped by the
 * invites ledger — a booking with a live customer invite is never re-mailed.
 */
async function dispatchTomorrowsRooms(supabase: ReturnType<typeof createServerClient>) {
  if (!isTourModeEnabled()) {
    return { enabled: false, dispatched: 0, skipped: 0, failed: 0 };
  }
  // Tomorrow in KST — tour_date is the Korean tour day (§B D-9).
  const [y, m, d] = kstToday().split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  const tomorrow = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, tour_id, merchant_id, tour_date, tour_time, contact_name, contact_email, preferred_language')
    .eq('status', 'confirmed')
    .eq('tour_date', tomorrow);

  let dispatched = 0;
  let skipped = 0;
  let failed = 0;
  for (const booking of bookings ?? []) {
    try {
      if (await hasActiveCustomerInvite(supabase, booking.id)) {
        skipped += 1;
        continue;
      }
      const result = await dispatchRoomInvites(supabase as unknown as DispatchDbClient, booking, {
        createdBy: null,
      });
      if (result.customer.sent) dispatched += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      console.error(`[tour-room] D-1 dispatch failed for booking ${booking.id}:`, error);
    }
  }
  return { enabled: true, date: tomorrow, dispatched, skipped, failed };
}

/**
 * POST /api/emails/reminders
 * Send reminder emails for bookings happening tomorrow.
 * Must be called by a cron job with CRON_SECRET (Bearer token or X-Cron-Secret header).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = checkCronAuth({
      authorization: req.headers.get('authorization'),
      xCronSecret: req.headers.get('x-cron-secret'),
    });
    if (auth === 'unconfigured') {
      return NextResponse.json(
        { error: 'Cron endpoint not configured' },
        { status: 503 }
      );
    }
    if (auth !== 'authorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
        const tour = booking.tours as TourRelation | null | undefined;
        const pickupPoint = booking.pickup_points as PickupPointRelation | null | undefined;
        const userProfile = booking.user_profiles as UserProfileRelation | null | undefined;

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
            tourTitle: tour.title ?? '',
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
      } catch (err: unknown) {
        console.error(`Error sending reminder for booking ${booking.id}:`, err);
        results.push({
          bookingId: booking.id,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    const tourMode = await dispatchTomorrowsRooms(supabase);

    return NextResponse.json({
      message: `Reminder emails processed`,
      date: tomorrowStr,
      total: bookings.length,
      sent: successCount,
      failed: failureCount,
      tour_mode_dispatch: tourMode,
      results,
    });
  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/emails/reminders
 *
 * Vercel Cron invokes this endpoint via GET with an
 * `Authorization: Bearer <CRON_SECRET>` header. Auth is enforced by the
 * delegated POST handler (checkCronAuth): an unauthenticated GET is rejected
 * with 401, so this is NOT an open trigger.
 */
export async function GET(req: NextRequest) {
  return POST(req);
}













