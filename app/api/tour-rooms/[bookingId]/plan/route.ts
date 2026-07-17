import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import {
  ACTIVE_DAY_PLAN_STATUSES,
  dayPlanStopsToSchedule,
  resolveDaySchedule,
  type DayPlanStop,
} from '@/lib/tour-room/dayPlan';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { generateSpotContent } from '@/lib/tour-room/generatedContent';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';
import { hasPoiKbEntry } from '@/lib/tour-room/spotContent';

export const dynamic = 'force-dynamic';

/**
 * W1.4 (server slice) — the day-plan read/write API.
 *
 * GET  → the resolver-chain result (any room actor): source + schedule +
 *        the raw day_plans row when one exists.
 * PUT  → guide/driver/admin replace the stops (guest_draft) or confirm
 *        ({ confirm: true } → guide_confirmed): version++, fan-out capsule,
 *        and the P-D16 content pipeline fires for stops outside the poi_kb.
 *
 * The /plan guest UI (W1) will layer lead-guest draft editing on top; this
 * server slice is what makes day plans REAL today — ops/guide can set a
 * private party's schedule and every consumer (Today tab, concierge,
 * driver console) follows the resolver chain.
 */

/** Pre-translated confirm capsule (P-D10 — zero LLM). */
const PLAN_CONFIRMED: Record<string, string> = {
  en: 'Today’s itinerary is confirmed — check the Today tab for the updated schedule.',
  ko: '오늘의 일정이 확정되었어요 — 오늘 탭에서 확인해 주세요.',
  ja: '本日の行程が確定しました。「本日」タブでご確認ください。',
  es: 'El itinerario de hoy está confirmado: revísalo en la pestaña de Hoy.',
  zh: '今日行程已确定——请在“今日”标签查看。',
};

const MAX_STOPS = 20;

function sanitizeStops(raw: unknown): DayPlanStop[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_STOPS) return null;
  const stops: DayPlanStop[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    if (!item || typeof item !== 'object') return null;
    const stop = item as Record<string, unknown>;
    const title = typeof stop.title === 'string' ? stop.title.trim().slice(0, 120) : '';
    const poiKey = typeof stop.poi_key === 'string' && stop.poi_key.trim() ? stop.poi_key.trim() : null;
    const placeId = typeof stop.place_id === 'string' && stop.place_id.trim() ? stop.place_id.trim() : null;
    if (!title && !poiKey) return null;
    const time = typeof stop.arrival_planned === 'string' ? stop.arrival_planned.slice(0, 5) : null;
    stops.push({
      id: typeof stop.id === 'string' ? stop.id : `stop-${index + 1}`,
      seq: index + 1,
      source: placeId ? 'google' : poiKey ? 'poi' : 'free',
      poi_key: poiKey,
      place_id: placeId,
      name_i18n: title ? { en: title } : null,
      stop_type: typeof stop.stop_type === 'string' ? stop.stop_type.slice(0, 20) : 'sight',
      arrival_planned: time && /^\d{2}:\d{2}$/.test(time) ? time : null,
      duration_min: typeof stop.duration_min === 'number' ? Math.max(0, Math.min(600, stop.duration_min)) : null,
      status: 'pending',
      memo_guide: typeof stop.memo_guide === 'string' ? stop.memo_guide.slice(0, 500) : undefined,
    });
  }
  return stops;
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
    const { booking } = resolved;

    const { data: bookingRow } = await supabase
      .from('bookings')
      .select('itinerary, tours ( schedule )')
      .eq('id', booking.id)
      .maybeSingle();
    const tourRaw = (bookingRow as { tours?: unknown } | null)?.tours;
    const tourJoin = (Array.isArray(tourRaw) ? tourRaw[0] : tourRaw) as { schedule?: unknown } | null;
    const result = await resolveDaySchedule(supabase, {
      bookingId: booking.id,
      tourDate: booking.tour_date,
      itinerary: (bookingRow as { itinerary?: unknown } | null)?.itinerary ?? null,
      tourSchedule: tourJoin?.schedule,
    });

    // Drafts are invisible to the resolver — surface them here for editors.
    let draft = null;
    if (booking.tour_date && !result.dayPlan) {
      const { data } = await supabase
        .from('tour_day_plans')
        .select('*')
        .eq('booking_id', booking.id)
        .eq('tour_date', booking.tour_date)
        .maybeSingle();
      draft = data ?? null;
    }

    return NextResponse.json({
      source: result.source,
      schedule: result.schedule,
      day_plan: result.dayPlan ?? draft,
    });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/plan error:', error);
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
    const body = (await req.json().catch(() => ({}))) as { stops?: unknown; confirm?: unknown };

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor } = resolved;
    if (actor.role !== 'guide' && actor.role !== 'driver' && actor.role !== 'admin') {
      return NextResponse.json({ error: 'Guide, driver, or admin only' }, { status: 403 });
    }
    if (!booking.tour_date) {
      return NextResponse.json({ error: 'Booking has no tour_date' }, { status: 400 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_plan_write',
      key: `booking:${booking.id}`,
      perMinute: 6,
      perHour: 60,
    });
    if (!gate.allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    const confirm = body.confirm === true;
    const stops = body.stops !== undefined ? sanitizeStops(body.stops) : undefined;
    if (body.stops !== undefined && stops === null) {
      return NextResponse.json(
        { error: `stops must be 1–${MAX_STOPS} items, each with a title or poi_key` },
        { status: 400 },
      );
    }

    const { data: existing } = await supabase
      .from('tour_day_plans')
      .select('*')
      .eq('booking_id', booking.id)
      .eq('tour_date', booking.tour_date)
      .maybeSingle();

    const nextStops = stops ?? ((existing as { stops?: DayPlanStop[] } | null)?.stops ?? []);
    if (confirm && nextStops.length === 0) {
      return NextResponse.json({ error: 'Cannot confirm an empty plan' }, { status: 400 });
    }
    const nextStatus = confirm
      ? 'guide_confirmed'
      : ((existing as { status?: string } | null)?.status &&
          (ACTIVE_DAY_PLAN_STATUSES as readonly string[]).includes((existing as { status: string }).status)
          ? (existing as { status: string }).status // editing a confirmed plan keeps it live (MUTATE)
          : 'guest_draft');

    const { data: plan, error: planError } = await supabase
      .from('tour_day_plans')
      .upsert(
        {
          booking_id: booking.id,
          tour_date: booking.tour_date,
          stops: nextStops,
          status: nextStatus,
          version: ((existing as { version?: number } | null)?.version ?? 0) + 1,
          updated_by: actor.role,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'booking_id,tour_date' },
      )
      .select()
      .single();
    if (planError) throw planError;

    const room = await ensureRoom(supabase, booking);
    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: booking.id,
      type: confirm ? 'plan_confirmed' : 'plan_mutated',
      actorRole: actor.role,
      payload: { version: (plan as { version: number }).version, stops_count: nextStops.length },
    }).catch(() => undefined);

    if (confirm || nextStatus !== 'guest_draft') {
      // Fan-out capsule so guests know the Today tab changed.
      const translations = { ...PLAN_CONFIRMED };
      const { data: message } = await supabase
        .from('tour_room_messages')
        .insert({
          room_id: room.id,
          booking_id: booking.id,
          sender_role: 'system',
          input_kind: 'text',
          source_text: translations.en,
          source_locale: 'en',
          translations,
          target_locales: Object.keys(translations),
          metadata: { kind: confirm ? 'plan_confirmed' : 'plan_updated', version: (plan as { version: number }).version },
        })
        .select()
        .single();
      if (message) await broadcastToRoom(room, 'message', { message });
    }

    // P-D16 pre-tour trigger: generate mini-guides for stops the poi_kb
    // doesn't cover, in the guest's locale(s). Async fire-and-forget — the
    // plan write never waits on LLM calls.
    if (confirm) {
      const guestLocale = normalizeRoomLocale(booking.preferred_language);
      const targets = nextStops.filter((stop) => !hasPoiKbEntry(stop.poi_key));
      if (targets.length > 0) {
        void (async () => {
          for (const stop of targets.slice(0, 10)) {
            try {
              await generateSpotContent(supabase, {
                bookingId: booking.id,
                title: stop.name_i18n?.en ?? stop.poi_key ?? '',
                poiKey: stop.poi_key,
                placeId: stop.place_id,
                locales: [guestLocale], // generateSpotContent always adds 'en'
              });
            } catch (generationError) {
              console.warn('plan-confirm content generation failed:', generationError);
            }
          }
        })();
      }
    }

    return NextResponse.json(
      { day_plan: plan, schedule: dayPlanStopsToSchedule(nextStops) },
      { status: 200 },
    );
  } catch (error) {
    console.error('PUT /api/tour-rooms/[bookingId]/plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
