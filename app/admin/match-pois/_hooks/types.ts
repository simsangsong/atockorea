/**
 * Shared types for the admin match_pois editor.
 *
 * Mirrors the editable surface of `public.match_pois`. The list pane uses the
 * trimmed `PoiListItem`; the editor uses the full `PoiRow`. Read-only display
 * columns (`is_operational`, `created_at`, `updated_at`) are present but never
 * sent on save. See planner §F Phase 8 / D11 for the verified column shapes
 * (highlights/images are jsonb arrays; poi_meta is jsonb NOT NULL).
 */

/** Trimmed row for the list pane (matches GET /api/admin/match-pois). */
export type PoiListItem = {
  poi_key: string;
  name_en: string | null;
  name_ko: string | null;
  region: string | null;
  category: string | null;
  default_image_url: string | null;
  is_attraction: boolean | null;
  stop_role: string | null;
  lat: number | null;
  lng: number | null;
  updated_at: string | null;
  override_pinned: boolean;
};

/** Full row for the editor (matches GET /api/admin/match-pois/[poi_key]). */
export type PoiRow = {
  poi_key: string;
  name_en: string | null;
  name_ko: string | null;
  names_other_locales: Record<string, unknown> | null;
  region: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
  default_image_url: string | null;
  default_stay_minutes: number | null;
  stop_role: string | null;
  is_attraction: boolean | null;
  is_operational?: boolean | null;
  description: string | null;
  highlights: string[] | null;
  images: string[] | null;
  why_on_route: string | null;
  visit_basics: Record<string, unknown> | null;
  convenience: Record<string, unknown> | null;
  smart_notes: Record<string, unknown> | null;
  matching_profile: Record<string, unknown> | null;
  poi_meta: Record<string, unknown> | null;
  builder_profile_source: string | null;
  builder_profile_version: number | null;
  kb_version: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  override_pinned?: boolean;
};

/** Columns the editor is allowed to send on save — mirrors the API whitelist. */
export const EDITABLE_KEYS = [
  'name_en',
  'name_ko',
  'names_other_locales',
  'region',
  'category',
  'lat',
  'lng',
  'default_image_url',
  'default_stay_minutes',
  'stop_role',
  'is_attraction',
  'description',
  'highlights',
  'images',
  'why_on_route',
  'visit_basics',
  'convenience',
  'smart_notes',
  'matching_profile',
  'poi_meta',
  'builder_profile_source',
  'builder_profile_version',
  'kb_version',
] as const;

export type EditableKey = (typeof EDITABLE_KEYS)[number];

/** An empty draft for create mode (selecting a poi_key that has no row yet). */
export function emptyPoiRow(poiKey: string): PoiRow {
  return {
    poi_key: poiKey,
    name_en: '',
    name_ko: null,
    names_other_locales: null,
    region: null,
    category: null,
    lat: null,
    lng: null,
    default_image_url: null,
    default_stay_minutes: null,
    stop_role: null,
    is_attraction: true,
    description: null,
    highlights: null,
    images: null,
    why_on_route: null,
    visit_basics: null,
    convenience: null,
    smart_notes: null,
    matching_profile: null,
    poi_meta: {},
    builder_profile_source: null,
    builder_profile_version: null,
    kb_version: null,
  };
}

export function pickEditable(row: PoiRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of EDITABLE_KEYS) out[k] = (row as Record<string, unknown>)[k] ?? null;
  return out;
}
