import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { resolveRoomActor } from '@/lib/tour-room/access';
import { cachedBookingForRoom, cachedEnsureRoom } from '@/lib/tour-room/reconnectCache';
import {
  nextPollInterval,
  SSE_POLL_MIN_MS,
  SSE_RECONNECT_HINT_MS,
  SSE_STREAM_BUDGET_MS,
} from '@/lib/tour-room/sseFallback';

export const dynamic = 'force-dynamic';

/**
 * K1a — the SSE fallback, hardened.
 *
 * This route is what the room degrades to when realtime drops (R-3, "degrade
 * rather than go silent"). The intent is right; the shape was not. Part K's
 * finding: a limit on ONE kind of capacity was being converted into unbounded
 * load of two other kinds — every client pushed off realtime opened a function
 * here and polled the database twice a second, and it does not take 100 rooms to
 * get there. One realtime wobble starts it.
 *
 * Three things were wrong and are fixed here. None of them needed a number we do
 * not have yet (the concurrency ceiling is K1b, after K2 establishes the plan's
 * real limits).
 *
 * 1. **No duration, so the platform decided.** With no `maxDuration` the default
 *    is 10-15s, the function is killed mid-loop, and `EventSource` reconnects —
 *    and the reconnect is the expensive event, not the polling. Declaring 60s
 *    (the maximum every plan allows) cuts reconnects several-fold on its own,
 *    and the loop now ends itself before the deadline so the function exits
 *    normally instead of being terminated.
 *
 * 2. **A fixed 2s poll.** Most rooms are idle most of the time and were paying
 *    what a busy one pays. The interval backs off to 8s while nothing arrives
 *    and snaps back to 2s the moment a message does, so latency is preserved
 *    exactly where it is noticed.
 *
 * 3. **Full auth on every reconnect.** The booking and room rows are identical
 *    for every caller, so they are memoised per instance for 15s
 *    (`reconnectCache`). The credential checks — auth user, token revocation —
 *    are deliberately NOT cached: a revoked link has to die on revocation.
 *
 * The client is also told how long to wait before reconnecting (`retry:`),
 * because the browser default of ~3s is what turns one brief outage into a
 * stampede against the auth path this route just finished paying for.
 */

/**
 * 🔴 A LITERAL, and it has to stay one.
 *
 * Next.js reads segment config statically, before any module graph exists, so
 * `export const maxDuration = SSE_MAX_DURATION_S` does not fail at runtime — it
 * fails the BUILD: "Unknown identifier SSE_MAX_DURATION_S at maxDuration",
 * followed by "Invalid segment configuration export detected". That is exactly
 * how it shipped and broke the production deploy on 2026-07-28, because a local
 * `next build` reports "Compiled successfully" first and only fails later in
 * "Collecting page data" — a grep for the success line hides it.
 *
 * So the number is written twice on purpose, and `sseFallbackDefence.test.ts`
 * asserts the two agree. A second copy with a test is a smaller problem than a
 * build that cannot run.
 */
export const maxDuration = 60;

const encoder = new TextEncoder();

/** A sleep that gives up as soon as the client goes away. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });
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
    // `?? undefined` matters: a null here would read as "not supplied" and send
    // resolveRoomActor to look the booking up a second time on the 404 path.
    const cachedBooking = (await cachedBookingForRoom(supabase, bookingId)) ?? undefined;
    const resolved = await resolveRoomActor(req, bookingId, {
      supabase,
      booking: cachedBooking,
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

    const room = await cachedEnsureRoom(supabase, resolved.booking);
    /**
     * `Last-Event-ID` beats the query string, and that is not a nicety.
     * `EventSource` reconnects to the SAME URL it was constructed with, so
     * without this every reconnect replays every message since the tab first
     * opened — which on a long tour is the entire conversation, once per
     * function lifetime, per guest. Stamping `id:` on each frame lets the
     * browser tell us where it actually got to.
     */
    const initialAfter =
      req.headers.get('last-event-id') ||
      req.nextUrl.searchParams.get('after') ||
      new Date(0).toISOString();

    const stream = new ReadableStream({
      async start(controller) {
        let after = initialAfter;
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            /* already torn down by the client going away */
          }
        };

        // Sent first, so it applies even to a connection that dies immediately.
        controller.enqueue(encoder.encode(`retry: ${SSE_RECONNECT_HINT_MS}\n\n`));
        controller.enqueue(encoder.encode(`event: room\ndata: ${JSON.stringify(room)}\n\n`));

        const startedAt = Date.now();
        let interval = SSE_POLL_MIN_MS;

        while (!req.signal.aborted && Date.now() - startedAt < SSE_STREAM_BUDGET_MS) {
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

          const rows = data ?? [];
          for (const message of rows) {
            after = message.created_at;
            controller.enqueue(
              encoder.encode(
                `id: ${message.created_at}\nevent: message\ndata: ${JSON.stringify(message)}\n\n`,
              ),
            );
          }

          interval = nextPollInterval(interval, rows.length);
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
          await sleep(interval, req.signal);
        }

        close();
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

