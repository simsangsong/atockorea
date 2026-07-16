/**
 * W0.2 — the 4-stage day-schedule resolver
 * (smart-guide private-mode master plan §C-4).
 *
 *   ① tour_day_plans (status guide_confirmed / live / done)
 *   ② bookings.itinerary.poi_keys (itinerary-builder bookings)
 *   ③ tours.schedule (legacy jsonb — today's only source)
 *   ④ [] — the honest fallback
 *
 * Every schedule consumer (room snapshot, concierge Tier0 context, guide
 * overview) reads this chain and nothing else. With no tour_day_plans row and
 * no itinerary poi_keys the output is byte-identical to the legacy
 * `tour.schedule ?? []` path — that equivalence is the W0 regression gate.
 *
 * Read-bundle contract (same as snapshot.ts): any stage's query failure
 * degrades to the next stage, never throws.
 */

import type { RoomDbClient } from '@/lib/tour-room/access';
import type { ScheduleItemLike } from '@/lib/tour-room/concierge';

export type ScheduleSource = 'day_plan' | 'booking_itinerary' | 'tour_schedule' | 'none';

/** §C-2 stop element (jsonb — keep fields optional and tolerate extras). */
export interface DayPlanStop {
  id?: string;
  seq?: number;
  source?: 'poi' | 'google' | 'free';
  poi_key?: string | null;
  place_id?: string | null;
  name_i18n?: Record<string, string> | null;
  stop_type?: string;
  arrival_planned?: string | null;
  duration_min?: number | null;
  status?: string;
  skip_reason?: string | null;
  [key: string]: unknown;
}

export interface DayPlanRow {
  id: string;
  booking_id: string;
  room_id: string | null;
  tour_date: string;
  status: 'guest_draft' | 'guide_confirmed' | 'live' | 'done';
  stops: DayPlanStop[];
  needs: Record<string, unknown> | null;
  feasibility: Record<string, unknown> | null;
  version: number;
  updated_by: string | null;
  updated_at: string;
  [key: string]: unknown;
}

/** Statuses at which a day plan owns the room's schedule (drafts do not). */
export const ACTIVE_DAY_PLAN_STATUSES = ['guide_confirmed', 'live', 'done'] as const;

export interface ResolvedDaySchedule {
  source: ScheduleSource;
  schedule: ScheduleItemLike[];
  /** The active plan when source === 'day_plan' (null otherwise). */
  dayPlan: DayPlanRow | null;
}

/** 'gyeongbokgung_palace' → 'Gyeongbokgung Palace' (stage-② name fallback). */
export function humanizePoiKey(poiKey: string): string {
  return poiKey
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function stopTitle(stop: DayPlanStop): string {
  const names = stop.name_i18n;
  if (names && typeof names === 'object') {
    const preferred = names.en ?? Object.values(names).find((v) => typeof v === 'string' && v.trim());
    if (typeof preferred === 'string' && preferred.trim()) return preferred.trim();
  }
  if (typeof stop.poi_key === 'string' && stop.poi_key) return humanizePoiKey(stop.poi_key);
  return '';
}

/**
 * Stage ① transform — day-plan stops to the room's ScheduleItemLike shape
 * (time/title index-signature contract shared by RoomShell's Today tab and
 * the concierge Tier0 answers). Skipped stops are excluded so "next stop"
 * answers never point at a stop the guide removed; ordering follows seq.
 */
export function dayPlanStopsToSchedule(stops: DayPlanStop[] | unknown): ScheduleItemLike[] {
  if (!Array.isArray(stops)) return [];
  return (stops as DayPlanStop[])
    .filter((stop) => stop && typeof stop === 'object' && stop.status !== 'skipped')
    .slice()
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    .map((stop) => {
      const time = typeof stop.arrival_planned === 'string' ? stop.arrival_planned.slice(0, 5) : '';
      const item: ScheduleItemLike = {
        title: stopTitle(stop),
        source: 'day_plan',
      };
      if (/^\d{2}:\d{2}$/.test(time)) item.time = time;
      if (stop.poi_key) item.poi_key = stop.poi_key;
      if (stop.stop_type) item.stop_type = stop.stop_type;
      if (stop.status) item.status = stop.status;
      if (typeof stop.duration_min === 'number') item.duration_min = stop.duration_min;
      return item;
    })
    .filter((item) => item.title !== '' || typeof item.time === 'string');
}

/** Stage ② transform — itinerary poi_keys to schedule items (no times). */
export function poiKeysToSchedule(
  poiKeys: string[],
  titleByKey: Record<string, string> = {},
): ScheduleItemLike[] {
  return poiKeys
    .filter((key) => typeof key === 'string' && key.trim())
    .map((key) => ({
      title: titleByKey[key] || humanizePoiKey(key),
      poi_key: key,
      source: 'booking_itinerary',
    }));
}

function extractPoiKeys(itinerary: unknown): string[] {
  if (!itinerary || typeof itinerary !== 'object') return [];
  const keys = (itinerary as { poi_keys?: unknown }).poi_keys;
  if (!Array.isArray(keys)) return [];
  return keys.filter((key): key is string => typeof key === 'string' && key.trim() !== '');
}

export interface ResolveDayScheduleArgs {
  bookingId: string;
  tourDate: string | null;
  /**
   * bookings.itinerary when the caller already fetched it; `undefined` makes
   * the resolver fetch it, `null` means "known absent" (skips the query).
   */
  itinerary?: unknown;
  /** tours.schedule from the caller's existing tours join (stage ③ input). */
  tourSchedule?: unknown;
}

export async function resolveDaySchedule(
  supabase: RoomDbClient,
  args: ResolveDayScheduleArgs,
): Promise<ResolvedDaySchedule> {
  // ── stage ① — an active day plan owns the schedule ──────────────────────
  if (args.tourDate) {
    try {
      const { data } = await supabase
        .from('tour_day_plans')
        .select('*')
        .eq('booking_id', args.bookingId)
        .eq('tour_date', args.tourDate)
        .in('status', [...ACTIVE_DAY_PLAN_STATUSES])
        .maybeSingle();
      if (data) {
        const plan = data as DayPlanRow;
        return { source: 'day_plan', schedule: dayPlanStopsToSchedule(plan.stops), dayPlan: plan };
      }
    } catch {
      // degrade to stage ②
    }
  }

  // ── stage ② — itinerary-builder bookings carry poi_keys ─────────────────
  let itinerary = args.itinerary;
  if (itinerary === undefined) {
    try {
      const { data } = await supabase
        .from('bookings')
        .select('itinerary')
        .eq('id', args.bookingId)
        .maybeSingle();
      itinerary = (data as { itinerary?: unknown } | null)?.itinerary ?? null;
    } catch {
      itinerary = null;
    }
  }
  const poiKeys = extractPoiKeys(itinerary);
  if (poiKeys.length > 0) {
    let titleByKey: Record<string, string> = {};
    try {
      const { data } = await supabase
        .from('match_pois')
        .select('poi_key, name_en')
        .in('poi_key', poiKeys);
      for (const row of (data ?? []) as Array<{ poi_key?: string; name_en?: string | null }>) {
        if (row.poi_key && row.name_en) titleByKey[row.poi_key] = row.name_en;
      }
    } catch {
      titleByKey = {};
    }
    return { source: 'booking_itinerary', schedule: poiKeysToSchedule(poiKeys, titleByKey), dayPlan: null };
  }

  // ── stage ③ — legacy tours.schedule passthrough ──────────────────────────
  if (Array.isArray(args.tourSchedule) && args.tourSchedule.length > 0) {
    return { source: 'tour_schedule', schedule: args.tourSchedule as ScheduleItemLike[], dayPlan: null };
  }

  // ── stage ④ — honest fallback ────────────────────────────────────────────
  return { source: 'none', schedule: [], dayPlan: null };
}
