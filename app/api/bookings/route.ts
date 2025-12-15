import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError, ErrorResponses } from '@/lib/error-handler';

/**
 * GET /api/bookings
 * Get user's bookings (requires authentication)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get auth token from Authorization header or cookie
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }

    // If no auth, try to get from session (for client-side calls)
    // For now, allow unauthenticated requests but filter by user_id if provided
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('userId');

    if (!userId && !requestedUserId) {
      return ErrorResponses.unauthorized('Authentication required or userId parameter required');
    }

    const targetUserId = userId || requestedUserId;
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
          address
        )
      `)
      .eq('user_id', targetUserId)
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
      specialRequests,
      customerInfo, // { name, email, phone, preferredChatApp, chatAppContact }
    } = body;

    if (!tourId || !bookingDate || !numberOfGuests || !finalPrice) {
      return ErrorResponses.validationError(
        'Missing required fields: tourId, bookingDate, numberOfGuests, finalPrice'
      );
    }

    // Get tour to fetch merchant_id
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('id, merchant_id')
      .eq('id', tourId)
      .single();

    if (tourError || !tour) {
      return ErrorResponses.notFound('Tour');
    }

    // Try to get user from auth (optional - guest bookings allowed)
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
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
      .in('status', ['pending', 'confirmed']);

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
    const bookingData: any = {
      tour_id: tourId,
      merchant_id: tour.merchant_id,
      booking_date: bookingDate,
      number_of_guests: numberOfGuests,
      final_price: finalPrice,
      payment_method: paymentMethod || 'pending',
      payment_status: 'pending',
      status: 'pending',
    };

    if (userId) {
      bookingData.user_id = userId;
    }

    if (pickupPointId) {
      bookingData.pickup_point_id = pickupPointId;
    }

    if (specialRequests) {
      bookingData.special_requests = specialRequests;
    }

    // Store customer info in special_requests if no user_id
    if (!userId && customerInfo) {
      bookingData.special_requests = JSON.stringify({
        ...customerInfo,
        ...(specialRequests ? { requests: specialRequests } : {}),
      });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();

    if (bookingError) {
      console.error('Error creating booking:', bookingError);
      return NextResponse.json(
        { error: 'Failed to create booking', details: bookingError.message },
        { status: 500 }
      );
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

    // Send confirmation email based on payment method
    // For deposit payments, send email immediately
    // For full payments, email will be sent after payment confirmation (via Stripe webhook)
    const shouldSendEmail = booking.status === 'confirmed' || 
                            paymentMethod === 'deposit' || 
                            paymentMethod === 'full' && booking.payment_status === 'paid';

    if (shouldSendEmail) {
      try {
        // Get tour details for email
        const { data: tourData } = await supabase
          .from('tours')
          .select('title, image_url')
          .eq('id', tourId)
          .single();

        // Get pickup point details if available
        let pickupPointName = null;
        if (pickupPointId) {
          const { data: pickupData } = await supabase
            .from('pickup_points')
            .select('name, address')
            .eq('id', pickupPointId)
            .single();
          pickupPointName = pickupData?.name || pickupData?.address || null;
        }

        // Get customer email
        let customerEmail = null;
        let customerName = 'Guest';
        
        if (userId) {
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('email, full_name')
            .eq('id', userId)
            .single();
          customerEmail = userProfile?.email;
          customerName = userProfile?.full_name || customerName;
        } else if (customerInfo) {
          customerEmail = customerInfo.email;
          customerName = customerInfo.name || customerName;
        }

        if (customerEmail && tourData) {
          const { sendBookingConfirmationEmail } = await import('@/lib/email');
          const emailResult = await sendBookingConfirmationEmail({
            to: customerEmail,
            bookingId: booking.id,
            tourTitle: tourData.title,
            bookingDate: bookingDate,
            numberOfGuests: numberOfGuests,
            totalPrice: parseFloat(finalPrice.toString()),
            pickupPoint: pickupPointName || undefined,
            paymentMethod: paymentMethod || 'pending',
            customerName,
          });

          if (emailResult.success) {
            console.log(`Confirmation email sent to ${customerEmail} for booking ${booking.id}`);
          } else {
            console.error(`Failed to send confirmation email: ${emailResult.error}`);
          }
        }
      } catch (emailError) {
        // Log error but don't fail the booking
        console.error('Error sending confirmation email:', emailError);
      }
    }

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
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

