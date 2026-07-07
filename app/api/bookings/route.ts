import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError, ErrorResponses } from '@/lib/error-handler';
import { getAuthUser } from '@/lib/auth';
import { checkOrigin } from '@/lib/origin-check';
import {
  getMissingRequiredFields,
  validateBookingCustomerInfo,
  validateNumberOfGuests,
  validateBookingDate,
} from '@/lib/validation';
import { ACTIVE_BOOKING_STATUSES } from '@/lib/constants/booking-status';
import { getKrwPerUsd } from '@/lib/exchange/usdBasedRates.server';
import {
  tourListPricesToUsdSync,
  mapNestedTourRowsToUsd,
} from '@/lib/tour-list-price-usd.server';

/**
 * GET /api/bookings
 * Get current user's bookings (authentication required; userId from session only)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req, { skipRoleLookup: true });
    if (!user) {
      return ErrorResponses.unauthorized('Authentication required');
    }

    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const scope = searchParams.get('scope');
    const requestedLimit = Number(searchParams.get('limit'));
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100)
      : null;
    const today = new Date().toISOString().slice(0, 10);

    // Build query
    let query = supabase
      .from('bookings')
      .select(`
        *,
        tours (
          id,
          slug,
          title,
          city,
          image_url,
          price,
          original_price,
          price_currency,
          price_type
        ),
        pickup_points (
          id,
          name,
          address,
          pickup_time
        )
      `)
      .eq('user_id', user.id);

    if (status) {
      query = query.eq('status', status);
    }

    if (scope === 'upcoming') {
      query = query
        .in('status', ['confirmed', 'pending'])
        .gte('tour_date', today)
        .order('tour_date', { ascending: true });
    } else if (scope === 'history') {
      query = query
        .in('status', ['completed', 'cancelled'])
        .order('tour_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data: bookings, error } = await query;

    if (error) {
      throw error; // handleApiError가 처리
    }

    const mapped = await mapNestedTourRowsToUsd(bookings || []);

    return NextResponse.json({ bookings: mapped });
  } catch (error: any) {
    return handleApiError(error, req);
  }
}

/**
 * POST /api/bookings
 * Create a new booking
 */
export async function POST(req: NextRequest) {
  const originBlock = checkOrigin(req);
  if (originBlock) return originBlock;

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
      if (process.env.NODE_ENV !== 'production') {
        console.error('Missing required fields:', body);
      } else {
        console.error('Missing required fields:', missing);
      }
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
      .select('id, merchant_id, price, original_price, price_currency, price_type')
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
    
    // Server-authoritative pricing: USD unit + total computed from the tours row.
    // Client `finalPrice` is verified against the server total within $0.01; we never store
    // or charge a client-supplied amount. See lib/tour-list-price-usd.server.ts.
    const krwPerUsd = await getKrwPerUsd();
    const { priceUsd: listUnitUsd } = tourListPricesToUsdSync(
      {
        price: tour.price,
        original_price: tour.original_price,
        price_currency: (tour as { price_currency?: string }).price_currency,
      },
      krwPerUsd
    );
    if (!Number.isFinite(listUnitUsd) || listUnitUsd <= 0) {
      console.error('Server price unavailable for tour', tourId, 'tour.price=', tour.price);
      return NextResponse.json(
        { error: 'Tour price is not configured', code: 'PRICE_UNAVAILABLE' },
        { status: 500 }
      );
    }
    const guestsCount = parseInt(String(numberOfGuests), 10);
    const unitPrice = listUnitUsd;
    const totalPrice = tour.price_type === 'person'
      ? Math.round(unitPrice * guestsCount * 100) / 100
      : Math.round(unitPrice * 100) / 100;

    const clientFinalPrice = parseFloat(String(finalPrice));
    if (!Number.isFinite(clientFinalPrice) || Math.abs(clientFinalPrice - totalPrice) > 0.01) {
      console.warn('Price mismatch attempt', { clientFinalPrice, serverTotalPrice: totalPrice, tourId, guestsCount });
      return NextResponse.json(
        {
          error: 'Price mismatch — please refresh and try again',
          code: 'PRICE_MISMATCH',
          serverTotalPrice: totalPrice,
        },
        { status: 400 }
      );
    }

    const bookingData: any = {
      tour_id: tourIdStr,
      merchant_id: tour.merchant_id || null,
      booking_reference: `A2C-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      booking_date: bookingDateFormatted,
      tour_date: bookingDateFormatted,
      number_of_guests: guestsCount,
      unit_price: unitPrice,
      total_price: totalPrice,
      final_price: totalPrice, // Server-authoritative; never client-supplied
      payment_method: paymentMethod || 'pending',
      payment_status: 'pending',
      status: 'pending',
    };
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Prepared booking data:', bookingData);
    }

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

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();

    if (bookingError) {
      console.error('Error creating booking:', bookingError.code, bookingError.message);
      if (process.env.NODE_ENV !== 'production') {
        console.error('Booking data that failed:', JSON.stringify(bookingData, null, 2));
      }
      return NextResponse.json(
        { error: 'Failed to create booking', code: bookingError.code },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('Booking created successfully:', booking?.id);
    }

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

    // Confirmation email: only sent from the Stripe webhook/payment confirmation flow.
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
