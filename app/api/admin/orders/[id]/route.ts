import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import {
  isValidAdminStatus,
  isAllowedStatusTransition,
} from '@/lib/admin/booking-status-transition';
import { releaseCouponForBooking } from '@/lib/coupons/settlement';
import { revokeRoomForCancelledBooking } from '@/lib/tour-room/dispatch';

export const dynamic = 'force-dynamic';

async function hydrateBookingRelations(
  supabase: ReturnType<typeof createServerClient>,
  booking: any,
) {
  const [tourRes, profileRes, pickupRes] = await Promise.all([
    booking.tour_id
      ? supabase
          .from('tours')
          .select('id, title, slug, city, image_url, price, price_type')
          .eq('id', booking.tour_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    booking.user_id
      ? supabase
          .from('user_profiles')
          .select('id, full_name, email, phone')
          .eq('id', booking.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    booking.pickup_point_id
      ? supabase
          .from('pickup_points')
          .select('id, name, address')
          .eq('id', booking.pickup_point_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...booking,
    tours: tourRes.data ?? null,
    user_profiles: profileRes.data ?? null,
    pickup_points: pickupRes.data ?? null,
  };
}

/**
 * GET /api/admin/orders/[id]
 * Get a single order (booking) by ID. Admin only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAdmin(req);
    const supabase = createServerClient();

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !booking) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Failed to fetch order', details: error?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ booking: await hydrateBookingRelations(supabase, booking) });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('GET /api/admin/orders/[id] error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/orders/[id]
 * Update order status (and optionally payment_status). Admin only.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAdmin(req);
    const supabase = createServerClient();
    const body = await req.json();

    const { data: existing } = await supabase
      .from('bookings')
      .select('status, booking_date, number_of_guests, tour_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.payment_status !== undefined) {
      return NextResponse.json(
        { error: 'payment_status must be changed through payment settlement or webhook flows' },
        { status: 400 }
      );
    }
    if (body.status === 'no_show') {
      return NextResponse.json(
        { error: 'Use the no-show settlement action to charge the penalty and mark no-show' },
        { status: 400 }
      );
    }
    if (body.status !== undefined) {
      // B-3: validate the value and the transition (state machine) so illegal
      // moves like completed→pending / cancelled→confirmed and arbitrary strings
      // can't be written.
      const next = String(body.status);
      if (!isValidAdminStatus(next)) {
        return NextResponse.json(
          { error: `Invalid status '${next}'. Allowed: pending, confirmed, completed, cancelled.` },
          { status: 400 }
        );
      }
      if (!isAllowedStatusTransition(existing.status as string, next)) {
        return NextResponse.json(
          { error: `Illegal status transition: ${existing.status} → ${next}.` },
          { status: 400 }
        );
      }
      updateData.status = next;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update order', details: error.message },
        { status: 500 }
      );
    }

    // On cancel: restore inventory and send cancellation email (same logic as public PUT)
    if (body.status === 'cancelled' && existing.status !== 'cancelled') {
      /** Welcome coupon: admin cancellation restores the coupon (idempotent). */
      await releaseCouponForBooking(supabase, id, 'admin_cancelled');

      // SS4O-1 (8) — Tour Mode: kill the room links and close the room.
      await revokeRoomForCancelledBooking(supabase, id);

      // Phase 10.6d — builder bookings have NULL tour_id, no inventory row
      // to restore. Skip the inventory branch loudly so the (legitimate)
      // skip doesn't read like a silent bug.
      if (!existing.tour_id) {
        console.info(`[admin/orders cancel] booking ${id} has no tour_id — skipping inventory restore (builder booking)`);
      }
      try {
        const dateStr = existing.booking_date?.toString().split('T')[0];
        if (dateStr && existing.tour_id) {
          const { data: inventory } = await supabase
            .from('product_inventory')
            .select('*')
            .eq('tour_id', existing.tour_id)
            .eq('tour_date', dateStr)
            .single();
          if (inventory) {
            const addBack = existing.number_of_guests || 1;
            await supabase
              .from('product_inventory')
              .update({
                available_spots: (inventory.available_spots || 0) + addBack,
                updated_at: new Date().toISOString(),
              })
              .eq('id', inventory.id);
          }
        }
      } catch (e) {
        console.error('Inventory restore on cancel:', e);
      }
      try {
        const { data: b } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', id)
          .single();
        if (b) {
          const hydrated = await hydrateBookingRelations(supabase, b);
          const tour = hydrated.tours as { title?: string } | null;
          const profile = hydrated.user_profiles as { email?: string; full_name?: string } | null;
          let customerEmail = profile?.email;
          let customerName = profile?.full_name || 'Guest';
          if (!customerEmail && (b as any).contact_email) {
            customerEmail = (b as any).contact_email;
            customerName = (b as any).contact_name || customerName;
          }
          if (!customerEmail && (b as any).special_requests) {
            try {
              const sr = JSON.parse((b as any).special_requests);
              customerEmail = sr.email || sr.customer_email;
              customerName = sr.name || sr.customer_name || customerName;
            } catch (e) {
              // special_requests may be invalid JSON; use existing customerEmail/customerName
            }
          }
          /**
           * Phase 10.6d — branch on `source`. Builder bookings have NO
           * `tour.title` (tour_id is NULL), so the legacy
           * `if (customerEmail && tour?.title)` gate silently dropped the
           * cancellation email for them. Now: builder rows dispatch to
           * sendBuilderBookingCancellationEmail (emerald-tone parity);
           * tour-product rows take the original path.
           */
          const isBuilder = (b as { source?: string }).source === 'itinerary_builder';
          if (isBuilder && customerEmail) {
            const { sendBuilderBookingCancellationEmail } = await import(
              '@/lib/email-templates/builder-booking-cancellation'
            );
            await sendBuilderBookingCancellationEmail({
              to: customerEmail,
              bookingId: id,
              bookingReference: ((b as { booking_reference?: string | null }).booking_reference) ?? null,
              tourDate: (b as { tour_date?: string | null }).tour_date ?? null,
              numberOfGuests: (b as { number_of_guests?: number | null }).number_of_guests ?? null,
              totalKrw: parseFloat(String((b as any).final_price ?? 0)),
              customerName,
              refundEligible: (b as { refund_eligible?: boolean }).refund_eligible !== false,
            });
          } else if (customerEmail && tour?.title) {
            const { sendBookingCancellationEmail } = await import('@/lib/email');
            await sendBookingCancellationEmail({
              to: customerEmail,
              bookingId: id,
              tourTitle: tour.title,
              bookingDate: (b as any).booking_date,
              refundAmount: parseFloat((b as any).final_price),
              refundEligible: (b as any).refund_eligible !== false,
              customerName,
            });
          }
        }
      } catch (e) {
        console.error('Cancel email:', e);
      }
    }

    return NextResponse.json({
      booking: await hydrateBookingRelations(supabase, booking),
      message: 'Order updated successfully',
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('PUT /api/admin/orders/[id] error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
