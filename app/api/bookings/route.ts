import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError, ErrorResponses } from '@/lib/error-handler';
import { getAuthUser } from '@/lib/auth';
import {
  getMissingRequiredFields,
  validateBookingCustomerInfo,
  validateNumberOfGuests,
  validateBookingDate,
} from '@/lib/validation';
import { ACTIVE_BOOKING_STATUSES } from '@/lib/constants/booking-status';

/**
 * GET /api/bookings
 * Get current user's bookings (authentication required; userId from session only)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return ErrorResponses.unauthorized('Authentication required');
    }

    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    // Build query
    let query = supabase
      .from('bookings')
      .select(`
        *,
        tours (
          id,
          title,
          city,
          image_url,
          price,
          price_type
        ),
        pickup_points (
          id,
          name,
          address,
          pickup_time
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: bookings, error } = await query;

    if (error) {
      throw error; // handleApiError가 처리
    }

    return NextResponse.json({ bookings: bookings || [] });
  } catch (error: any) {
    return handleApiError(error, req);
  }
}

/**
 * POST /api/bookings
 * Create a new booking
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    // Validate required fields
    const {
      tourId,
      bookingDate,
      numberOfGuests,
      pickupPointId,
      finalPrice,
      paymentMethod,
      preferredLanguage,
      specialRequests,
      customerInfo, // { name, email, phone, preferredChatApp, chatAppContact }
    } = body;

    const requiredKeys = ['tourId', 'bookingDate', 'numberOfGuests', 'finalPrice'];
    const missing = getMissingRequiredFields(body, requiredKeys);
    if (missing.length) {
      console.error('Missing required fields:', body);
      return ErrorResponses.validationError(
        `Missing required fields: ${missing.join(', ')}`
      );
    }

    // Validate booking date (no past dates)
    const dateValidation = validateBookingDate(bookingDate);
    if (!dateValidation.valid) {
      return NextResponse.json(
        { error: dateValidation.errors[0], code: 'INVALID_BOOKING_DATE' },
        { status: 400 }
      );
    }

    // Validate number of guests (1–50)
    const guestsValidation = validateNumberOfGuests(numberOfGuests);
    if (!guestsValidation.valid) {
      return NextResponse.json(
        { error: guestsValidation.errors[0], code: 'INVALID_GUESTS' },
        { status: 400 }
      );
    }

    // Get tour to fetch merchant_id and price info
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('id, merchant_id, price, price_type')
      .eq('id', tourId)
      .single();

    if (tourError || !tour) {
      return ErrorResponses.notFound('Tour');
    }

    // Try to get user from auth (optional - guest bookings allowed with full guest info)
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }

    // When customerInfo is provided, validate format (name length, email format, phone digits). Reduces spam and invalid orders.
    if (customerInfo && typeof customerInfo === 'object') {
      const customerValidation = validateBookingCustomerInfo(customerInfo);
      if (!customerValidation.valid) {
        return NextResponse.json(
          {
            error: customerValidation.errors[0],
            code: 'INVALID_CUSTOMER_INFO',
            details: customerValidation.errors,
          },
          { status: 400 }
        );
      }
    }

    // Require either authenticated user OR complete guest info (full_name, email, phone). Prevents anonymous/unlimited orders.
    const hasGuestInfo =
      customerInfo &&
      typeof customerInfo === 'object' &&
      [customerInfo.name, customerInfo.email, customerInfo.phone].every(
        (v) => v != null && String(v).trim() !== ''
      ) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customerInfo.email).trim());

    if (!userId && !hasGuestInfo) {
      return NextResponse.json(
        {
          error: 'Authentication or guest information required',
          code: 'AUTH_OR_GUEST_REQUIRED',
          message: 'Please sign in or provide full name, email, and phone number to place a booking.',
        },
        { status: 403 }
      );
    }

    // Check availability before creating booking
    const dateStr = bookingDate.split('T')[0]; // Extract date part if ISO string
    
    // Check inventory and existing bookings
    const { data: inventory } = await supabase
      .from('product_inventory')
      .select('*')
      .eq('tour_id', tourId)
      .eq('tour_date', dateStr)
      .eq('is_available', true)
      .single();

    // Get existing bookings for the date
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('number_of_guests')
      .eq('tour_id', tourId)
      .eq('booking_date', dateStr)
      .in('status', [...ACTIVE_BOOKING_STATUSES]);

    // Calculate available spots
    const bookedGuests = existingBookings?.reduce((sum, b) => sum + (b.number_of_guests || 1), 0) || 0;
    let availableSpots = 0;

    if (inventory) {
      const maxCapacity = inventory.max_capacity;
      if (maxCapacity !== null) {
        availableSpots = Math.max(0, maxCapacity - bookedGuests);
      } else {
        availableSpots = Math.max(0, (inventory.available_spots || 0) - bookedGuests);
      }
    } else {
      // No inventory record, use default capacity
      const defaultMaxCapacity = 50;
      availableSpots = Math.max(0, defaultMaxCapacity - bookedGuests);
    }

    // Check if we can accommodate the requested guests
    if (availableSpots < numberOfGuests) {
      return NextResponse.json(
        {
          error: 'Not enough spots available',
          availableSpots,
          requestedGuests: numberOfGuests,
        },
        { status: 400 }
      );
    }

    // Create booking
    // Convert bookingDate to DATE format (YYYY-MM-DD)
    const bookingDateFormatted = bookingDate.includes('T') 
      ? bookingDate.split('T')[0] 
      : bookingDate.split(' ')[0]; // Handle both ISO and date strings
    
    // Ensure tour_id is a string (UUID)
    const tourIdStr = String(tourId);
    
    // Calculate unit_price and total_price
    // unit_price: price per person/group (base tour price)
    // total_price: unit_price * number_of_guests (if person) or unit_price (if group)
    // final_price: total_price after discounts (already calculated)
    const unitPrice = parseFloat(String(tour.price || finalPrice));
    const totalPrice = tour.price_type === 'person' 
      ? unitPrice * parseInt(String(numberOfGuests), 10)
      : unitPrice;
    
    const bookingData: any = {
      tour_id: tourIdStr,
      merchant_id: tour.merchant_id || null, // Allow null if merchant_id is not set
      booking_date: bookingDateFormatted, // Use formatted date string (date when booking was created)
      tour_date: bookingDateFormatted, // Use formatted date string (date when tour will happen) - required field
      number_of_guests: parseInt(String(numberOfGuests), 10), // Ensure it's an integer
      unit_price: unitPrice, // Price per person/group (base tour price)
      total_price: totalPrice, // Total price before discounts
      final_price: parseFloat(String(finalPrice)), // Final price after discounts
      payment_method: paymentMethod || 'pending',
      payment_status: 'pending',
      status: 'pending',
    };
    
    console.log('Prepared booking data:', bookingData);

    if (userId) {
      bookingData.user_id = userId;
    }

    if (pickupPointId) {
      bookingData.pickup_point_id = pickupPointId;
    }

    if (specialRequests) {
      bookingData.special_requests = specialRequests;
    }

    if (preferredLanguage && ['en', 'zh', 'ko'].includes(String(preferredLanguage))) {
      bookingData.preferred_language = String(preferredLanguage);
    }

    // Store contact info for guest and display in admin; ensure every booking is linked to user_id or contact_email
    if (customerInfo) {
      bookingData.contact_name = (customerInfo.name ?? '').trim() || null;
      bookingData.contact_email = (customerInfo.email ?? '').trim() || null;
      bookingData.contact_phone = (customerInfo.phone ?? '').trim() || null;
    }

    // Guest orders: generate unique guest_id and store in special_requests for traceability
    if (!userId && customerInfo) {
      const guestId = crypto.randomUUID();
      const baseRequests =
        typeof specialRequests === 'string'
          ? { requests: specialRequests }
          : typeof specialRequests === 'object' && specialRequests !== null
            ? specialRequests
            : {};
      bookingData.special_requests = JSON.stringify({
        guest_id: guestId,
        ...customerInfo,
        ...baseRequests,
      });
    }

    console.log('Creating booking with data:', bookingData);
    
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();

    if (bookingError) {
      console.error('Error creating booking:', bookingError);
      console.error('Booking data that failed:', JSON.stringify(bookingData, null, 2));
      return NextResponse.json(
        { error: 'Failed to create booking', details: bookingError.message, code: bookingError.code },
        { status: 500 }
      );
    }
    
    console.log('Booking created successfully:', booking);

    // Update inventory after successful booking
    try {
      if (inventory) {
        // Update available spots
        const newAvailableSpots = Math.max(0, availableSpots - numberOfGuests);
        await supabase
          .from('product_inventory')
          .update({
            available_spots: newAvailableSpots,
            updated_at: new Date().toISOString(),
          })
          .eq('id', inventory.id);
      } else {
        // Create inventory record if it doesn't exist (shouldn't happen, but handle gracefully)
        const { data: tourForMerchant } = await supabase
          .from('tours')
          .select('merchant_id')
          .eq('id', tourId)
          .single();

        if (tourForMerchant?.merchant_id) {
          await supabase
            .from('product_inventory')
            .insert({
              tour_id: tourId,
              merchant_id: tourForMerchant.merchant_id,
              tour_date: dateStr,
              available_spots: Math.max(0, availableSpots - numberOfGuests),
              max_capacity: 50, // Default capacity
              is_available: true,
            });
        }
      }
    } catch (inventoryError) {
      // Log error but don't fail the booking
      console.error('Error updating inventory:', inventoryError);
    }

    // Confirmation email: only sent on payment success (Stripe/PayPal webhooks).
    // Do not send here on booking create — 결제 완료 시에만 확인 메일 발송.

    // Create notification for booking creation
    if (userId) {
      try {
        const { data: tourData } = await supabase
          .from('tours')
          .select('title')
          .eq('id', tourId)
          .single();

        if (tourData) {
          const { notifyBookingCreated } = await import('@/lib/notifications');
          await notifyBookingCreated(booking.id, userId, tourData.title);
        }
      } catch (notificationError) {
        console.error('Error creating notification:', notificationError);
        // Don't fail the booking if notification fails
      }
    }

    return NextResponse.json(
      {
        booking,
        message: 'Booking created successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Unexpected error in POST /api/bookings:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

