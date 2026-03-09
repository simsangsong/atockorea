import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { TourRelation, UserProfileRelation, PickupPointRelation } from '@/lib/db-relations';

/**
 * GET /api/bookings/[id]
 * Get a single booking by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const bookingId = params.id;

    const { data: booking, error } = await supabase
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
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch booking', details: error?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ booking });
  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bookings/[id]
 * Update a booking
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const bookingId = params.id;
    const body = await req.json();

    // Get user from auth
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if booking exists and belongs to user
    const { data: existingBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('user_id')
      .eq('id', bookingId)
      .single();

    if (fetchError || !existingBooking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    if (existingBooking.user_id !== userId) {
      return NextResponse.json(
        { error: 'You can only update your own bookings' },
        { status: 403 }
      );
    }

    // Get existing booking to check status change (reuse existingBooking from above)
    // We already have existingBooking with user_id, now get full details
    const { data: currentBooking, error: currentBookingError } = await supabase
      .from('bookings')
      .select('status, booking_date, number_of_guests, tour_id')
      .eq('id', bookingId)
      .single();

    if (currentBookingError || !currentBooking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Update booking
    const updateData: { status?: string; payment_status?: string } = {};
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.payment_status !== undefined) {
      updateData.payment_status = body.payment_status;
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId)
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
      .single();

    if (error) {
      console.error('Error updating booking:', error);
      return NextResponse.json(
        { error: 'Failed to update booking', details: error.message },
        { status: 500 }
      );
    }

    // Update inventory if booking was cancelled
    if (currentBooking && body.status === 'cancelled' && currentBooking.status !== 'cancelled') {
      try {
        const rawDate = currentBooking.booking_date;
        const dateStr = rawDate != null ? String(rawDate).split('T')[0] : null;
        if (dateStr) {
        const { data: inventory } = await supabase
          .from('product_inventory')
          .select('*')
          .eq('tour_id', currentBooking.tour_id)
          .eq('tour_date', dateStr)
          .single();

        if (inventory) {
          // Restore available spots
          const newAvailableSpots = (inventory.available_spots || 0) + (currentBooking.number_of_guests || 1);
          await supabase
            .from('product_inventory')
            .update({
              available_spots: newAvailableSpots,
              updated_at: new Date().toISOString(),
            })
            .eq('id', inventory.id);
        }
        }
      } catch (inventoryError) {
        console.error('Error updating inventory on cancellation:', inventoryError);
      }

      // Send cancellation email
      try {
        const { data: bookingWithDetails } = await supabase
          .from('bookings')
          .select(`
            *,
            tours (title),
            user_profiles (email, full_name)
          `)
          .eq('id', bookingId)
          .single();

        if (bookingWithDetails) {
          const tour = bookingWithDetails.tours as TourRelation | null | undefined;
          const userProfile = bookingWithDetails.user_profiles as UserProfileRelation | null | undefined;
          
          let customerEmail = null;
          let customerName = 'Guest';
          
          if (userProfile) {
            customerEmail = userProfile.email;
            customerName = userProfile.full_name || customerName;
          } else {
            // Try to get from special_requests
            try {
              const specialRequests = JSON.parse(bookingWithDetails.special_requests || '{}');
              customerEmail = specialRequests.email || specialRequests.customer_email;
              customerName = specialRequests.name || specialRequests.customer_name || customerName;
            } catch (e) {
              // Ignore parse errors
            }
          }

          if (customerEmail && tour) {
            const { sendBookingCancellationEmail } = await import('@/lib/email');
            await sendBookingCancellationEmail({
              to: customerEmail,
              bookingId: bookingId,
              tourTitle: tour?.title ?? 'Booking',
              bookingDate: bookingWithDetails.booking_date,
              refundAmount: parseFloat(String(bookingWithDetails.final_price ?? 0)),
              refundEligible: bookingWithDetails.refund_eligible !== false,
              customerName,
            });
          }

          // Create cancellation notification
          if (bookingWithDetails.user_id) {
            try {
              const { notifyBookingCancelled } = await import('@/lib/notifications');
              const tourTitleForNotification = tour?.title ?? 'Booking';
              await notifyBookingCancelled(
                bookingId,
                bookingWithDetails.user_id,
                tourTitleForNotification,
                bookingWithDetails.refund_eligible ? parseFloat(String(bookingWithDetails.final_price ?? 0)) : undefined
              );
            } catch (notificationError) {
              console.error('Error creating notification:', notificationError);
            }
          }
        }
      } catch (emailError) {
        console.error('Error sending cancellation email:', emailError);
      }
    }

    // Send confirmation email only when status changed to confirmed AND payment is completed (결제 완료 시에만)
    if (currentBooking && body.status === 'confirmed' && currentBooking.status !== 'confirmed') {
      const { data: bookingWithDetails } = await supabase
        .from('bookings')
        .select('payment_status, booking_date, number_of_guests, final_price, payment_method, special_requests, tour_id, pickup_point_id, user_id')
        .eq('id', bookingId)
        .single();

      const isPaid = bookingWithDetails?.payment_status === 'paid';
      if (isPaid) {
        try {
          const { data: fullBooking } = await supabase
            .from('bookings')
            .select(`
              *,
              tours (id, title, image_url),
              pickup_points (name, address),
              user_profiles (email, full_name)
            `)
            .eq('id', bookingId)
            .single();

          if (fullBooking) {
            const tour = fullBooking.tours as TourRelation | null | undefined;
            const pickupPoint = fullBooking.pickup_points as PickupPointRelation | null | undefined;
            const userProfile = fullBooking.user_profiles as UserProfileRelation | null | undefined;
            let customerEmail = userProfile?.email ?? null;
            let customerName = userProfile?.full_name || 'Guest';
            if (!customerEmail) {
              try {
                const sr = JSON.parse(fullBooking.special_requests || '{}');
                customerEmail = sr.email || sr.customer_email;
                customerName = sr.name || sr.customer_name || customerName;
              } catch {
                // ignore
              }
            }
            if (customerEmail && tour) {
              const { sendBookingConfirmationEmail } = await import('@/lib/email');
              await sendBookingConfirmationEmail({
                to: customerEmail,
                bookingId: bookingId,
                tourTitle: tour.title ?? '',
                bookingDate: fullBooking.booking_date,
                numberOfGuests: fullBooking.number_of_guests || 1,
                totalPrice: parseFloat(String(fullBooking.final_price ?? 0)),
                pickupPoint: pickupPoint?.name || pickupPoint?.address || undefined,
                paymentMethod: fullBooking.payment_method || 'pending',
                paymentStatus: 'paid',
                customerName,
                tourId: tour.id != null ? String(tour.id) : undefined,
                tourImageUrl: tour.image_url,
              });
            }
          }
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
        }
      }
    }

    return NextResponse.json({ booking, message: 'Booking updated successfully' });
  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

