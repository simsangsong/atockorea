import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { kstToday } from '@/lib/tour-room/time';

export const dynamic = 'force-dynamic';

/**
 * Ops-dashboard room/link manager backing list.
 *
 * GET /api/admin/tour-ops/bookings[?date=YYYY-MM-DD]
 * Every non-cancelled booking for the date (default: today KST) with its
 * room + invite state, so the 관제센터 홈 can create rooms and issue links
 * without a detour through each order page. Distinct from /rooms, which only
 * returns bookings whose room row already exists.
 */

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const date = req.nextUrl.searchParams.get('date') || kstToday();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(
        'id, tour_id, merchant_id, tour_date, tour_time, contact_name, contact_email, contact_phone, number_of_guests, preferred_language, status',
      )
      .eq('tour_date', date)
      .neq('status', 'cancelled');
    if (error) throw error;

    const bookingIds = (bookings ?? []).map((booking) => booking.id);
    const tourIds = [...new Set((bookings ?? []).map((booking) => booking.tour_id).filter(Boolean))] as string[];

    const [{ data: rooms }, { data: tours }, { data: invites }] = await Promise.all([
      bookingIds.length
        ? supabase.from('tour_rooms').select('id, booking_id, status').in('booking_id', bookingIds)
        : Promise.resolve({ data: [] }),
      tourIds.length
        ? supabase.from('tours').select('id, title, city').in('id', tourIds)
        : Promise.resolve({ data: [] }),
      bookingIds.length || tourIds.length
        ? supabase
            .from('tour_room_invites')
            .select('booking_id, tour_id, tour_date, role, sent_to, sent_via, revoked_at, created_at')
            .or(
              [
                bookingIds.length ? `booking_id.in.(${bookingIds.join(',')})` : null,
                tourIds.length ? `and(tour_id.in.(${tourIds.join(',')}),tour_date.eq.${date})` : null,
              ]
                .filter(Boolean)
                .join(','),
            )
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const roomByBooking = new Map((rooms ?? []).map((room) => [room.booking_id, room]));
    const tourById = new Map((tours ?? []).map((tour) => [tour.id, tour]));

    const out = (bookings ?? []).map((booking) => {
      const customerInvites = (invites ?? []).filter(
        (invite) => invite.role === 'customer' && invite.booking_id === booking.id,
      );
      const guideInvites = (invites ?? []).filter(
        (invite) => invite.role === 'guide' && invite.tour_id === booking.tour_id && invite.tour_date === date,
      );
      const lastCustomer = customerInvites[0] ?? null;
      const lastGuide = guideInvites[0] ?? null;
      return {
        ...booking,
        tour: booking.tour_id ? tourById.get(booking.tour_id) ?? null : null,
        room: roomByBooking.get(booking.id) ?? null,
        invite: {
          customer_active: customerInvites.some((invite) => !invite.revoked_at),
          customer_last: lastCustomer
            ? { sent_via: lastCustomer.sent_via, created_at: lastCustomer.created_at, revoked: Boolean(lastCustomer.revoked_at) }
            : null,
          guide_active: guideInvites.some((invite) => !invite.revoked_at),
          guide_last: lastGuide
            ? { sent_via: lastGuide.sent_via, created_at: lastGuide.created_at, revoked: Boolean(lastGuide.revoked_at) }
            : null,
        },
      };
    });

    // Group-stable ordering: by tour title, then contact name.
    out.sort((a, b) => {
      const at = (a.tour?.title as string | undefined) ?? '';
      const bt = (b.tour?.title as string | undefined) ?? '';
      if (at !== bt) return at < bt ? -1 : 1;
      return (a.contact_name ?? '') < (b.contact_name ?? '') ? -1 : 1;
    });

    return NextResponse.json({ date, bookings: out });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('GET /api/admin/tour-ops/bookings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
