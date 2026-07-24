import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { resolveRoomActor } from '@/lib/tour-room/access';
import { reportPlaceWrong } from '@/lib/ops/dining/cache.server';

export const dynamic = 'force-dynamic';

/**
 * §5.7 R-6 — dining card feedback.
 *
 * POST /api/tour-rooms/[bookingId]/dining/feedback
 *   { placeKey, cell, action: 'tap' | 'visited' | 'wrong' | 'closed' }
 *
 * `tap` / `visited` write the timestamps the ranking's feedbackBonus reads.
 * `wrong` / `closed` additionally bump `ops_kakao_place_cache.reported_wrong_count`;
 * three reports auto-hide the place and put it in the admin queue (K6 — the
 * replacement for a per-row human review gate that would have made the whole
 * pipeline pointless at 30-POI scale).
 *
 * Never throws and never blocks the UI: the card optimistically hides a
 * reported row, so a failed write costs one lost signal, not a broken card.
 */

const ACTIONS = ['tap', 'visited', 'wrong', 'closed'] as const;
type FeedbackAction = (typeof ACTIONS)[number];

/** Rank we record when a guest acts on a card whose exposure row is missing. */
const UNKNOWN_RANK = 0;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as {
      placeKey?: unknown;
      place_key?: unknown;
      cell?: unknown;
      action?: unknown;
      token?: unknown;
    };

    const rawKey = typeof body.placeKey === 'string' ? body.placeKey : body.place_key;
    const placeKey = typeof rawKey === 'string' && rawKey.trim() ? rawKey.trim().slice(0, 120) : null;
    const cell = typeof body.cell === 'string' && body.cell.trim() ? body.cell.trim().slice(0, 24) : null;
    const action = ACTIONS.includes(body.action as FeedbackAction) ? (body.action as FeedbackAction) : null;
    if (!placeKey || !cell || !action) {
      return NextResponse.json({ error: 'placeKey, cell and a valid action are required' }, { status: 400 });
    }

    const resolved = await resolveRoomActor(req, bookingId, {
      supabase,
      token: typeof body.token === 'string' ? body.token : null,
    });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor } = resolved;
    const actorParticipantId = actor.kind === 'session' ? actor.sessionPayload.participantId : null;

    const gateKey = actorParticipantId ? `participant:${actorParticipantId}` : clientIpKey(req.headers);
    const gate = await requestGate({
      namespace: 'tour_room_dining_feedback',
      key: gateKey,
      perMinute: 10,
      perHour: 60,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = {};
    if (action === 'tap') patch.tapped_at = nowIso;
    if (action === 'visited') {
      patch.visited_at = nowIso;
      // Going there is also a tap — the guest opened the card to decide.
      patch.tapped_at = nowIso;
    }
    if (action === 'wrong' || action === 'closed') patch.feedback = action;

    // Update the exposure row when it exists; insert one when the guest is
    // acting on a card whose row never landed (an inline answer that failed to
    // log, or a fanned-out card recorded against another booking).
    let logged = false;
    try {
      const { data: updated } = await supabase
        .from('ops_restaurant_recommendations')
        .update(patch)
        .eq('booking_id', booking.id)
        .eq('place_key', placeKey)
        .eq('cell', cell)
        .select('id');
      logged = Array.isArray(updated) && updated.length > 0;
      if (!logged) {
        const { error: insertError } = await supabase.from('ops_restaurant_recommendations').insert({
          booking_id: booking.id,
          participant_id: actorParticipantId,
          cell,
          place_key: placeKey,
          rank: UNKNOWN_RANK,
          shown_at: nowIso,
          ...patch,
        });
        logged = !insertError;
      }
    } catch (ledgerError) {
      console.warn('[ops-dining] feedback ledger write failed:', ledgerError);
    }

    let hidden: boolean | undefined;
    if (action === 'wrong' || action === 'closed') {
      const report = await reportPlaceWrong(supabase, placeKey, action);
      hidden = report?.hidden ?? false;
    }

    return NextResponse.json({ ok: true, logged, ...(hidden === undefined ? {} : { hidden }) }, { status: 200 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/dining/feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
