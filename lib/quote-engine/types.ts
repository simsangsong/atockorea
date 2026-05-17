/**
 * Quote-engine types. Pure data shapes shared by classify / compute /
 * fingerprint / memory-lookup so each module stays unit-testable.
 *
 * Phase 5 — see docs/itinerary-builder-plan.md §F Phase 5.
 */

export type Track = "private" | "cruise";

export interface VehicleTier {
  max_pax: number;
  krw: number;
}

export interface InScopeRules {
  max_pax: number;
  max_hours: number;
  max_distance_km: number;
  /** Any cart that includes one of these poi_keys forces out-of-scope. */
  disallowed_poi_keys: string[];
}

export interface QuotePresetRow {
  id: string;
  region: string;
  track: Track;
  base_krw: number;
  vehicle_tier_table: VehicleTier[];
  per_hour_krw: number;
  hours_baseline_h: number;
  per_km_krw: number;
  km_baseline_km: number;
  per_poi_krw: number;
  poi_baseline_count: number;
  language_premium: Record<string, number>;
  in_scope_rules: InScopeRules;
  active: boolean;
}

/** Snapshot of the request shape the engine consumes. */
export interface QuoteIntake {
  region: string;
  track: Track;
  /** Party size; null if user didn't supply — engine defaults to 2. */
  pax: number | null;
  /** Total day duration in hours (drive + stay). Null = compute zero. */
  hours: number | null;
  /** Total road-distance estimate in km (Haversine × 1.3). Null = zero. */
  distance_km: number | null;
  /** Language code: en / ko / ja / zh / zh-TW / es. Falls back to "en". */
  language: string;
  poi_keys: string[];
}

export interface ClassifyResult {
  in_scope: boolean;
  violations: string[];
}

export interface QuoteBreakdown {
  /** Snapshot of preset id used (for audit). */
  preset_id: string;
  region: string;
  track: Track;

  // Per-component contributions to total
  base_krw: number;
  vehicle_tier_krw: number;
  vehicle_tier_label: string;
  duration_surcharge_krw: number;
  duration_overage_h: number;
  distance_surcharge_krw: number;
  distance_overage_km: number;
  poi_surcharge_krw: number;
  poi_overage_count: number;
  language_premium_krw: number;
  language: string;

  // Snapshot of inputs (so historical quotes are self-explanatory)
  inputs: {
    pax: number;
    hours: number;
    distance_km: number;
    poi_count: number;
  };

  /** Sum of all per-component contributions. */
  total_krw: number;
}

/** Precedent result from quote_memory. */
export interface PrecedentMatch {
  /** Best estimate from precedent rows (median when exact, mean when loose). */
  amount_krw: number;
  /** "exact" = same fingerprint match; "loose" = region+track only. */
  confidence: "exact" | "loose";
  /** Number of precedent rows consulted. */
  sample_size: number;
  /** Most recent referenced memory row id, for FK on the new quote request. */
  precedent_id: string;
}
