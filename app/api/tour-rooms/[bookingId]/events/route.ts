import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';

export const dynamic = 'force-dynamic';

const encoder = new TextEncoder();

function normalized(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getBookingForRoom(
  supabase: ReturnType<typeof createServerClient>,
  bookingId: string,
) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, user_id, tour_id, merchant_id, tour_date, contact_name, contact_email')
    .eq('id', bookingId)
    .single();
  if (error || !data) return null;
  return data;
}

async function ensureRoom(
  supabase: ReturnType<typeof createServerClient>,
  booking: { id: string; tour_id?: string | null; tour_date?: string | null },
) {
  const { data, error } = await supabase
    .from('tour_rooms')
    .upsert(
      {
        booking_id: booking.id,
        tour_id: booking.tour_id ?? null,
        tour_date: booking.tour_date ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'booking_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

function isMerchantGuideForBooking(
  user: Awaited<ReturnType<typeof getAuthUser>>,
  booking: { merchant_id?: string | null },
): boolean {
  return Boolean(user?.role === 'merchant' && user.merchantId && booking.merchant_id === user.merchantId);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const user = await getAuthUser(req);
    const booking = await getBookingForRoom(supabase, bookingId);
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const guestEmail = req.nextUrl.searchParams.get('contactEmail');
    const guestName = req.nextUrl.searchParams.get('contactName');
    const guestMatches =
      normalized(booking.contact_email) === normalized(guestEmail) &&
      (!guestName || normalized(booking.contact_name) === normalized(guestName));
    const isOwner = Boolean(user?.id && user.id === booking.user_id);
    const isAdmin = user?.role === 'admin';
    const isMerchantGuide = isMerchantGuideForBooking(user, booking);
    const authedByRole = isOwner || isAdmin || isMerchantGuide;

    // PA-4: the guest path authorizes by matching contact_email against a public
    // bookingId, with no lockout — an attacker could spray emails to enumerate.
    // Throttle the unauthenticated guest path per-IP (authed roles bypass).
    if (!authedByRole) {
      const gate = await requestGate({
        namespace: 'tour_room_guest',
        key: clientIpKey(req.headers),
        perMinute: 15,
        perHour: 60,
      });
      if (!gate.allowed) {
        return NextResponse.json(
          { error: 'rate_limited' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil(gate.retryAfterMs / 1000)) } },
        );
      }
    }

    if (!authedByRole && !guestMatches) {
      return NextResponse.json({ error: 'Access denied for this tour room' }, { status: 403 });
    }

    const room = await ensureRoom(supabase, booking);
    const initialAfter = req.nextUrl.searchParams.get('after') || new Date(0).toISOString();

    const stream = new ReadableStream({
      async start(controller) {
        let after = initialAfter;
        controller.enqueue(encoder.encode(`event: room\ndata: ${JSON.stringify(room)}\n\n`));

        while (!req.signal.aborted) {
          const { data, error } = await supabase
            .from('tour_room_messages')
            .select('*')
            .eq('room_id', room.id)
            .gt('created_at', after)
            .order('created_at', { ascending: true })
            .limit(50);

          if (error) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`));
            break;
          }

          for (const message of data ?? []) {
            after = message.created_at;
            controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(message)}\n\n`));
          }

          controller.enqueue(encoder.encode(': heartbeat\n\n'));
          await sleep(2000);
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/events error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
