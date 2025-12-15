import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/tours/[id]/availability
 * Check availability for a specific tour and date
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const tourId = params.id;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const guests = parseInt(searchParams.get('guests') || '1');

    if (!date) {
      return NextResponse.json(
        { error: 'date parameter is required' },
        { status: 400 }
      );
    }

    // Get tour info
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('id, title, price, price_type')
      .eq('id', tourId)
      .eq('is_active', true)
      .single();

    if (tourError || !tour) {
      return NextResponse.json(
        { error: 'Tour not found or inactive' },
        { status: 404 }
      );
    }

    // Check inventory for the specific date
    const { data: inventory, error: inventoryError } = await supabase
      .from('product_inventory')
      .select('*')
      .eq('tour_id', tourId)
      .eq('tour_date', date)
      .eq('is_available', true)
      .single();

    let availableSpots = 0;
    let maxCapacity = null;
    let isAvailable = true;
    let priceOverride = null;

    if (inventoryError) {
      // If no inventory record exists, check if we should use default capacity
      // For now, we'll assume unlimited availability if no inventory record
      // In production, you might want to set a default max capacity per tour
      availableSpots = 999; // Default to high number if no inventory record
      isAvailable = true;
    } else if (inventory) {
      availableSpots = inventory.available_spots || 0;
      maxCapacity = inventory.max_capacity;
      isAvailable = inventory.is_available;
      priceOverride = inventory.price_override;
    }

    // Check existing bookings for the date to calculate actual availability
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('number_of_guests, status')
      .eq('tour_id', tourId)
      .eq('booking_date', date)
      .in('status', ['pending', 'confirmed']); // Only count active bookings

    if (!bookingsError && bookings) {
      const bookedGuests = bookings.reduce((sum, booking) => 
        sum + (booking.number_of_guests || 1), 0
      );
      
      // If we have max capacity, calculate available spots
      if (maxCapacity !== null) {
        availableSpots = Math.max(0, maxCapacity - bookedGuests);
      } else if (inventory) {
        // Use inventory available_spots minus booked guests
        availableSpots = Math.max(0, availableSpots - bookedGuests);
      } else {
        // No inventory record, use max capacity minus booked guests
        // Default max capacity (you can set this per tour)
        const defaultMaxCapacity = 50; // Default capacity
        availableSpots = Math.max(0, defaultMaxCapacity - bookedGuests);
      }
    }

    // Check if requested guests can be accommodated
    const canAccommodate = availableSpots >= guests;
    const finalPrice = priceOverride ? parseFloat(priceOverride.toString()) : parseFloat(tour.price.toString());

    return NextResponse.json({
      available: canAccommodate && isAvailable,
      availableSpots,
      maxCapacity,
      requestedGuests: guests,
      canAccommodate,
      price: finalPrice,
      priceOverride: priceOverride ? parseFloat(priceOverride.toString()) : null,
      date,
      tourId,
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
 * POST /api/tours/[id]/availability
 * Reserve spots (temporary hold) or check availability with reservation
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const tourId = params.id;
    const body = await req.json();

    const { date, guests } = body;

    if (!date || !guests) {
      return NextResponse.json(
        { error: 'date and guests are required' },
        { status: 400 }
      );
    }

    // Check availability first
    const availabilityUrl = new URL(`/api/tours/${tourId}/availability?date=${date}&guests=${guests}`, req.url);
    const availabilityResponse = await fetch(availabilityUrl.toString());
    const availabilityData = await availabilityResponse.json();

    if (!availabilityData.available || !availabilityData.canAccommodate) {
      return NextResponse.json(
        { 
          error: 'Not enough spots available',
          availableSpots: availabilityData.availableSpots,
          requestedGuests: guests,
        },
        { status: 400 }
      );
    }

    // Return availability confirmation
    return NextResponse.json({
      available: true,
      availableSpots: availabilityData.availableSpots,
      requestedGuests: guests,
      date,
      message: 'Availability confirmed',
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

