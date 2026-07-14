import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { isTourModeEnabled } from '@/lib/tour-room/flags';
import { dispatchRoomInvites, type DispatchDbClient } from '@/lib/tour-room/dispatch';

export const dynamic = 'force-dynamic';

/**
 * T5.3 — admin "투어룸 발송" action for one order.
 *
 * POST — (re)dispatch the room invites: mints fresh tokens, revokes the
 * previous ones in scope, emails customer + guide. Guarded by the launch
 * flag: while NEXT_PUBLIC_TOUR_MODE_V1 is off the links would open the
 * coming-soon page, so dispatch requires `force: true` to override.
 *
 * GET — dispatch history (the invites ledger for this booking).
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await params;
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as { force?: boolean; includeGuide?: boolean };

    if (!isTourModeEnabled() && body.force !== true) {
      return NextResponse.json(
        { error: 'Tour Mode flag is off — links would open the coming-soon page. Pass force:true to dispatch anyway.' },
        { status: 409 },
      );
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, tour_id, merchant_id, tour_date, tour_time, contact_name, contact_email, preferred_language, status')
      .eq('id', id)
      .single();
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    if (booking.status === 'cancelled') {
      return NextResponse.json({ error: 'Booking is cancelled — links stay revoked' }, { status: 409 });
    }

    const result = await dispatchRoomInvites(supabase as unknown as DispatchDbClient, booking, {
      createdBy: admin.id,
      includeGuide: body.includeGuide !== false,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('POST /api/admin/orders/[id]/dispatch-room error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const supabase = createServerClient();

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, tour_id, tour_date')
      .eq('id', id)
      .single();
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    // History: this booking's customer invites + the tour-date's guide invites.
    const [customerRes, guideRes] = await Promise.all([
      supabase
        .from('tour_room_invites')
        .select('id, role, sent_to, sent_via, expires_at, revoked_at, created_at')
        .eq('booking_id', id)
        .order('created_at', { ascending: false }),
      booking.tour_id && booking.tour_date
        ? supabase
            .from('tour_room_invites')
            .select('id, role, sent_to, sent_via, expires_at, revoked_at, created_at')
            .eq('tour_id', booking.tour_id)
            .eq('tour_date', booking.tour_date)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    return NextResponse.json({
      customer_invites: customerRes.data ?? [],
      guide_invites: guideRes.data ?? [],
    });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
