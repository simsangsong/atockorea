/**
 * Server-only candidate query helper.
 * Calls get_poi_candidates() RPC — which joins only poi_search_profile +
 * poi_reco_features. Does NOT load display/operational fields from
 * jeju_kor_tourapi_places (those are loaded only after final POIs are fixed).
 *
 * Architecture rules enforced:
 * - Rule 8: no SELECT * in recommendation flow
 * - Rule 9: only search-layer and reco-layer fields returned
 * - Rule 10: operational/display fields deferred to hydration step
 * - Rule 6: ranking is SQL-first and deterministic
 */
import { createServerClient } from '@/lib/supabase';
import type { ParsedRequestSlots } from '@/lib/itinerary/parser/types';

/**
 * Lean candidate row returned by get_poi_candidates().
 * Contains only search/reco layer fields — no overview, no images,
 * no operational details.
 *
 * poi_id is bigint in DB; Supabase JS returns it as number (safe for
 * values up to 2^53 which covers all practical BIGINT identity values).
 */
export type LeanPoiCandidate = {
  poi_id: number;
  content_id: string;
  display_name: string | null;
  region: string | null;
  subregion: string | null;
  summary_line: string | null;
  recommended_stay_minutes: number | null;
  walking_difficulty: string | null;
  indoor_outdoor: string | null;
  quick_photo_stop_ok: boolean | null;
  base_rank_score: number;
  final_score: number;
};

/**
 * Fetch lean POI candidates using SQL-first deterministic ranking.
 *
 * @param slots   - Structured slots from the deterministic parser.
 * @param limit   - Max candidates to return (default 40, clamped to [1, 120] in SQL).
 * @returns       - Ordered lean candidate list (final_score DESC, poi_id ASC).
 * @throws        - Surfaces DB errors explicitly; caller decides on fallback.
 */
export async function getPoiCandidates(
  slots: ParsedRequestSlots,
  limit = 40,
): Promise<LeanPoiCandidate[]> {
  const supabase = createServerClient();

  const paramsWithRain: Record<string, unknown> = {
    p_region:              slots.regionPreference,
    p_subregion:           slots.subregionPreference,
    p_max_walking_level:   slots.maxWalkingLevel,
    p_need_indoor_if_rain: slots.needIndoorIfRain,
    p_rain_aware:          slots.rainAware,
    p_first_visit:         slots.firstVisit,
    p_photo_priority:      slots.photoPriority,
    p_hidden_gem_priority: slots.hiddenGemPriority,
    p_iconic_priority:     slots.iconicPriority,
    p_nature_priority:     slots.naturePriority,
    p_culture_priority:    slots.culturePriority,
    p_food_priority:       slots.foodPriority,
    p_cafe_priority:       slots.cafePriority,
    p_shopping_priority:   slots.shoppingPriority,
    p_limit:               limit,
  };

  let { data, error } = await supabase.rpc(
    'get_poi_candidates',
    paramsWithRain as never,
  );

  if (error) {
    const msg = error.message ?? '';
    const maybePreMigration =
      /rain_aware|p_rain_aware|does not exist|42883|Could not find the function/i.test(msg);
    if (maybePreMigration) {
      const { p_rain_aware: _drop, ...legacyParams } = paramsWithRain;
      const retry = await supabase.rpc('get_poi_candidates', legacyParams as never);
      data = retry.data;
      error = retry.error;
    }
  }

  if (error) {
    throw new Error(`[reco/get-poi-candidates] get_poi_candidates failed: ${error.message}`);
  }

  return (data ?? []) as LeanPoiCandidate[];
}
