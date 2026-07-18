import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor, type RoomActor, type RoomDbClient } from '@/lib/tour-room/access';
import {
  ACTIVE_DAY_PLAN_STATUSES,
  dayPlanStopsToSchedule,
  resolveDaySchedule,
  type DayPlanStop,
} from '@/lib/tour-room/dayPlan';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { assessDayPlanFeasibility, type FeasibilityResult } from '@/lib/tour-room/feasibility';
import { generateSpotContent } from '@/lib/tour-room/generatedContent';
import { isRegionSlug } from '@/lib/itinerary-builder/regions';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';
import { hasPoiKbEntry } from '@/lib/tour-room/spotContent';

export const dynamic = 'force-dynamic';

/**
 * W1.4 — the day-plan read/write API.
 *
 * GET  → the resolver-chain result (any room actor): source + schedule + the
 *        raw day_plans row when one exists, plus viewer/tour meta for the
 *        /plan editor (can_edit, region, booked hours).
 * PUT  → two write planes:
 *        - guide/driver/admin: replace stops, confirm ({confirm:true} →
 *          guide_confirmed, fires the P-D16 content pipeline);
 *        - the LEAD GUEST (P-D13 — first customer join / booking owner):
 *          draft-only editing while status is guest_draft, plus
 *          {submit:true} (fan-out to the guide) and {delegate:true}
 *          (tab ③ — "leave it to the guide", sets itinerary.guide_curated).
 *        Every stops write recomputes W1.3 feasibility (warnings only, P-D9)
 *        and persists it on the row.
 */

/** Pre-translated capsules (P-D10 — zero LLM, room 5-locale convention). */
const PLAN_CONFIRMED: Record<string, string> = {
  en: 'Today’s itinerary is confirmed — check the Today tab for the updated schedule.',
  ko: '오늘의 일정이 확정되었어요 — 오늘 탭에서 확인해 주세요.',
  ja: '本日の行程が確定しました。「本日」タブでご確認ください。',
  es: 'El itinerario de hoy está confirmado: revísalo en la pestaña de Hoy.',
  zh: '今日行程已确定——请在“今日”标签查看。',
};

const PLAN_SUBMITTED: Record<string, string> = {
  en: 'Your wish-list itinerary was sent to the guide — they’ll review and confirm it.',
  ko: '희망 일정이 가이드에게 전달되었어요 — 확인 후 확정해 드릴게요.',
  ja: 'ご希望の行程をガイドに送信しました。確認のうえ確定します。',
  es: 'Tu itinerario deseado fue enviado al guía; lo revisará y confirmará.',
  zh: '您的心愿行程已发送给导游——确认后将为您敲定。',
};

const PLAN_DELEGATED: Record<string, string> = {
  en: 'You’ve left today’s course to the guide — they’ll prepare the best route for you.',
  ko: '오늘의 코스를 가이드에게 맡겼어요 — 최적의 동선으로 준비해 드릴게요.',
  ja: '本日のコースはガイドにお任せいただきました。最適なルートをご用意します。',
  es: 'Dejaste el recorrido de hoy en manos del guía; preparará la mejor ruta.',
  zh: '今天的路线已交给导游安排——将为您准备最优行程。',
};

const MAX_STOPS = 20;
const REVIEW_DAY_PLAN_STATUSES = ['guest_submitted', ...ACTIVE_DAY_PLAN_STATUSES] as const;

/** §C-3 stop state machine values a client may write (skipped feeds MUTATE). */
const STOP_STATUSES = ['pending', 'en_route', 'arrived', 'free_time', 'regrouped', 'done', 'skipped'] as const;
const SKIP_REASONS = ['closed', 'weather', 'crowd', 'guest_request', 'time'] as const;

function clampCoord(value: unknown, limit: number): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit && n !== 0 ? n : null;
}

function sanitizeStops(raw: unknown): DayPlanStop[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_STOPS) return null;
  if (raw.length === 0) return [];
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
    const lat = clampCoord(stop.lat, 90);
    const lng = clampCoord(stop.lng, 180);
    stops.push({
      id: typeof stop.id === 'string' ? stop.id.slice(0, 64) : `stop-${index + 1}`,
      seq: index + 1,
      source: placeId ? 'google' : poiKey ? 'poi' : 'free',
      poi_key: poiKey,
      place_id: placeId,
      name_i18n: title ? { en: title } : null,
      stop_type: typeof stop.stop_type === 'string' ? stop.stop_type.slice(0, 20) : 'sight',
      arrival_planned: time && /^\d{2}:\d{2}$/.test(time) ? time : null,
      duration_min: typeof stop.duration_min === 'number' ? Math.max(0, Math.min(600, stop.duration_min)) : null,
      status: (STOP_STATUSES as readonly string[]).includes(stop.status as string)
        ? (stop.status as string)
        : 'pending',
      ...(stop.status === 'skipped' && (SKIP_REASONS as readonly string[]).includes(stop.skip_reason as string)
        ? { skip_reason: stop.skip_reason as string }
        : {}),
      ...(lat !== null && lng !== null ? { lat, lng } : {}),
      memo_guide: typeof stop.memo_guide === 'string' ? stop.memo_guide.slice(0, 500) : undefined,
      memo_guest: typeof stop.memo_guest === 'string' ? stop.memo_guest.slice(0, 500) : undefined,
    });
  }
  return stops;
}

/** A10 needs checklist (P-D11) — strict whitelist, sizes capped. */
function sanitizeNeeds(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const count = (v: unknown, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : undefined;
  const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
  const text = (v: unknown, len: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, len) : undefined;
  const put = (key: string, value: unknown) => {
    if (value !== undefined) out[key] = value;
  };
  put('adults', count(src.adults, 40));
  put('children', count(src.children, 40));
  put(
    'child_ages',
    Array.isArray(src.child_ages)
      ? src.child_ages
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 17)
          .slice(0, 10)
      : undefined,
  );
  put('stroller', bool(src.stroller));
  put('wheelchair', bool(src.wheelchair));
  put('luggage', bool(src.luggage));
  put(
    'dietary',
    Array.isArray(src.dietary)
      ? src.dietary.filter((s): s is string => typeof s === 'string' && Boolean(s.trim())).map((s) => s.trim().slice(0, 30)).slice(0, 8)
      : undefined,
  );
  put('allergy_note', text(src.allergy_note, 300));
  put('pace', ['relaxed', 'standard', 'packed'].includes(src.pace as string) ? src.pace : undefined);
  put('note', text(src.note, 500));
  return Object.keys(out).length > 0 ? out : undefined;
}

/** "9 hours" / "10–10.5 hours" → 9 / 10 (first number wins). */
function parseTourHours(duration: unknown): number | null {
  if (typeof duration !== 'string') return null;
  const match = duration.match(/\d+(?:\.\d+)?/);
  const hours = match ? Number.parseFloat(match[0]) : NaN;
  return Number.isFinite(hours) && hours > 0 && hours <= 24 ? hours : null;
}

function regionForCity(city: unknown): string | null {
  const slug = typeof city === 'string' ? city.trim().toLowerCase() : '';
  return isRegionSlug(slug) ? slug : null;
}

interface TourMeta {
  region: string | null;
  totalHours: number | null;
}

async function fetchTourMeta(supabase: RoomDbClient, tourId: string | null): Promise<TourMeta> {
  if (!tourId) return { region: null, totalHours: null };
  try {
    const { data } = await supabase.from('tours').select('city, duration').eq('id', tourId).maybeSingle();
    return {
      region: regionForCity((data as { city?: unknown } | null)?.city),
      totalHours: parseTourHours((data as { duration?: unknown } | null)?.duration),
    };
  } catch {
    return { region: null, totalHours: null };
  }
}

/** Fill missing lat/lng on poi-sourced stops from match_pois (feasibility + nav). */
async function enrichStopCoords(supabase: RoomDbClient, stops: DayPlanStop[]): Promise<DayPlanStop[]> {
  const missing = stops.filter((s) => s.poi_key && (typeof s.lat !== 'number' || typeof s.lng !== 'number'));
  if (missing.length === 0) return stops;
  try {
    const keys = [...new Set(missing.map((s) => s.poi_key as string))];
    const { data } = await supabase.from('match_pois').select('poi_key, lat, lng, name_en').in('poi_key', keys);
    const byKey = new Map<string, { lat: number | null; lng: number | null; name_en: string | null }>();
    for (const row of (data ?? []) as Array<{ poi_key: string; lat: number | null; lng: number | null; name_en: string | null }>) {
      byKey.set(row.poi_key, row);
    }
    return stops.map((stop) => {
      if (!stop.poi_key) return stop;
      const poi = byKey.get(stop.poi_key);
      if (!poi) return stop;
      const lat = clampCoord(stop.lat, 90) ?? clampCoord(poi.lat, 90);
      const lng = clampCoord(stop.lng, 180) ?? clampCoord(poi.lng, 180);
      const names = stop.name_i18n && Object.keys(stop.name_i18n).length > 0
        ? stop.name_i18n
        : poi.name_en
          ? { en: poi.name_en }
          : stop.name_i18n;
      return { ...stop, ...(lat !== null && lng !== null ? { lat, lng } : {}), name_i18n: names };
    });
  } catch {
    return stops;
  }
}

/** Is this customer the lead guest (P-D13)? Owner sessions count as lead. */
async function isLeadGuest(supabase: RoomDbClient, actor: RoomActor): Promise<boolean> {
  if (actor.kind === 'owner') return true;
  if (actor.kind !== 'session' || actor.role !== 'customer') return false;
  try {
    const { data } = await supabase
      .from('tour_room_participants')
      .select('is_lead')
      .eq('id', actor.sessionPayload.participantId)
      .maybeSingle();
    return Boolean((data as { is_lead?: boolean } | null)?.is_lead);
  } catch {
    return false;
  }
}

async function setGuideCuratedFlag(supabase: RoomDbClient, bookingId: string, guideCurated: boolean): Promise<void> {
  try {
    const { data: bookingRow } = await supabase
      .from('bookings')
      .select('itinerary')
      .eq('id', bookingId)
      .maybeSingle();
    const rawItinerary = (bookingRow as { itinerary?: unknown } | null)?.itinerary;
    if ((!rawItinerary || typeof rawItinerary !== 'object' || Array.isArray(rawItinerary)) && !guideCurated) return;
    const itinerary =
      rawItinerary && typeof rawItinerary === 'object' && !Array.isArray(rawItinerary)
        ? (rawItinerary as Record<string, unknown>)
        : {};
    if (itinerary.guide_curated === guideCurated) return;
    await supabase
      .from('bookings')
      .update({ itinerary: { ...itinerary, guide_curated: guideCurated } })
      .eq('id', bookingId);
  } catch (flagError) {
    console.warn('plan guide_curated flag write failed:', flagError);
  }
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
    const { booking, actor } = resolved;

    const { data: bookingRow } = await supabase
      .from('bookings')
      .select('itinerary, tours ( schedule, city, duration )')
      .eq('id', booking.id)
      .maybeSingle();
    const tourRaw = (bookingRow as { tours?: unknown } | null)?.tours;
    const tourJoin = (Array.isArray(tourRaw) ? tourRaw[0] : tourRaw) as
      | { schedule?: unknown; city?: unknown; duration?: unknown }
      | null;
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

    const plan = result.dayPlan ?? draft;
    const isStaff = actor.role === 'guide' || actor.role === 'driver' || actor.role === 'admin';
    const lead = isStaff ? false : await isLeadGuest(supabase, actor);
    const planStatus = (plan as { status?: string } | null)?.status ?? null;
    const draftEditable = planStatus === null || planStatus === 'guest_draft';

    return NextResponse.json({
      source: result.source,
      schedule: result.schedule,
      day_plan: plan,
      viewer: {
        role: actor.role,
        is_lead: lead,
        can_edit: isStaff || (lead && draftEditable),
      },
      tour: {
        date: booking.tour_date,
        region: regionForCity(tourJoin?.city),
        total_hours: parseTourHours(tourJoin?.duration),
        guide_curated: Boolean(
          ((bookingRow as { itinerary?: Record<string, unknown> } | null)?.itinerary as
            | Record<string, unknown>
            | null
            | undefined)?.guide_curated,
        ),
      },
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
    const body = (await req.json().catch(() => ({}))) as {
      stops?: unknown;
      needs?: unknown;
      confirm?: unknown;
      submit?: unknown;
      delegate?: unknown;
      stops_changed?: unknown;
    };

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor } = resolved;
    const isStaff = actor.role === 'guide' || actor.role === 'driver' || actor.role === 'admin';
    const confirm = body.confirm === true;
    const submit = body.submit === true;
    const delegate = body.delegate === true;

    if (!isStaff) {
      // P-D13 — the lead guest edits the draft; everyone else reads.
      if (actor.role !== 'customer' || !(await isLeadGuest(supabase, actor))) {
        return NextResponse.json({ error: 'lead_guest_only' }, { status: 403 });
      }
      if (confirm) {
        return NextResponse.json({ error: 'guide_confirms' }, { status: 403 });
      }
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
      return NextResponse.json(
        { error: 'rate_limited', retry_after_ms: gate.retryAfterMs ?? 0 },
        { status: 429 },
      );
    }

    const stops = body.stops !== undefined ? sanitizeStops(body.stops) : undefined;
    if (body.stops !== undefined && stops === null) {
      return NextResponse.json(
        { error: `stops must be 0-${MAX_STOPS} items, each with a title or poi_key` },
        { status: 400 },
      );
    }
    const needs = sanitizeNeeds(body.needs);

    const { data: existing } = await supabase
      .from('tour_day_plans')
      .select('*')
      .eq('booking_id', booking.id)
      .eq('tour_date', booking.tour_date)
      .maybeSingle();
    const existingStatus = (existing as { status?: string } | null)?.status ?? null;

    // Re-clicks and retried submits must not create duplicate feed capsules.
    if (!isStaff && submit && existingStatus === 'guest_submitted') {
      const existingStops = ((existing as { stops?: DayPlanStop[] } | null)?.stops ?? []) as DayPlanStop[];
      return NextResponse.json(
        {
          day_plan: existing,
          schedule: dayPlanStopsToSchedule(existingStops),
          ...((existing as { feasibility?: FeasibilityResult } | null)?.feasibility
            ? { feasibility: (existing as { feasibility: FeasibilityResult }).feasibility }
            : {}),
        },
        { status: 200 },
      );
    }

    // A8 — once the guide confirmed, guests request changes instead of editing.
    if (!isStaff && existingStatus !== null && existingStatus !== 'guest_draft') {
      return NextResponse.json({ error: 'plan_locked' }, { status: 409 });
    }

    let nextStops = stops ?? ((existing as { stops?: DayPlanStop[] } | null)?.stops ?? []);
    if (confirm && nextStops.length === 0) {
      return NextResponse.json({ error: 'Cannot confirm an empty plan' }, { status: 400 });
    }
    if (submit && nextStops.length === 0) {
      return NextResponse.json({ error: 'Cannot submit an empty plan' }, { status: 400 });
    }

    // W1.3 — enrich coords + recompute feasibility on every stops write.
    const tourMeta = await fetchTourMeta(supabase, booking.tour_id);
    let feasibility: FeasibilityResult | undefined;
    if (stops !== undefined || confirm || submit) {
      nextStops = await enrichStopCoords(supabase, nextStops);
      feasibility = assessDayPlanFeasibility({
        stops: nextStops,
        tourDate: booking.tour_date,
        totalHours: tourMeta.totalHours,
        region: tourMeta.region,
      });
    }

    const nextStatus = confirm
      ? 'guide_confirmed'
      : submit
        ? 'guest_submitted'
        : isStaff &&
          existingStatus &&
          (REVIEW_DAY_PLAN_STATUSES as readonly string[]).includes(existingStatus)
        ? existingStatus // a guide editing a confirmed plan keeps it live (MUTATE)
        : 'guest_draft';

    const { data: plan, error: planError } = await supabase
      .from('tour_day_plans')
      .upsert(
        {
          booking_id: booking.id,
          tour_date: booking.tour_date,
          stops: nextStops,
          status: nextStatus,
          ...(needs !== undefined ? { needs } : {}),
          ...(feasibility !== undefined ? { feasibility } : {}),
          version: ((existing as { version?: number } | null)?.version ?? 0) + 1,
          updated_by: actor.role,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'booking_id,tour_date' },
      )
      .select()
      .single();
    if (planError) throw planError;

    if (delegate) {
      // Tab ③ — "leave it to the guide": additive guide_curated flag on
      // bookings.itinerary (§G), so the lobby + guide console can phrase it.
      await setGuideCuratedFlag(supabase, booking.id, true);
    } else if (body.stops_changed === true) {
      // Any direct course/custom selection supersedes "guide curated".
      await setGuideCuratedFlag(supabase, booking.id, false);
    }

    const room = await ensureRoom(supabase, booking);
    const eventType = confirm
      ? 'plan_confirmed'
      : delegate
        ? 'plan_delegated'
        : submit
          ? 'plan_submitted'
          : 'plan_mutated';
    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: booking.id,
      type: eventType,
      actorRole: actor.role,
      payload: {
        version: (plan as { version: number }).version,
        stops_count: nextStops.length,
        ...(feasibility ? { warnings: feasibility.warnings.length } : {}),
      },
    }).catch(() => undefined);

    // Feed capsules — confirm/update (staff), submitted/delegated (guest).
    const capsule = confirm
      ? { kind: 'plan_confirmed', translations: PLAN_CONFIRMED }
      : delegate
        ? { kind: 'plan_delegated', translations: PLAN_DELEGATED }
        : submit
          ? { kind: 'plan_submitted', translations: PLAN_SUBMITTED }
          : isStaff && nextStatus !== 'guest_draft'
            ? { kind: 'plan_updated', translations: PLAN_CONFIRMED }
            : null;
    if (capsule) {
      const translations = { ...capsule.translations };
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
          metadata: { kind: capsule.kind, version: (plan as { version: number }).version },
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
      {
        day_plan: plan,
        schedule: dayPlanStopsToSchedule(nextStops),
        ...(feasibility ? { feasibility } : {}),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('PUT /api/tour-rooms/[bookingId]/plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
