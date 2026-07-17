import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { verifyRoomToken } from '@/lib/tour-room/token';
import { roomLifecycle } from '@/lib/tour-room/time';

export const dynamic = 'force-dynamic';

/**
 * T6.2 — the guide console's data bundle for one tour day.
 *
 * GET /api/tour-mode/guide/overview?rt=<guide token>
 * (admins may instead pass ?tourId=&tourDate= with their login)
 *
 * Returns the day's rooms (one per booking, D-3) with headcount signals —
 * participants online-ish, onboard acks (T6.4), last message — plus a merged
 * recent feed tagged by room for the unified view. Guide tokens only (AC):
 * the tour-date scope is the console's authorization boundary (§O-3).
 */

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();

    let tourId: string | null = null;
    let tourDate: string | null = null;
    const token = req.nextUrl.searchParams.get('rt') ?? req.headers.get('x-tour-room-token');
    const payload = token ? verifyRoomToken(token) : null;
    if (payload?.scope === 'tour-date' && payload.role === 'guide') {
      // P-D15: driver tokens share the scope but get the PII-minimal
      // /api/tour-mode/driver/overview instead.
      tourId = payload.tourId;
      tourDate = payload.tourDate;
    } else {
      const user = await getAuthUser(req);
      if (user?.role === 'admin') {
        tourId = req.nextUrl.searchParams.get('tourId');
        tourDate = req.nextUrl.searchParams.get('tourDate');
      }
    }
    if (!tourId || !tourDate) {
      return NextResponse.json({ error: 'A guide tour-date token is required' }, { status: 403 });
    }

    const [{ data: tour }, { data: bookings }] = await Promise.all([
      supabase.from('tours').select('id, title, city').eq('id', tourId).single(),
      supabase
        .from('bookings')
        .select('id, contact_name, number_of_guests, preferred_language, status, pickup_points ( name, pickup_time )')
        .eq('tour_id', tourId)
        .eq('tour_date', tourDate)
        .neq('status', 'cancelled'),
    ]);

    const bookingIds = (bookings ?? []).map((booking) => booking.id);
    const { data: rooms } = bookingIds.length
      ? await supabase.from('tour_rooms').select('id, booking_id, status').in('booking_id', bookingIds)
      : { data: [] };
    const roomByBooking = new Map((rooms ?? []).map((room) => [room.booking_id, room]));
    const roomIds = (rooms ?? []).map((room) => room.id);

    const [{ data: participants }, { data: messages }, { data: dayPlans }] = await Promise.all([
      roomIds.length
        ? supabase
            .from('tour_room_participants')
            .select('room_id, role, display_name, locale, last_seen_at, location_sharing')
            .in('room_id', roomIds)
        : Promise.resolve({ data: [] }),
      roomIds.length
        ? supabase
            .from('tour_room_messages')
            .select('id, room_id, sender_role, source_text, translations, metadata, created_at')
            .in('room_id', roomIds)
            .order('created_at', { ascending: false })
            .limit(60)
        : Promise.resolve({ data: [] }),
      // W0.2 — private-mode day plans for the day (all statuses: the guide
      // console is where guest_draft plans get reviewed and confirmed in W1).
      bookingIds.length
        ? supabase
            .from('tour_day_plans')
            .select('id, booking_id, status, version, stops, updated_at')
            .in('booking_id', bookingIds)
            .eq('tour_date', tourDate)
        : Promise.resolve({ data: [] }),
    ]);
    const dayPlanByBooking = new Map(
      ((dayPlans ?? []) as Array<{ booking_id: string }>).map((plan) => [plan.booking_id, plan]),
    );

    const byRoom = new Map<string, Array<Record<string, unknown>>>();
    for (const message of messages ?? []) {
      const list = byRoom.get(message.room_id) ?? [];
      list.push(message);
      byRoom.set(message.room_id, list);
    }

    const roomsOut = (bookings ?? []).map((booking) => {
      const room = roomByBooking.get(booking.id) ?? null;
      const roomMessages = room ? byRoom.get(room.id) ?? [] : [];
      const pickup = Array.isArray(booking.pickup_points) ? booking.pickup_points[0] : booking.pickup_points;
      const dayPlan = dayPlanByBooking.get(booking.id) as
        | { id: string; status: string; version: number; stops: unknown; updated_at: string }
        | undefined;
      return {
        booking_id: booking.id,
        room_id: room?.id ?? null,
        day_plan: dayPlan
          ? {
              id: dayPlan.id,
              status: dayPlan.status,
              version: dayPlan.version,
              stops_count: Array.isArray(dayPlan.stops) ? dayPlan.stops.length : 0,
              updated_at: dayPlan.updated_at,
            }
          : null,
        contact_name: booking.contact_name,
        number_of_guests: booking.number_of_guests,
        preferred_language: booking.preferred_language,
        pickup: pickup ?? null,
        participants: (participants ?? []).filter((p) => room && p.room_id === room.id),
        onboard_ack: roomMessages.some(
          (message) => (message.metadata as { kind?: string } | null)?.kind === 'onboard_ack',
        ),
        last_message: roomMessages[0] ?? null,
      };
    });

    return NextResponse.json({
      tour: tour ?? { id: tourId, title: 'Tour', city: null },
      tour_date: tourDate,
      lifecycle: roomLifecycle(tourDate),
      rooms: roomsOut,
      feed: (messages ?? []).slice(0, 30),
    });
  } catch (error) {
    console.error('GET /api/tour-mode/guide/overview error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
