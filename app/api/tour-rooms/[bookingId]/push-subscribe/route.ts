import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { resolveRoomActor } from '@/lib/tour-room/access';

export const dynamic = 'force-dynamic';

/**
 * W4.1 / P-D7 — guest Web Push subscribe/unsubscribe for a booking.
 *
 * POST { subscription: { endpoint, keys: { p256dh, auth } } } → upsert a
 * role='customer' row scoped to this booking (delete-then-insert on the
 * endpoint capability URL). POST { unsubscribe: true, endpoint } removes it.
 * Customers only — ops/guide devices subscribe through their own console.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as {
      subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
      unsubscribe?: unknown;
      endpoint?: unknown;
    };

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor, authUserId } = resolved;
    if (actor.role !== 'customer') {
      return NextResponse.json({ error: 'Customers only' }, { status: 403 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_push_subscribe',
      key: `booking:${booking.id}`,
      perMinute: 6,
      perHour: 30,
    });
    if (!gate.allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    if (body.unsubscribe === true) {
      const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
      if (endpoint) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('booking_id', booking.id);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const endpoint = typeof body.subscription?.endpoint === 'string' ? body.subscription.endpoint : '';
    const p256dh = typeof body.subscription?.keys?.p256dh === 'string' ? body.subscription.keys.p256dh : '';
    const auth = typeof body.subscription?.keys?.auth === 'string' ? body.subscription.keys.auth : '';
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'subscription {endpoint, keys.p256dh, keys.auth} required' }, { status: 400 });
    }

    // The endpoint is the device identity — re-subscribing replaces the row.
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    const { error } = await supabase.from('push_subscriptions').insert({
      role: 'customer',
      booking_id: booking.id,
      user_id: authUserId,
      endpoint,
      p256dh,
      auth,
      user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/push-subscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
