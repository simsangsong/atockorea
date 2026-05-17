import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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

    if (!isOwner && !guestMatches) {
      return NextResponse.json({ error: 'Access denied for this booking' }, { status: 403 });
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
