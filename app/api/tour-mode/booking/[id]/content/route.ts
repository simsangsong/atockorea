import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { handleApiError, ErrorResponses } from '@/lib/error-handler';

/**
 * GET /api/tour-mode/booking/[id]/content
 * Returns full Tour Mode content for one booking:
 * - booking + tour
 * - tour_guide_spots (audio spots)
 * - tour_facilities (restrooms, ticket offices, etc.)
 * - tour_bus_details for that tour_date (if sent by admin)
 * - schedule with departure_time for bus alarms
 *
 * Access: either authenticated user owns the booking, or guest lookup via query params
 * (bookingId = id, contactName + contactEmail or contactPhone must match).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const bookingId = resolvedParams.id;
    const supabase = createServerClient();
    const user = await getAuthUser(req);
    const { searchParams } = new URL(req.url);
    const contactName = searchParams.get('contactName')?.trim();
    const contactEmail = searchParams.get('contactEmail')?.trim();
    const contactPhone = searchParams.get('contactPhone')?.trim();

    // Fetch booking with tour
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        tours (
          id,
          title,
          city,
          image_url,
          schedule,
          duration,
          pickup_info
        ),
        pickup_points ( id, name, address, lat, lng, pickup_time )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Access check: owner or guest match
    if (user && booking.user_id === user.id) {
      // OK: owned by current user
    } else if (!booking.user_id && contactName && (contactEmail || contactPhone)) {
      // Guest booking: match contact
      const nameMatch =
        (booking.contact_name || '').toLowerCase() === contactName.toLowerCase();
      const emailMatch = contactEmail
        ? (booking.contact_email || '').toLowerCase() === contactEmail.toLowerCase()
        : true;
      const phoneMatch = contactPhone
        ? (booking.contact_phone || '').replace(/\s/g, '') === contactPhone.replace(/\s/g, '')
        : true;
      if (!nameMatch || (!emailMatch && !phoneMatch)) {
        return NextResponse.json(
          { error: 'Booking not found or contact does not match' },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Authentication required or provide contactName and contactEmail/contactPhone for guest lookup' },
        { status: 403 }
      );
    }

    if (booking.status !== 'confirmed') {
      return NextResponse.json(
        { error: 'This booking is not confirmed' },
        { status: 400 }
      );
    }

    const tourId = booking.tour_id;
    const tourDate = booking.tour_date; // YYYY-MM-DD

    // Fetch guide spots and facilities for this tour
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
        .eq('tour_date', tourDate)
        .maybeSingle(),
    ]);

    if (spotsRes.error) throw spotsRes.error;
    if (facilitiesRes.error) throw facilitiesRes.error;
    if (busRes.error) throw busRes.error;

    return NextResponse.json({
      booking: {
        id: booking.id,
        booking_reference: booking.booking_reference,
        tour_date: booking.tour_date,
        tour_time: booking.tour_time,
        number_of_guests: booking.number_of_guests,
        contact_name: booking.contact_name,
        tours: booking.tours,
        pickup_points: booking.pickup_points,
      },
      tour_guide_spots: spotsRes.data || [],
      tour_facilities: facilitiesRes.data || [],
      bus_detail: busRes.data || null,
      schedule: (booking.tours as { schedule?: Array<{ time?: string; title?: string; description?: string; departure_time?: string }> })?.schedule || [],
    });
  } catch (error: unknown) {
    return handleApiError(error, req);
  }
}
