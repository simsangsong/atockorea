import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { buildRoomSnapshot } from '@/lib/tour-room/snapshot';

export const dynamic = 'force-dynamic';

/**
 * T1.2 — cold-start / resync bundle in one round-trip (§D, §O-6).
 * Typically authorized by the x-tour-room-auth room session issued by /join;
 * every other credential resolveRoomActor understands works too. Read-only —
 * safe for visibilitychange resyncs and mail-scanner prefetches alike.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    const resolved = await resolveRoomActor(req, bookingId, {
      supabase,
      guestEmail: req.nextUrl.searchParams.get('contactEmail'),
      guestName: req.nextUrl.searchParams.get('contactName'),
      guestGate: () =>
        requestGate({
          namespace: 'tour_room_guest',
          key: clientIpKey(req.headers),
          perMinute: 15,
          perHour: 60,
        }),
    });
    if (!resolved.ok) {
      if (resolved.status === 429) {
        return NextResponse.json(
          { error: 'rate_limited' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((resolved.retryAfterMs ?? 0) / 1000)) } },
        );
      }
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const room = await ensureRoom(supabase, resolved.booking);
    const snapshot = await buildRoomSnapshot(supabase, resolved.booking, room);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('GET /api/tour-mode/room/[bookingId]/snapshot error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
