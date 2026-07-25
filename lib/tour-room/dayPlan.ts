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
  status: 'guest_draft' | 'guest_submitted' | 'guide_confirmed' | 'live' | 'done';
  stops: DayPlanStop[];
  needs: Record<string, unknown> | null;
  /**
   * §11.D D4 — the lead guest's daily departure time "HH:MM" (KST), null until
   * set in the plan editor. The `select('*')` in resolveDaySchedule already
   * carries it onto snapshot.day_plan; the guest countdown targets
   * departure_time + baseHoursForCity (see DepartureCountdown).
   */
  departure_time?: string | null;
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

/**
 * P0-5 — pick a name in the reader's language.
 *
 * This resolver used to read `names.en` with no locale in scope at all, so a
 * Chinese guest was served English for every stop even when the Chinese name
 * was sitting right there in the same jsonb. The lookup ladder mirrors the one
 * already used by PlanEditorClient / skipNotice / locale-content:
 *
 *   exact locale → base language (zh-TW → zh) → any regional sibling (zh → zh-TW)
 *   → en → any non-empty value
 *
 * English stays the LAST resort rather than the first, which is the whole bug.
 */
export function pickLocalizedName(
  names: Record<string, string> | null | undefined,
  locale?: string | null,
): string {
  if (!names || typeof names !== 'object') return '';
  const clean = (value: unknown): string =>
    typeof value === 'string' && value.trim() ? value.trim() : '';

  const wanted = (locale ?? '').trim();
  if (wanted) {
    const exact = clean(names[wanted]);
    if (exact) return exact;

    const base = wanted.split('-')[0];
    if (base && base !== wanted) {
      const baseHit = clean(names[base]);
      if (baseHit) return baseHit;
    }
    // 'zh' should still find 'zh-TW' when only the regional variant is stored.
    const sibling = Object.keys(names).find((key) => key.split('-')[0] === base && clean(names[key]));
    if (sibling) return clean(names[sibling]);
  }

  const english = clean(names.en);
  if (english) return english;
  const first = Object.values(names).find((value) => clean(value));
  return clean(first);
}

function stopTitle(stop: DayPlanStop, locale?: string | null): string {
  const preferred = pickLocalizedName(stop.name_i18n, locale);
  if (preferred) return preferred;
  if (typeof stop.poi_key === 'string' && stop.poi_key) return humanizePoiKey(stop.poi_key);
  return '';
}

/**
 * Stage ① transform — day-plan stops to the room's ScheduleItemLike shape
 * (time/title index-signature contract shared by RoomShell's Today tab and
 * the concierge Tier0 answers). Skipped stops are excluded so "next stop"
 * answers never point at a stop the guide removed; ordering follows seq.
 */
export function dayPlanStopsToSchedule(
  stops: DayPlanStop[] | unknown,
  locale?: string | null,
): ScheduleItemLike[] {
  if (!Array.isArray(stops)) return [];
  return (stops as DayPlanStop[])
    .filter((stop) => stop && typeof stop === 'object' && stop.status !== 'skipped')
    .slice()
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    .map((stop) => {
      const time = typeof stop.arrival_planned === 'string' ? stop.arrival_planned.slice(0, 5) : '';
      const item: ScheduleItemLike = {
        title: stopTitle(stop, locale),
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
  /**
   * P0-5 — the reader's language. Stage ① reads it out of `name_i18n` and
   * stage ② out of `match_pois.names_other_locales`; omitting it keeps the old
   * English-first behaviour for callers that are not guest-facing (ops gate,
   * driver overview).
   */
  locale?: string | null;
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
        return {
          source: 'day_plan',
          schedule: dayPlanStopsToSchedule(plan.stops, args.locale),
          dayPlan: plan,
        };
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
      // P0-5 — names_other_locales carries ja / zh / zh-TW / es for most POIs
      // (75 of 124 live). Selecting name_en alone is why a Chinese guest saw an
      // English itinerary while the Chinese name sat unused in the same row.
      const { data } = await supabase
        .from('match_pois')
        .select('poi_key, name_en, name_ko, names_other_locales')
        .in('poi_key', poiKeys);
      for (const row of (data ?? []) as Array<{
        poi_key?: string;
        name_en?: string | null;
        name_ko?: string | null;
        names_other_locales?: Record<string, string> | null;
      }>) {
        if (!row.poi_key) continue;
        const names: Record<string, string> = { ...(row.names_other_locales ?? {}) };
        if (row.name_en) names.en = row.name_en;
        if (row.name_ko) names.ko = row.name_ko;
        const title = pickLocalizedName(names, args.locale);
        if (title) titleByKey[row.poi_key] = title;
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
