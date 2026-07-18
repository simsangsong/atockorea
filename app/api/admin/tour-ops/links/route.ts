import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { ensureRoom, type RoomDbClient } from '@/lib/tour-room/access';
import { hashToken, signCustomerRoomToken, signDriverRoomToken, signGuideRoomToken } from '@/lib/tour-room/token';

export const dynamic = 'force-dynamic';

/**
 * Ops-dashboard link minting (copy/QR, no email).
 *
 * POST /api/admin/tour-ops/links { bookingId, role: 'customer' | 'guide' | 'driver' }
 * Mints a fresh invite token for the booking (customer scope) or its
 * tour-date (guide scope), records it in the invites ledger with
 * sent_via='ops-link', ensures the room row exists, and returns the join URL
 * plus a QR data URL for on-the-spot scanning.
 *
 * Deliberately does NOT revoke prior invites: copying a link for the guide's
 * phone must not kill the link the customer already got by email. Email
 * dispatch (/dispatch-room) remains the revoke-and-replace path.
 */

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com').replace(/\/$/, '');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as { bookingId?: string; role?: string };
    const bookingId = typeof body.bookingId === 'string' ? body.bookingId : '';
    const role =
      body.role === 'guide' || body.role === 'customer' || body.role === 'driver' ? body.role : null;
    if (!bookingId || !role) {
      return NextResponse.json({ error: 'bookingId and role (customer|guide|driver) required' }, { status: 400 });
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, tour_id, tour_date, contact_name, contact_email, status')
      .eq('id', bookingId)
      .single();
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    if (booking.status === 'cancelled') {
      return NextResponse.json({ error: 'Booking is cancelled — links stay revoked' }, { status: 409 });
    }
    if (!booking.tour_date) {
      return NextResponse.json({ error: 'Booking has no tour_date' }, { status: 409 });
    }

    // The room row itself ("룸 생성") — joining also creates it lazily, but
    // creating it here makes the new room visible to /rooms immediately.
    await ensureRoom(supabase as unknown as RoomDbClient, booking);

    let token: string;
    let expiresAt: string;
    const ledger: Record<string, unknown> = {
      role,
      sent_via: 'ops-link',
      created_by: admin.id,
    };
    if (role === 'customer') {
      const minted = signCustomerRoomToken({
        bookingId: booking.id,
        displayName: booking.contact_name || 'Guest',
        tourDate: booking.tour_date,
      });
      token = minted.token;
      expiresAt = new Date(minted.payload.exp * 1000).toISOString();
      ledger.booking_id = booking.id;
      ledger.display_name = booking.contact_name || 'Guest';
      ledger.sent_to = booking.contact_email ?? null;
    } else {
      if (!booking.tour_id) {
        return NextResponse.json({ error: 'Booking has no tour — cannot mint this link' }, { status: 409 });
      }
      // guide and driver share the tour-date scope; the driver token opens the
      // KO console and passes the vehicle-plate PIN gate (P-D3).
      const minted =
        role === 'driver'
          ? signDriverRoomToken({ tourId: booking.tour_id, tourDate: booking.tour_date, displayName: '기사님' })
          : signGuideRoomToken({ tourId: booking.tour_id, tourDate: booking.tour_date, displayName: 'Guide' });
      token = minted.token;
      expiresAt = new Date(minted.payload.exp * 1000).toISOString();
      ledger.tour_id = booking.tour_id;
      ledger.tour_date = booking.tour_date;
      ledger.display_name = role === 'driver' ? '기사님' : 'Guide';
    }
    ledger.token_hash = hashToken(token);
    ledger.expires_at = expiresAt;

    const { error: ledgerError } = await supabase.from('tour_room_invites').insert(ledger);
    if (ledgerError) throw ledgerError;

    const url =
      role === 'driver'
        ? `${appUrl()}/tour-mode/driver?rt=${encodeURIComponent(token)}`
        : role === 'guide'
          ? `${appUrl()}/tour-mode/guide?rt=${encodeURIComponent(token)}`
          : `${appUrl()}/tour-mode/room/${booking.id}?rt=${encodeURIComponent(token)}`;
    let qrDataUrl: string | null = null;
    try {
      qrDataUrl = await QRCode.toDataURL(url, { width: 360, margin: 1 });
    } catch {
      qrDataUrl = null; // QR is a nice-to-have; the link is the deliverable
    }

    return NextResponse.json({ role, url, expires_at: expiresAt, qr_data_url: qrDataUrl }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('POST /api/admin/tour-ops/links error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
