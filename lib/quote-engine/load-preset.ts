/**
 * Fetch the (active) quote preset for a given (region, track) tuple.
 * Returns null if no preset row exists or the row is marked inactive
 * (so caller can route to manual escalation regardless of in/out-of-scope).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuotePresetRow, Track } from "./types";

export async function loadActivePreset(
  supabase: SupabaseClient,
  region: string,
  track: Track
): Promise<QuotePresetRow | null> {
  const { data, error } = await supabase
    .from("quote_presets")
    .select(
      "id, region, track, base_krw, vehicle_tier_table, per_hour_krw, hours_baseline_h, per_km_krw, km_baseline_km, per_poi_krw, poi_baseline_count, language_premium, in_scope_rules, active"
    )
    .eq("region", region)
    .eq("track", track)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[loadActivePreset] error:", error);
    return null;
  }
  if (!data) return null;
  return data as QuotePresetRow;
}
