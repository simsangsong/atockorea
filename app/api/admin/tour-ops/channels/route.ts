import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { kstToday } from '@/lib/tour-room/time';
import { roomChannelTopic } from '@/lib/tour-room/realtime';

export const dynamic = 'force-dynamic';

/**
 * W2.1 — Broadcast channel directory for the ops center (§3-B).
 *
 * GET /api/admin/tour-ops/channels[?date=YYYY-MM-DD]
 * Returns the secret Broadcast topics for every room on the date so the ops
 * client can subscribe to all of them directly (one WebSocket, N topics) and
 * receive messages/locations/captions with zero polling. Only the server can
 * derive topics (R-23 HMAC), which is why this endpoint exists — and why it
 * is admin-only: the topic list is the eavesdropping key to every room.
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
      .select('id, booking_id, status')
      .eq('tour_date', date);
    if (error) throw error;

    return NextResponse.json({
      date,
      channels: (rooms ?? []).map((room) => ({
        room_id: room.id,
        booking_id: room.booking_id,
        status: room.status,
        topic: roomChannelTopic(room.id, room.status ?? 'active'),
      })),
    });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('GET /api/admin/tour-ops/channels error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
