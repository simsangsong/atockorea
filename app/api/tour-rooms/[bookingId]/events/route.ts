import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';

export const dynamic = 'force-dynamic';

const encoder = new TextEncoder();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    // PA-4: the guest email-match path stays throttled per-IP; the gate only
    // fires when no stronger credential (admin/token/session/owner/merchant)
    // authenticated the request — same ordering as before the refactor.
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
