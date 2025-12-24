import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/tours/[id]/availability/range
 * Get availability for a date range
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const tourId = params.id;
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const days = parseInt(searchParams.get('days') || '30'); // Default 30 days

    // Calculate date range
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      start = new Date();
      end = new Date();
      end.setDate(end.getDate() + days);
    }

    // Get all inventory records for the date range
    const { data: inventory, error: inventoryError } = await supabase
      .from('product_inventory')
      .select('*')
      .eq('tour_id', tourId)
      .gte('tour_date', start.toISOString().split('T')[0])
      .lte('tour_date', end.toISOString().split('T')[0])
      .eq('is_available', true)
      .order('tour_date', { ascending: true });

    // Get all bookings for the date range
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('booking_date, number_of_guests, status')
      .eq('tour_id', tourId)
      .gte('booking_date', start.toISOString().split('T')[0])
      .lte('booking_date', end.toISOString().split('T')[0])
      .in('status', ['pending', 'confirmed']);

    // Group bookings by date
    const bookingsByDate: Record<string, number> = {};
    if (!bookingsError && bookings) {
      bookings.forEach((booking) => {
        const date = booking.booking_date;
        if (!bookingsByDate[date]) {
          bookingsByDate[date] = 0;
        }
        bookingsByDate[date] += booking.number_of_guests || 1;
      });
    }

    // Build availability map
    const availabilityMap: Record<string, any> = {};

    // Process inventory records
    if (!inventoryError && inventory) {
      inventory.forEach((inv) => {
        const date = inv.tour_date;
        const bookedGuests = bookingsByDate[date] || 0;
        const maxCapacity = inv.max_capacity;
        let availableSpots = inv.available_spots || 0;

        if (maxCapacity !== null) {
          availableSpots = Math.max(0, maxCapacity - bookedGuests);
        } else {
          availableSpots = Math.max(0, availableSpots - bookedGuests);
        }

        availabilityMap[date] = {
          available: availableSpots > 0 && inv.is_available,
          availableSpots,
          maxCapacity,
          priceOverride: inv.price_override ? parseFloat(inv.price_override.toString()) : null,
        };
      });
    }

    // Generate dates in range and fill in missing dates
    const dates: string[] = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dates.push(dateStr);

      if (!availabilityMap[dateStr]) {
        // No inventory record, check bookings only
        const bookedGuests = bookingsByDate[dateStr] || 0;
        const defaultMaxCapacity = 50; // Default capacity
        const availableSpots = Math.max(0, defaultMaxCapacity - bookedGuests);

        availabilityMap[dateStr] = {
          available: availableSpots > 0,
          availableSpots,
          maxCapacity: defaultMaxCapacity,
          priceOverride: null,
        };
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return NextResponse.json({
      tourId,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      availability: availabilityMap,
      dates,
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}





