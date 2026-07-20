import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor, type RoomDbClient, type TourRoom } from '@/lib/tour-room/access';
import {
  allowedExtraTransition,
  EXTRA_ACTIONS,
  EXTRA_KINDS,
  renderExtraCapsule,
  renderSettlementSummary,
  type ExtraAction,
  type ExtraKind,
  type ExtraStatus,
} from '@/lib/tour-room/ledger';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { inPostTourWindow, roomLifecycle } from '@/lib/tour-room/time';

export const dynamic = 'force-dynamic';

/**
 * W2.4 — the extras LEDGER API (§M `extras`, P-D2: cash-settled record, no
 * payment rail).
 *
 * GET   → the room's ledger rows + unsettled total (any room actor).
 * POST  → guide/driver/admin log an expense { item, amount_krw, kind }
 *         (G1 extension quote / G2 advance / G3 parking): row + feed capsule.
 * PATCH → { extraId, action: 'confirm'|'settle'|'void' } — the §C-3 machine:
 *         confirm = customer ack (logged→confirmed), settle = guide received
 *         cash (→settled, settled_via 'cash'), void = guide cancel. Each
 *         transition drops a status capsule so the feed stays the audit
 *         trail; the card renders from the newest capsule per extra.
 */

interface ExtraRow {
  id: string;
  room_id: string;
  booking_id: string;
  item: string;
  amount_krw: number;
  payer: string;
  kind: string;
  status: string;
  settled_via: string | null;
  created_at: string;
  updated_at: string;
}

async function insertExtraCapsule(
  supabase: RoomDbClient,
  room: TourRoom,
  bookingId: string,
  extra: ExtraRow,
  status: ExtraStatus,
) {
  const bundle = renderExtraCapsule(status, extra.item, extra.amount_krw, extra.payer === 'driver' ? 'driver' : 'guide');
  const { data: message } = await supabase
    .from('tour_room_messages')
    .insert({
      room_id: room.id,
      booking_id: bookingId,
      sender_role: 'system',
      input_kind: 'text',
      source_text: bundle.source_text,
      source_locale: bundle.source_locale,
      translations: bundle.translations,
      target_locales: Object.keys(bundle.translations),
      metadata: {
        kind: 'extra_ledger',
        extra_id: extra.id,
        item: extra.item,
        amount_krw: extra.amount_krw,
        extra_kind: extra.kind,
        payer: extra.payer,
        status,
      },
    })
    .select()
    .single();
  if (message) await broadcastToRoom(room, 'message', { message });
  return message ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const room = await ensureRoom(supabase, resolved.booking);
    const { data: extras } = await supabase
      .from('tour_room_extras')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true });
    const rows = (extras ?? []) as ExtraRow[];
    const unsettled = rows
      .filter((row) => row.status === 'logged' || row.status === 'confirmed')
      .reduce((sum, row) => sum + row.amount_krw, 0);
    return NextResponse.json({ extras: rows, unsettled_krw: unsettled });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/extras error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as {
      item?: unknown;
      amount_krw?: unknown;
      kind?: unknown;
    };

    const summary = (body as { summary?: unknown }).summary === true;
    const item = typeof body.item === 'string' ? body.item.trim().slice(0, 120) : '';
    const amountRaw = typeof body.amount_krw === 'string' ? Number(body.amount_krw) : body.amount_krw;
    const amount =
      typeof amountRaw === 'number' && Number.isFinite(amountRaw)
        ? Math.round(amountRaw)
        : NaN;
    const kind = (EXTRA_KINDS as readonly string[]).includes(body.kind as string)
      ? (body.kind as ExtraKind)
      : 'other';
    if (!summary && (!item || !Number.isFinite(amount) || amount <= 0 || amount > 10_000_000)) {
      return NextResponse.json(
        { error: 'item and amount_krw (1..10,000,000) are required' },
        { status: 400 },
      );
    }

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor } = resolved;
    if (actor.role !== 'guide' && actor.role !== 'driver' && actor.role !== 'admin') {
      return NextResponse.json({ error: 'Guide, driver, or admin only' }, { status: 403 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_extras',
      key: `booking:${booking.id}`,
      perMinute: 6,
      perHour: 60,
    });
    if (!gate.allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    const room = await ensureRoom(supabase, booking);

    // G4 — the end-of-day settlement summary capsule (+ G7 ATM hint).
    if (summary) {
      const { data: rows } = await supabase
        .from('tour_room_extras')
        .select('id, item, amount_krw, status')
        .eq('room_id', room.id)
        .order('created_at', { ascending: true });
      const active = ((rows ?? []) as Array<{ item: string; amount_krw: number; status: string }>).filter(
        (row) => row.status !== 'voided',
      );
      if (active.length === 0) {
        return NextResponse.json({ error: 'No expenses to summarize' }, { status: 400 });
      }
      const total = active.reduce((sum, row) => sum + row.amount_krw, 0);
      const bundle = renderSettlementSummary(active, total);
      const { data: message } = await supabase
        .from('tour_room_messages')
        .insert({
          room_id: room.id,
          booking_id: booking.id,
          sender_role: 'system',
          input_kind: 'text',
          source_text: bundle.source_text,
          source_locale: bundle.source_locale,
          translations: bundle.translations,
          target_locales: Object.keys(bundle.translations),
          metadata: { kind: 'settlement_summary', total_krw: total, count: active.length },
        })
        .select()
        .single();
      if (message) await broadcastToRoom(room, 'message', { message });
      await recordRoomEvent(supabase, {
        roomId: room.id,
        bookingId: booking.id,
        type: 'settlement_summary',
        actorRole: actor.role,
        payload: { total_krw: total, count: active.length },
      }).catch(() => undefined);
      return NextResponse.json({ message, total_krw: total }, { status: 201 });
    }

    const { data: extra, error: extraError } = await supabase
      .from('tour_room_extras')
      .insert({
        room_id: room.id,
        booking_id: booking.id,
        item,
        amount_krw: amount,
        payer: actor.role === 'driver' ? 'driver' : 'guide',
        kind,
      })
      .select()
      .single();
    if (extraError) throw extraError;

    const message = await insertExtraCapsule(supabase, room, booking.id, extra as ExtraRow, 'logged');
    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: booking.id,
      type: 'extra_logged',
      actorRole: actor.role,
      payload: { extra_id: (extra as ExtraRow).id, item, amount_krw: amount, kind },
    }).catch(() => undefined);

    return NextResponse.json({ extra, message }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/extras error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as { extraId?: unknown; action?: unknown };
    const extraId = typeof body.extraId === 'string' && body.extraId.trim() ? body.extraId.trim() : null;
    const action = (EXTRA_ACTIONS as readonly string[]).includes(body.action as string)
      ? (body.action as ExtraAction)
      : null;
    if (!extraId || !action) {
      return NextResponse.json(
        { error: `extraId and action (${EXTRA_ACTIONS.join('|')}) are required` },
        { status: 400 },
      );
    }

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor } = resolved;

    // P-D12 — settlement transitions stay possible through the post_tour
    // window (tour-day end +48h), then the ledger freezes.
    if (roomLifecycle(booking.tour_date) === 'ended' && !inPostTourWindow(booking.tour_date)) {
      return NextResponse.json({ error: 'post_tour_window_closed' }, { status: 403 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_extras',
      key: `booking:${booking.id}`,
      perMinute: 6,
      perHour: 60,
    });
    if (!gate.allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    const room = await ensureRoom(supabase, booking);
    const { data: existing } = await supabase
      .from('tour_room_extras')
      .select('*')
      .eq('id', extraId)
      .eq('room_id', room.id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: 'Extra not found' }, { status: 404 });
    }

    const nextStatus = allowedExtraTransition(
      action,
      actor.role,
      (existing as ExtraRow).status,
      (existing as ExtraRow).payer,
    );
    if (!nextStatus) {
      return NextResponse.json(
        { error: `Cannot ${action} from ${(existing as ExtraRow).status} as ${actor.role}` },
        { status: 403 },
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('tour_room_extras')
      .update({
        status: nextStatus,
        ...(nextStatus === 'settled' ? { settled_via: 'cash' } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', extraId)
      .select()
      .single();
    if (updateError) throw updateError;

    const message = await insertExtraCapsule(supabase, room, booking.id, updated as ExtraRow, nextStatus);
    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: booking.id,
      type: `extra_${nextStatus}`,
      actorRole: actor.role,
      subjectKey: `extra:${extraId}:${nextStatus}`,
      payload: { extra_id: extraId, amount_krw: (updated as ExtraRow).amount_krw },
    }).catch(() => undefined);

    return NextResponse.json({ extra: updated, message }, { status: 200 });
  } catch (error) {
    console.error('PATCH /api/tour-rooms/[bookingId]/extras error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
