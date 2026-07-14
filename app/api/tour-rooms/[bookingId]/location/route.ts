import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { broadcastToRoom } from '@/lib/tour-room/realtime';

export const dynamic = 'force-dynamic';

/**
 * T3.1 — participant location sharing (§B D-4, §O-5).
 *
 * High-frequency pings ride the Broadcast channel only; the DB keeps a single
 * last-known row per participant (tour_room_locations, UNIQUE participant_id)
 * refreshed at most every SNAPSHOT_INTERVAL — late joiners get positions from
 * the join snapshot, everyone else from the live channel.
 *
 * Anti-forgery: the participant identity comes exclusively from the signed
 * room session (issued by /join) — a body-supplied participant_id is ignored,
 * so a forged id can never move someone else's marker (AC: 403).
 *
 * POST   {latitude, longitude, accuracyM?, heading?, speedMps?} → rebroadcast
 * DELETE → stop sharing (row removed + removal broadcast + flag cleared)
 */

/** §O-5: pings every 15s (4/min) against a 6/min limit (retry headroom). */
const PING_LIMIT_PER_MINUTE = 6;
/** §O-5: the DB snapshot refreshes at most this often. */
const SNAPSHOT_INTERVAL_MS = 30_000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function POST(
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
    const { booking, actor } = resolved;
    if (actor.kind !== 'session') {
      // Only a joined device (room session from /join) may publish a position.
      return NextResponse.json({ error: 'A joined room session is required to share location' }, { status: 403 });
    }
    const participantId = actor.sessionPayload.participantId;

    const body = await req.json().catch(() => ({}));
    const latitude = body.latitude;
    const longitude = body.longitude;
    if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return NextResponse.json({ error: 'latitude/longitude are required' }, { status: 400 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_location',
      key: `participant:${participantId}`,
      perMinute: PING_LIMIT_PER_MINUTE,
      perHour: PING_LIMIT_PER_MINUTE * 60,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    const room = await ensureRoom(supabase, booking);
    const nowIso = new Date().toISOString();
    const location = {
      participant_id: participantId,
      room_id: room.id,
      booking_id: booking.id,
      role: actor.role,
      display_name: actor.displayName,
      latitude,
      longitude,
      accuracy_m: isFiniteNumber(body.accuracyM) ? Math.round(body.accuracyM) : null,
      heading: isFiniteNumber(body.heading) ? body.heading : null,
      speed_mps: isFiniteNumber(body.speedMps) ? body.speedMps : null,
      recorded_at: nowIso,
    };

    // Live path first — the channel is what the room watches.
    await broadcastToRoom(room, 'location', { location });

    // Snapshot path — at most one DB write per SNAPSHOT_INTERVAL (§O-5).
    const { data: existing } = await supabase
      .from('tour_room_locations')
      .select('updated_at')
      .eq('participant_id', participantId)
      .maybeSingle();
    const stale =
      !existing?.updated_at || Date.now() - new Date(existing.updated_at as string).getTime() >= SNAPSHOT_INTERVAL_MS;
    if (stale) {
      await supabase
        .from('tour_room_locations')
        .upsert(
          {
            room_id: room.id,
            booking_id: booking.id,
            participant_id: participantId,
            role: actor.role,
            latitude,
            longitude,
            accuracy_m: location.accuracy_m,
            heading: location.heading,
            speed_mps: location.speed_mps,
            recorded_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: 'participant_id' },
        );
      // Keep the participant's sharing flag truthful for late joiners.
      await supabase
        .from('tour_room_participants')
        .update({ location_sharing: true, updated_at: nowIso })
        .eq('id', participantId);
    }

    return NextResponse.json({ ok: true, snapshotWritten: stale });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/location error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
    const { booking, actor } = resolved;
    if (actor.kind !== 'session') {
      return NextResponse.json({ error: 'A joined room session is required' }, { status: 403 });
    }
    const participantId = actor.sessionPayload.participantId;

    const room = await ensureRoom(supabase, booking);
    await supabase.from('tour_room_locations').delete().eq('participant_id', participantId);
    await supabase
      .from('tour_room_participants')
      .update({ location_sharing: false, updated_at: new Date().toISOString() })
      .eq('id', participantId);
    await broadcastToRoom(room, 'location', { location: { participant_id: participantId, removed: true } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/tour-rooms/[bookingId]/location error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
