/**
 * W2 — pure helpers for the guide console's day-plan review panel.
 *
 * - markNewStops: the §G confirm screen's draft "diff" — which stops of the
 *   guest draft are NOT in the schedule the room currently serves (so the
 *   guide sees at a glance what the guests actually asked for).
 * - swapSuggestions: the W2.2 MUTATE replacement recommender — same-category
 *   match_pois within a radius of the skipped stop, nearest first (D5/D6/F3).
 *
 * Pure functions; the console fetches pois via the public region listing and
 * passes them in.
 */

import { haversineKm } from '@/lib/itinerary-builder/distance';
import { humanizePoiKey, type DayPlanStop } from '@/lib/tour-room/dayPlan';

function normTitle(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function stopTitles(stop: DayPlanStop): string[] {
  const titles: string[] = [];
  if (stop.name_i18n && typeof stop.name_i18n === 'object') {
    for (const v of Object.values(stop.name_i18n)) {
      const t = normTitle(v);
      if (t) titles.push(t);
    }
  }
  if (typeof stop.poi_key === 'string' && stop.poi_key) titles.push(normTitle(humanizePoiKey(stop.poi_key)));
  return titles;
}

export interface ScheduleItemish {
  title?: unknown;
  poi_key?: unknown;
  [key: string]: unknown;
}

/**
 * Which draft stops are new relative to the currently-served schedule?
 * Matches by poi_key first, then by any localized title (case-insensitive).
 * Returns the set of draft stop ids (falling back to `seq:` keys).
 */
export function markNewStops(
  draftStops: DayPlanStop[],
  currentSchedule: ScheduleItemish[],
): Set<string> {
  const knownKeys = new Set<string>();
  const knownTitles = new Set<string>();
  for (const item of currentSchedule ?? []) {
    if (typeof item?.poi_key === 'string' && item.poi_key) knownKeys.add(item.poi_key);
    const t = normTitle(item?.title);
    if (t) knownTitles.add(t);
  }
  const fresh = new Set<string>();
  for (const stop of draftStops ?? []) {
    const id = typeof stop.id === 'string' ? stop.id : `seq:${stop.seq ?? 0}`;
    if (typeof stop.poi_key === 'string' && knownKeys.has(stop.poi_key)) continue;
    if (stopTitles(stop).some((t) => knownTitles.has(t))) continue;
    fresh.add(id);
  }
  return fresh;
}

export interface SuggestionPoi {
  poi_key: string;
  name_en?: string | null;
  name_ko?: string | null;
  category?: string | null;
  lat?: number | null;
  lng?: number | null;
  default_stay_minutes?: number | null;
  [key: string]: unknown;
}

export interface SwapSuggestion {
  poi: SuggestionPoi;
  distance_km: number;
}

/**
 * Same-category replacements near a skipped stop (W2.2). Needs the skipped
 * stop's coords; category comes from the poi list itself when the stop is a
 * curated POI (google/free stops fall back to distance-only suggestions).
 */
export function swapSuggestions(args: {
  target: DayPlanStop;
  pois: SuggestionPoi[];
  /** poi_keys already in the plan — never suggest what's already there. */
  excludePoiKeys?: Iterable<string | null | undefined>;
  radiusKm?: number;
  limit?: number;
}): SwapSuggestion[] {
  const { target } = args;
  const lat = typeof target.lat === 'number' ? target.lat : Number(target.lat);
  const lng = typeof target.lng === 'number' ? target.lng : Number(target.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const radius = args.radiusKm ?? 20;
  const limit = args.limit ?? 3;
  const exclude = new Set([...(args.excludePoiKeys ?? [])].filter(Boolean) as string[]);
  if (typeof target.poi_key === 'string') exclude.add(target.poi_key);

  const targetCategory =
    typeof target.poi_key === 'string'
      ? args.pois.find((p) => p.poi_key === target.poi_key)?.category ?? null
      : null;

  return args.pois
    .filter(
      (poi) =>
        poi.poi_key &&
        !exclude.has(poi.poi_key) &&
        typeof poi.lat === 'number' &&
        typeof poi.lng === 'number' &&
        (targetCategory === null || poi.category === targetCategory),
    )
    .map((poi) => ({
      poi,
      distance_km: haversineKm({ lat, lng }, { lat: poi.lat as number, lng: poi.lng as number }),
    }))
    .filter((s) => s.distance_km <= radius)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, limit);
}
