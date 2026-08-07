/**
 * Imported-course templates for the D-1 planner's recommended tab.
 *
 * The Jeju private charter's product page imports the South/Southwest/East
 * course products' itineraries (`privateImportedCourses.ts`); this module is
 * the smart-app side of that same connection: a charter booking's /plan
 * templates response is guaranteed to include those courses, each carrying
 * `origin_tour_slug` so the planner's course preview renders the rich photo
 * cards + TourStopDetailDrawer instead of bland text rows.
 *
 * DB `course_templates` rows stay authoritative — a course already present
 * (matched on `origin_tour_slug`) is NOT duplicated. Synthesis prefers
 * `match_itinerary_stops` + `match_pois` (poi-linked stops keep feasibility +
 * photos when adopted into the plan) and falls back to the static bundle's
 * itinerary as free-text stops, so the courses appear even before ops seeds
 * match data for them.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';
import { getPrivateImportedCourses } from '@/components/product-tour-static/_shared/privateImportedCourses';
import { getStaticTourProductFullPageJson } from '@/components/product-tour-static/_shared/tourProductBundleRegistry';

type Sb = SupabaseClient<Database>;

/** Shape served by GET /plan/templates (mirrors the course_templates select). */
export interface ServedCourseTemplate {
  id: string;
  region: string;
  title_i18n: Record<string, string>;
  stops: Array<Record<string, unknown>>;
  total_hours: number | null;
  origin_tour_slug: string | null;
}

interface MatchStopRow {
  tour_slug: string;
  stop_index: number;
  poi_key: string | null;
  title: string | null;
}

interface MatchPoiRow {
  poi_key: string;
  name_en: string | null;
  name_ko: string | null;
  lat: number | null;
  lng: number | null;
  default_stay_minutes: number | null;
  category: string | null;
}

/** Mirrors the seed SQL's DayPlanStop shape (§C-2) — the /plan editor's input. */
function toDayPlanStop(
  seq: number,
  poi: MatchPoiRow | null,
  fallback: { en?: string | null; ko?: string | null },
): Record<string, unknown> {
  const name_i18n: Record<string, string> = {};
  const en = poi?.name_en ?? fallback.en;
  const ko = poi?.name_ko ?? fallback.ko;
  if (en) name_i18n.en = en;
  if (ko) name_i18n.ko = ko;
  return {
    id: `tpl-${seq}`,
    seq,
    source: poi ? 'poi' : 'free',
    ...(poi ? { poi_key: poi.poi_key } : {}),
    name_i18n,
    stop_type: 'sight',
    duration_min: poi?.default_stay_minutes ?? 60,
    status: 'pending',
    ...(typeof poi?.lat === 'number' ? { lat: poi.lat } : {}),
    ...(typeof poi?.lng === 'number' ? { lng: poi.lng } : {}),
    ...(poi?.category ? { category: poi.category } : {}),
  };
}

function headlineOf(json: { headlineLine1?: unknown; headlineLine2?: unknown } | null): string {
  if (!json) return '';
  return [json.headlineLine1, json.headlineLine2]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type StaticStop = { name?: unknown; _role?: unknown };

/** Place stops only (pickup/drop-off pseudo-stops are not wish-list places). */
function staticPlaceStops(json: { itineraryStops?: unknown } | null): StaticStop[] {
  const raw = json?.itineraryStops;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is StaticStop =>
      s != null &&
      typeof s === 'object' &&
      (s as StaticStop)._role !== 'pickup' &&
      (s as StaticStop)._role !== 'dropoff',
  );
}

/**
 * Synthesizes templates for the booked tour's imported courses that are not
 * already served from `course_templates` (matched on origin_tour_slug).
 * Returns [] for tours with no imported-course config — every non-charter
 * booking takes this zero-cost path.
 */
export async function buildImportedCourseTemplates(
  supabase: Sb,
  bookedTourSlug: string | null | undefined,
  region: string,
  existingOriginSlugs: ReadonlySet<string>,
): Promise<ServedCourseTemplate[]> {
  const courses = bookedTourSlug ? getPrivateImportedCourses(bookedTourSlug) : null;
  if (!courses) return [];
  const missing = courses.filter((c) => !existingOriginSlugs.has(c.slug));
  if (missing.length === 0) return [];

  const slugs = missing.map((c) => c.slug);
  const { data: stopRows } = await supabase
    .from('match_itinerary_stops')
    .select('tour_slug, stop_index, poi_key, title')
    .in('tour_slug', slugs)
    .order('stop_index', { ascending: true });
  const matchStops = (stopRows ?? []) as MatchStopRow[];

  const poiKeys = [...new Set(matchStops.map((s) => s.poi_key).filter((k): k is string => !!k))];
  let poiByKey = new Map<string, MatchPoiRow>();
  if (poiKeys.length > 0) {
    const { data: poiRows } = await supabase
      .from('match_pois')
      .select('poi_key, name_en, name_ko, lat, lng, default_stay_minutes, category')
      .in('poi_key', poiKeys);
    poiByKey = new Map(((poiRows ?? []) as MatchPoiRow[]).map((p) => [p.poi_key, p]));
  }

  const out: ServedCourseTemplate[] = [];
  for (const course of missing) {
    // en+ko static bundles give the localized title and the free-stop fallback.
    const [enJson, koJson] = await Promise.all([
      getStaticTourProductFullPageJson(course.slug, 'en').catch(() => null),
      getStaticTourProductFullPageJson(course.slug, 'ko').catch(() => null),
    ]);

    const own = matchStops.filter((s) => s.tour_slug === course.slug);
    let stops: Array<Record<string, unknown>>;
    if (own.length > 0) {
      stops = own.map((row, i) =>
        toDayPlanStop(i + 1, row.poi_key ? (poiByKey.get(row.poi_key) ?? null) : null, {
          en: row.title,
        }),
      );
    } else {
      const enStops = staticPlaceStops(enJson);
      const koStops = staticPlaceStops(koJson);
      stops = enStops.map((s, i) =>
        toDayPlanStop(i + 1, null, {
          en: typeof s.name === 'string' ? s.name : null,
          ko: typeof koStops[i]?.name === 'string' ? (koStops[i].name as string) : null,
        }),
      );
    }
    if (stops.length === 0) continue;

    const title_i18n: Record<string, string> = {};
    const enTitle = headlineOf(enJson) || course.chipLabel.en;
    const koTitle = headlineOf(koJson) || course.chipLabel.ko;
    if (enTitle) title_i18n.en = enTitle;
    if (koTitle) title_i18n.ko = koTitle;

    out.push({
      id: `imported-${course.slug}`,
      region,
      title_i18n,
      stops,
      total_hours: null,
      origin_tour_slug: course.slug,
    });
  }
  return out;
}
