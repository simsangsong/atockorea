import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { isPrivateTour } from '@/lib/tour-room/tourKind';
import { overtimeAmount, rateForCity } from '@/lib/tour-room/overtime';
import { formatKrw } from '@/lib/tour-room/ledger';
import { insertExtraCapsule, type ExtraRow } from '@/lib/tour-room/extraCapsule';
import { sendDriverRoomPush } from '@/lib/tour-room/guestPush';
import { recordRoomEvent } from '@/lib/tour-room/events';

export const dynamic = 'force-dynamic';

/**
 * §11.D D5 — guest self-service ADD-TIME → cash overtime charge (LEDGER).
 *
 * A PRIVATE-tour guest taps [시간추가] next to their departure countdown, picks
 * whole extra hours, and self-confirms. This route records the cash charge in
 * the extras ledger (kind='overtime', payer='driver' — the guest pays the
 * driver cash on the day) and pushes the driver + guide.
 *
 * MONEY SAFETY (non-negotiable):
 *   - The client NEVER sends the amount. The server recomputes it from the
 *     tour's city (read server-side from bookings → tours.city) × the requested
 *     whole hours: `overtimeAmount(hours, rateForCity(city))`. Any client-sent
 *     amount is ignored — the body carries `{ hours }` only.
 *   - Added time is a deliberate extension: each whole hour bills a full
 *     rateForCity(city) with NO grace (the 20-min grace lives only in the
 *     base-tour computeOvertime and is not reused here).
 *   - Private-tour only (tours.price_type === 'vehicle'); join tours have no
 *     overtime charge and are rejected 400 `private_only`.
 *   - A driver may NOT add the guest's time (403). Customers add their own;
 *     guide/admin may do it on the guest's behalf (mirrors the signals gate).
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    // Body carries { hours } ONLY. No client amount is ever read/trusted.
    const body = (await req.json().catch(() => ({}))) as { hours?: unknown };
    const rawHours =
      typeof body.hours === 'string' ? Number(body.hours) : body.hours;
    const hours = typeof rawHours === 'number' ? rawHours : NaN;
    if (!Number.isInteger(hours) || hours < 1 || hours > 8) {
      return NextResponse.json(
        { error: 'hours must be a whole number 1..8' },
        { status: 400 },
      );
    }

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor } = resolved;
    // A guest adds their own time; guide/admin may on their behalf; driver may NOT.
    if (actor.role === 'driver') {
      return NextResponse.json({ error: 'Drivers cannot add guest time' }, { status: 403 });
    }

    // Server recomputes city + private-ness from the DB (never the request body).
    const { data: tour } = await supabase
      .from('tours')
      .select('city, price_type')
      .eq('id', booking.tour_id)
      .single();
    const city = (tour as { city?: string | null } | null)?.city ?? null;
    const priceType = (tour as { price_type?: string | null } | null)?.price_type ?? null;
    if (!isPrivateTour(priceType)) {
      return NextResponse.json({ error: 'private_only' }, { status: 400 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_extend',
      key: `booking:${booking.id}`,
      perMinute: 6,
      perHour: 40,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    // SERVER-AUTHORITATIVE amount: city rate × whole hours, no grace.
    const amount = overtimeAmount(hours, rateForCity(city));

    const room = await ensureRoom(supabase, booking);
    const item = `시간추가 ${hours}시간`;
    const { data: extra, error: extraError } = await supabase
      .from('tour_room_extras')
      .insert({
        room_id: room.id,
        booking_id: booking.id,
        item,
        amount_krw: amount,
        payer: 'driver',
        kind: 'overtime',
        status: 'logged',
      })
      .select()
      .single();
    if (extraError) throw extraError;

    // Drop the 5-locale logged capsule into the guest feed (renders as the
    // ExtraLedgerCard via the broadcast).
    const message = await insertExtraCapsule(supabase, room, booking.id, extra as ExtraRow, 'logged');

    // Best-effort — the ledger insert must not fail if push throws.
    void sendDriverRoomPush(supabase, booking.id, {
      body: `손님이 ${hours}시간 추가 요청 — 종료 시 현금 ${formatKrw(amount)}`,
      tag: `extend-${room.id}`,
    }).catch(() => undefined);

    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: booking.id,
      type: 'extra_logged',
      actorRole: actor.role,
      payload: { extra_id: (extra as ExtraRow).id, item, amount_krw: amount, kind: 'overtime', hours },
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, hours, amount_krw: amount, message }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/extend error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
