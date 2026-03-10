import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/orders/[id]
 * Get a single order (booking) by ID. Admin only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const { id } = params;

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        tours (
          id,
          title,
          slug,
          city,
          image_url,
          price,
          price_type
        ),
        user_profiles (
          id,
          full_name,
          email,
          phone
        ),
        pickup_points (
          id,
          name,
          address
        )
      `)
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

    return NextResponse.json({ booking });
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
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const { id } = params;
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
    if (body.status !== undefined) updateData.status = body.status;
    if (body.payment_status !== undefined) updateData.payment_status = body.payment_status;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        tours ( id, title, slug, city, image_url, price, price_type ),
        user_profiles ( id, full_name, email, phone ),
        pickup_points ( id, name, address )
      `)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update order', details: error.message },
        { status: 500 }
      );
    }

    // On cancel: restore inventory and send cancellation email (same logic as public PUT)
    if (body.status === 'cancelled' && existing.status !== 'cancelled') {
      try {
        const dateStr = existing.booking_date?.toString().split('T')[0];
        if (dateStr) {
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
          .select('*, tours(title), user_profiles(email, full_name)')
          .eq('id', id)
          .single();
        if (b) {
          const tour = b.tours as { title?: string } | null;
          const profile = b.user_profiles as { email?: string; full_name?: string } | null;
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
          if (customerEmail && tour?.title) {
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

    return NextResponse.json({ booking, message: 'Order updated successfully' });
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
