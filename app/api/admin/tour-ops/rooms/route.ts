import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { kstToday } from '@/lib/tour-room/time';

export const dynamic = 'force-dynamic';

/**
 * T7.1 — ops-center room aggregates.
 *
 * GET /api/admin/tour-ops/rooms[?date=YYYY-MM-DD]
 * Active rooms for the date (default: today KST) with the signals the
 * console sorts by: SOS (any metadata.kind='sos' in the feed — pinned),
 * last message, message count, participant count. The console pairs this
 * with a client-side Postgres-Changes subscription on tour_room_messages
 * (the M-6 admin SELECT policy + publication exist exactly for this, R-4).
 */

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const date = req.nextUrl.searchParams.get('date') || kstToday();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const { data: rooms, error } = await supabase
      .from('tour_rooms')
      .select('id, booking_id, tour_id, tour_date, status, created_at')
      .eq('tour_date', date);
    if (error) throw error;
    const roomIds = (rooms ?? []).map((room) => room.id);
    const bookingIds = (rooms ?? []).map((room) => room.booking_id);

    const [{ data: bookings }, { data: tours }, { data: participants }, { data: messages }] = await Promise.all([
      bookingIds.length
        ? supabase.from('bookings').select('id, contact_name, contact_phone, number_of_guests, preferred_language, status').in('id', bookingIds)
        : Promise.resolve({ data: [] }),
      supabase.from('tours').select('id, title, city'),
      roomIds.length
        ? supabase.from('tour_room_participants').select('room_id, role, display_name, locale, last_seen_at').in('room_id', roomIds)
        : Promise.resolve({ data: [] }),
      roomIds.length
        ? supabase
            .from('tour_room_messages')
            .select('id, room_id, sender_role, source_text, metadata, created_at')
            .in('room_id', roomIds)
            .order('created_at', { ascending: false })
            .limit(300)
        : Promise.resolve({ data: [] }),
    ]);

    const bookingById = new Map((bookings ?? []).map((booking) => [booking.id, booking]));
    const tourById = new Map((tours ?? []).map((tour) => [tour.id, tour]));
    const byRoom = new Map<string, Array<Record<string, unknown>>>();
    for (const message of messages ?? []) {
      const list = byRoom.get(message.room_id) ?? [];
      list.push(message);
      byRoom.set(message.room_id, list);
    }

    const out = (rooms ?? []).map((room) => {
      const roomMessages = byRoom.get(room.id) ?? [];
      const sos = roomMessages.find((message) => (message.metadata as { kind?: string } | null)?.kind === 'sos');
      return {
        ...room,
        booking: bookingById.get(room.booking_id) ?? null,
        tour: room.tour_id ? tourById.get(room.tour_id) ?? null : null,
        participants: (participants ?? []).filter((participant) => participant.room_id === room.id),
        message_count: roomMessages.length,
        last_message: roomMessages[0] ?? null,
        sos: sos ?? null,
        // W3.2 — boarding tally, same signal the guide overview uses (T6.4).
        onboard_ack: roomMessages.some(
          (message) => (message.metadata as { kind?: string } | null)?.kind === 'onboard_ack',
        ),
      };
    });

    // SOS rooms pinned first, then by latest activity (T7.3).
    out.sort((a, b) => {
      if (Boolean(a.sos) !== Boolean(b.sos)) return a.sos ? -1 : 1;
      const at = (a.last_message?.created_at as string | undefined) ?? '';
      const bt = (b.last_message?.created_at as string | undefined) ?? '';
      return at < bt ? 1 : -1;
    });

    return NextResponse.json({
      date,
      rooms: out,
      sos_count: out.filter((room) => room.sos).length,
    });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('GET /api/admin/tour-ops/rooms error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
