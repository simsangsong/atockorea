/**
 * Fetch all active match_tours rows from Supabase.
 * Returns the shape consumed by matcher.matchTours().
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isTourSlugBlockedFromConsumerSurfaces } from "@/lib/tour-consumer-visibility";
import type { MatchTourRow } from "./types";

export async function fetchMatchTours(supabase: SupabaseClient, locale = "en"): Promise<MatchTourRow[]> {
  const { data, error } = await supabase
    .from("match_tours")
    .select(
      "slug, product_id, locale, schema_version, matching_profile, matching_metadata, " +
        "available_months, primary_themes, secondary_themes, best_for, not_recommended_for, " +
        "anchor_poi_keys, competing_products, destination_region, pickup_region, duration_hours, " +
        "vehicle_type, enrichment_batch, kb_version, profile_version, a_grade, " +
        "is_cruise_excursion, is_charter_route_options"
    )
    .eq("locale", locale);

  if (error) {
    console.error("[fetchMatchTours] error:", error.message);
    throw error;
  }
  // match_tours has no active flag, so deactivated/blocked SKUs would still be
  // matched and recommended (home matcher + chatbot). Filter them out here using
  // the same consumer blocklist the catalog/sitemap/agent surfaces use, so we
  // hide rather than delete match_tours rows (reversible — un-blocklist to restore).
  return ((data ?? []) as unknown as MatchTourRow[]).filter(
    (row) => !isTourSlugBlockedFromConsumerSurfaces(row.slug)
  );
}
