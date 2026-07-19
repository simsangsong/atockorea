/**
 * Plan §G tab ① — mapping the BOOKED tour's itinerary stops into wish-list
 * editor stops. Pure + framework-free so it's unit-testable in isolation (the
 * PlanEditorClient tree pulls framer-motion via the shared drawer).
 */

import type { ItineraryStop } from '@/components/product-tour-static/_shared/tourProductDetailSectionTypes';

/** Server caps a day plan at 20 stops (plan route MAX_STOPS); mirror it client-side. */
export const MAX_PLAN_STOPS = 20;

/** The wish-list editor stop shape (subset shared with PlanEditorClient). */
export interface PlanEditorStop {
  id: string;
  source: 'poi' | 'google' | 'free';
  poi_key?: string | null;
  place_id?: string | null;
  title: string;
  stop_type: string;
  arrival_planned?: string | null;
  duration_min: number | null;
  lat?: number | null;
  lng?: number | null;
  memo_guest?: string;
}

/** The curated-POI fields the mapper reads (a subset of the picker POI). */
export interface PlanMapperPoi {
  default_stay_minutes: number | null;
  lat: number | null;
  lng: number | null;
}

/**
 * Best-effort minutes from an itinerary stop's free-text duration
 * ("1h", "90 min", "1.5시간", "1小时30分"). Null when nothing parses.
 */
export function parseDurationMin(raw?: string): number | null {
  if (!raw) return null;
  const t = raw.toLowerCase();
  let mins = 0;
  const h = /(\d+(?:\.\d+)?)\s*(?:h|hr|hour|hours|시간|小时|時間|hora)/.exec(t);
  const m = /(\d+)\s*(?:m|min|mins|minute|minutes|분|分|minuto)/.exec(t);
  if (h) mins += Math.round(Number.parseFloat(h[1]) * 60);
  if (m) mins += Number.parseInt(m[1], 10);
  if (!h && !m) {
    const n = Number.parseInt(t, 10);
    if (Number.isFinite(n)) mins = n;
  }
  return mins > 0 ? mins : null;
}

/**
 * Map a booked-tour itinerary stop → an editor wish-list stop. The caller
 * resolves `poi` from the loaded match_pois so a `_poi_meta.poi_key` stop
 * carries coords (region/feasibility) and the guide diff keeps working;
 * non-POI stops become plain 'free' stops. `index` only disambiguates the id.
 */
export function tourStopToEditorStop(
  stop: ItineraryStop,
  poi: PlanMapperPoi | undefined,
  index: number,
): PlanEditorStop {
  const poiKey = stop._poi_meta?.poi_key ?? null;
  const hm = /^(\d{1,2}):(\d{2})/.exec((stop.time ?? '').trim());
  return {
    id: `tour-${stop.number}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    source: poiKey ? 'poi' : 'free',
    poi_key: poiKey,
    place_id: null,
    title: stop.name.slice(0, 120),
    stop_type: 'sight',
    arrival_planned: hm ? `${hm[1].padStart(2, '0')}:${hm[2]}` : null,
    duration_min: parseDurationMin(stop.duration) ?? poi?.default_stay_minutes ?? null,
    lat: poi?.lat ?? null,
    lng: poi?.lng ?? null,
    memo_guest: undefined,
  };
}
