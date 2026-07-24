import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { DIETARY_TAGS, isDietaryTag, type DietaryTag } from '@/lib/ops/dining/dietary';

export const dynamic = 'force-dynamic';

/**
 * §5.7 R-1 intake ① — the dietary write behind briefing card ④.
 *
 *   GET  /api/tour-rooms/[bookingId]/dietary  → { dietary, allergyNote }
 *   PUT  /api/tour-rooms/[bookingId]/dietary  { dietary: string[], allergyNote?: string }
 *
 * The whole point of this route is that it writes to the SAME place the /plan
 * A10 checklist writes — `tour_day_plans.needs.dietary` — because that is the
 * first thing `resolveDietary()` reads when it builds a dining card. A guest
 * who taps 비건 here has changed the restaurant filters for the rest of the day
 * with no further action, on any tour type, without ever opening /plan (which
 * join-tour guests cannot).
 *
 * Contract details that matter:
 *   - the write is a REPLACE of needs.dietary (unticking must be able to remove
 *     a restriction), and it touches no other key of `needs`;
 *   - the tag whitelist is `DIETARY_TAGS` from lib/ops/dining/dietary.ts —
 *     the same 8 the /plan checklist and the card chips use. `kids` is derived
 *     from needs.children and is rejected here on purpose;
 *   - a booking with no `tour_day_plans` row gets a guest_draft one created
 *     (stops []), so join-tour guests are not blocked by never having planned;
 *   - the day plan's own stops/status are never modified.
 */

const MAX_TAGS = 8;
const ALLERGY_NOTE_MAX = 300;

function sanitizeTags(raw: unknown): DietaryTag[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > 32) return null;
  const found = new Set<DietaryTag>();
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const tag = entry.trim();
    if (isDietaryTag(tag)) found.add(tag);
  }
  // Stable, de-duplicated, in the vocabulary's own order.
  return DIETARY_TAGS.filter((tag) => found.has(tag)).slice(0, MAX_TAGS);
}

interface DayPlanNeedsRow {
  id: string;
  needs: Record<string, unknown> | null;
}

async function latestPlanRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  bookingId: string,
  tourDate: string | null,
): Promise<DayPlanNeedsRow | null> {
  let query = supabase.from('tour_day_plans').select('id, needs, updated_at').eq('booking_id', bookingId);
  if (tourDate) query = query.eq('tour_date', tourDate);
  const { data } = await query.order('updated_at', { ascending: false }).limit(1);
  const row = Array.isArray(data) ? (data[0] as DayPlanNeedsRow | undefined) : undefined;
  return row ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { booking } = resolved;

    const row = await latestPlanRow(supabase, booking.id, booking.tour_date);
    const needs = (row?.needs ?? null) as Record<string, unknown> | null;
    return NextResponse.json({
      dietary: sanitizeTags(needs?.dietary) ?? [],
      allergyNote: typeof needs?.allergy_note === 'string' ? needs.allergy_note : null,
    });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/dietary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as { dietary?: unknown; allergyNote?: unknown };

    const dietary = sanitizeTags(body.dietary);
    if (dietary === null) {
      return NextResponse.json({ error: 'dietary must be an array of tags' }, { status: 400 });
    }

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { booking, actor } = resolved;
    if (actor.role === 'driver') {
      return NextResponse.json({ error: 'Drivers cannot edit dietary needs' }, { status: 403 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_dietary',
      key: `booking:${booking.id}`,
      perMinute: 20,
      perHour: 120,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    const tourDate = booking.tour_date;
    if (!tourDate) {
      return NextResponse.json({ error: 'Booking has no tour date' }, { status: 400 });
    }

    const room = await ensureRoom(supabase, booking);
    const existing = await latestPlanRow(supabase, booking.id, tourDate);

    const allergyNote =
      typeof body.allergyNote === 'string' && body.allergyNote.trim()
        ? body.allergyNote.trim().slice(0, ALLERGY_NOTE_MAX)
        : undefined;

    // Merge: only the dietary keys move; everything else the plan editor wrote
    // (adults, children, stroller, pace, note…) survives untouched.
    const needs: Record<string, unknown> = { ...(existing?.needs ?? {}) };
    needs.dietary = dietary;
    if (allergyNote !== undefined) needs.allergy_note = allergyNote;

    if (existing) {
      const { error } = await supabase
        .from('tour_day_plans')
        .update({ needs, updated_at: new Date().toISOString(), updated_by: actor.role })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('tour_day_plans').insert({
        booking_id: booking.id,
        room_id: room.id,
        tour_date: tourDate,
        status: 'guest_draft',
        stops: [],
        needs,
        updated_by: actor.role,
      });
      if (error) throw error;
    }

    // Audit only (no capsule): the guest already sees their own chips light up,
    // and a "someone ticked vegan" line in the feed would be noise + a privacy
    // leak in a shared join-tour room.
    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: booking.id,
      type: 'dietary_intake',
      actorRole: actor.role === 'admin' ? 'admin' : actor.role,
      payload: { dietary, source: 'briefing_lunch' },
    }).catch(() => undefined);

    return NextResponse.json({ dietary, allergyNote: needs.allergy_note ?? null });
  } catch (error) {
    console.error('PUT /api/tour-rooms/[bookingId]/dietary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
