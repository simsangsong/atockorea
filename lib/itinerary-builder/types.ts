/**
 * Shared types for the itinerary builder feature.
 *
 * `MatchPoiRow` mirrors the columns we read from `match_pois` for the
 * read-only map UI in Phase 3. Other fields exist on the row but aren't
 * needed by the map pin; add them here when a downstream consumer needs them.
 */

import type { RegionSlug } from "./regions";

export interface MatchPoiRow {
  poi_key: string;
  name_en: string;
  name_ko: string | null;
  names_other_locales: Record<string, string> | null;
  region: string;
  category: string | null;
  default_image_url: string | null;
  default_stay_minutes: number | null;
  lat: number;
  lng: number;
  /** Mirrored from `poi_meta.sources` etc. */
  poi_meta: Record<string, unknown> | null;
  /** Phase 6.5 enrichment — rich content from tour JSONs */
  description?: string | null;
  highlights?: string[] | null;
  images?: string[] | null;
  why_on_route?: string | null;
  smart_notes?: Record<string, unknown> | null;
  visit_basics?: Record<string, unknown> | null;
  convenience?: Record<string, unknown> | null;
}

export interface POIMapContext {
  region: RegionSlug;
  pois: MatchPoiRow[];
  /** Locale code, e.g. "en", "ko", "ja". */
  locale: string;
}
