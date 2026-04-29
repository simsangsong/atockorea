/**
 * Type contracts for the v1.8 matching engine. Mirrors the Python simulation
 * (`match_sim/scripts/parse_query.py` + `match_tours.py`) 1:1 so that any
 * regression result can be replayed cross-language.
 */

export type Locale = "ko" | "en" | "zh-TW" | "zh-CN" | "ja";

export type ParsedQueryV2 = {
  raw_query: string;
  raw_query_locale: Locale;
  regions: string[];
  sub_regions: string[];
  season: "spring" | "summer" | "autumn" | "winter" | null;
  months: number[] | null;
  season_locks: string[];
  personas: string[];
  themes: string[];
  anchor_pois_mentioned: string[];
  pace: "relaxed" | "active" | "moderate" | null;
  format: "private" | "small_group" | "bus_tour" | "charter" | null;
  duration_constraint: "half_day" | "day_trip" | "extended" | null;
  user_max_hours: number | null;
  hard_constraints: string[];
  wants_cruise: boolean;
  wants_charter_customization: boolean;
  is_multi_day_request: boolean;
  boost_dimensions: Record<string, number>;
  negative_signals: string[];
  confidence: number;
  parser_notes: string;
  /** Telemetry — present only on Haiku-mode parse */
  _telemetry?: {
    model: string;
    input_tokens: number;
    cache_create_input_tokens: number;
    cache_read_input_tokens: number;
    output_tokens: number;
    elapsed_ms: number;
  };
};

export type MatchTourRow = {
  slug: string;
  product_id?: string | null;
  locale: string;
  schema_version: number;
  matching_profile: Record<string, unknown>;
  matching_metadata?: Record<string, unknown> | null;
  available_months: number[];
  primary_themes: string[];
  secondary_themes: string[];
  best_for: string[];
  not_recommended_for: string[];
  anchor_poi_keys: string[];
  competing_products: string[];
  destination_region: string | null;
  pickup_region: string | null;
  duration_hours: number | null;
  vehicle_type: string | null;
  enrichment_batch: string | null;
  kb_version: string | null;
  profile_version: number | null;
  a_grade: boolean;
  is_cruise_excursion: boolean;
  is_charter_route_options: boolean;
};

export type ScoredMatchV2 = {
  slug: string;
  destination_region: string | null;
  enrichment_batch: string | null;
  a_grade: boolean;
  available_months: number[];
  primary_themes: string[];
  best_for: string[];
  anchor_poi_keys: string[];
  matching_profile_size: number;
  total_score: number;
  score_components: Record<string, number>;
  match_reasons: string[];
};

export type RejectedRow = {
  slug: string;
  destination_region: string | null;
  reasons: string[];
};

export type MatchResponseV2 = {
  candidates_passed_hard_filter: number;
  candidates_rejected_count: number;
  top_matches: ScoredMatchV2[];
  notes: string[];
  rejected_summary?: RejectedRow[];
  match_elapsed_ms?: number;
};
