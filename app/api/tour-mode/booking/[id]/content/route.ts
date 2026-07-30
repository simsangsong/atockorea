/**
 * Tour-day content for one booking.
 *
 * 🔴 FA-016 (full-app audit 2026-07-30). This route let an unauthenticated
 * caller who knew a booking id try `?contactEmail=` without limit: measured
 * 25 consecutive wrong guesses, zero 429s, and a correct guess returned the
 * guest's real name, booking reference and pickup point. Every other
 * guest-credential path in the app goes through `resolveRoomActor`, whose §6
 * gates the email match on `tour_room_guest` (PA-4) before it compares
 * anything; this route hand-rolled the comparison and inherited no gate.
 *
 * Two things changed, and both matter:
 *
 *   1. The guess is bounded on TWO keys — the caller's IP and the booking id.
 *      IP alone is not enough here: the target is a single booking, so an
 *      attacker with a pool of addresses would still walk an email list. The
 *      booking key makes the budget a property of the thing being attacked.
 *   2. A wrong guess and a nonexistent booking now answer identically (404).
 *      The old pair — 404 for unknown, 403 for "exists but not yours" — was a
 *      booking-id oracle on its own, independent of the email guessing.
 *
 * Authenticated owners skip the gate: they are identified before any guess is
 * possible, and the mobile app's own polling should not spend a guest budget.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';

export const dynamic = 'force-dynamic';

/** Deliberately tighter than join's 15/min: this is a lookup, not a door. */
const GUEST_PER_MINUTE = 6;
const GUEST_PER_HOUR = 30;

function normalized(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: bookingId } = await params;
    const supabase = createServerClient();
    const user = await getAuthUser(req);
    const { searchParams } = new URL(req.url);
    const contactName = normalized(searchParams.get('contactName'));
    const contactEmail = normalized(searchParams.get('contactEmail'));
    const contactPhone = normalized(searchParams.get('contactPhone'));

    // Unauthenticated callers are the guessing vector, so they pay the gate
    // BEFORE the database is touched — an enumeration run should not also be
    // free reads.
    if (!user) {
      for (const key of [`ip:${clientIpKey(req.headers)}`, `booking:${bookingId}`]) {
        const gate = await requestGate({
          namespace: 'tour_mode_booking_content',
          key,
          perMinute: GUEST_PER_MINUTE,
          perHour: GUEST_PER_HOUR,
        });
        if (!gate.allowed) {
          return NextResponse.json(
            { error: 'rate_limited' },
            {
              status: 429,
              headers: gate.retryAfterMs
                ? { 'Retry-After': String(Math.ceil(gate.retryAfterMs / 1000)) }
                : undefined,
            },
          );
        }
      }
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(
        `
        id, booking_reference, user_id, tour_id, tour_date, tour_time,
        number_of_guests, contact_name, contact_email, contact_phone,
        status, payment_status, pickup_point_id,
        tours ( id, title, city, image_url, schedule ),
        pickup_points ( id, name, address, lat, lng, pickup_time )
      `,
      )
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const isOwner = Boolean(user?.id && booking.user_id === user.id);
    const guestMatches =
      normalized(booking.contact_email) === contactEmail &&
      (!contactName || normalized(booking.contact_name) === contactName) &&
      (!contactPhone || normalized(booking.contact_phone) === contactPhone);

    // Same answer as "no such booking" — see the header note on the oracle.
    if (!isOwner && !guestMatches) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const tourId = booking.tour_id as string | null;
    if (!tourId) {
      return NextResponse.json({ error: 'Booking has no tour attached' }, { status: 400 });
    }

    const [spotsRes, facilitiesRes, busRes] = await Promise.all([
      supabase
        .from('tour_guide_spots')
        .select('*')
        .eq('tour_id', tourId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('tour_facilities')
        .select('*')
        .eq('tour_id', tourId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('tour_bus_details')
        .select('*')
        .eq('tour_id', tourId)
        .eq('tour_date', booking.tour_date)
        .maybeSingle(),
    ]);

    if (spotsRes.error) throw spotsRes.error;
    if (facilitiesRes.error) throw facilitiesRes.error;
    if (busRes.error) throw busRes.error;

    const tour = Array.isArray(booking.tours) ? booking.tours[0] : booking.tours;
    const pickup = Array.isArray(booking.pickup_points)
      ? booking.pickup_points
      : booking.pickup_points
        ? [booking.pickup_points]
        : null;

    return NextResponse.json({
      booking: {
        id: booking.id,
        booking_reference: booking.booking_reference,
        tour_date: booking.tour_date,
        tour_time: booking.tour_time,
        number_of_guests: booking.number_of_guests,
        contact_name: booking.contact_name,
        tours: tour,
        pickup_points: pickup,
      },
      tour_guide_spots: spotsRes.data ?? [],
      tour_facilities: facilitiesRes.data ?? [],
      bus_detail: busRes.data ?? null,
      schedule: (tour as { schedule?: unknown } | null)?.schedule ?? [],
    });
  } catch (error) {
    console.error('GET /api/tour-mode/booking/[id]/content error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
