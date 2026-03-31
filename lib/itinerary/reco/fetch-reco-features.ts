/**
 * Loads reco-layer numeric features for a set of POI ids.
 * Explicit column list — no SELECT * (Rule 8).
 */
import { createServerClient } from '@/lib/supabase';

/** Subset of poi_reco_features used for deterministic scoring. */
export type PoiRecoFeaturesRow = {
  poi_id: number;
  content_id: string;
  base_rank_score: number;
  iconic_score: number;
  hidden_gem_score: number;
  first_timer_score: number;
  revisit_score: number;
  senior_score: number;
  family_score: number;
  rain_fallback_score: number;
  indoor_score: number;
  quick_stop_score: number;
  photo_score: number;
  nature_score: number;
  culture_score: number;
  food_score: number;
  cafe_score: number;
  shopping_score: number;
  overly_touristy_score: number;
  morning_score: number;
  sunset_score: number;
};

const RECO_COLUMNS =
  'poi_id, content_id, base_rank_score, iconic_score, hidden_gem_score, first_timer_score, revisit_score, senior_score, family_score, rain_fallback_score, indoor_score, quick_stop_score, photo_score, nature_score, culture_score, food_score, cafe_score, shopping_score, overly_touristy_score, morning_score, sunset_score';

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchRecoFeaturesForPoiIds(
  poiIds: number[],
): Promise<Map<number, PoiRecoFeaturesRow>> {
  const map = new Map<number, PoiRecoFeaturesRow>();
  const uniq = [...new Set(poiIds.filter((id) => Number.isFinite(id)))];
  if (uniq.length === 0) return map;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('poi_reco_features')
    .select(RECO_COLUMNS)
    .in('poi_id', uniq);

  if (error) {
    throw new Error(`[reco/fetch-reco-features] ${error.message}`);
  }

  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    map.set(num(r.poi_id), {
      poi_id: num(r.poi_id),
      content_id: String(r.content_id ?? ''),
      base_rank_score: num(r.base_rank_score),
      iconic_score: num(r.iconic_score),
      hidden_gem_score: num(r.hidden_gem_score),
      first_timer_score: num(r.first_timer_score),
      revisit_score: num(r.revisit_score),
      senior_score: num(r.senior_score),
      family_score: num(r.family_score),
      rain_fallback_score: num(r.rain_fallback_score),
      indoor_score: num(r.indoor_score),
      quick_stop_score: num(r.quick_stop_score),
      photo_score: num(r.photo_score),
      nature_score: num(r.nature_score),
      culture_score: num(r.culture_score),
      food_score: num(r.food_score),
      cafe_score: num(r.cafe_score),
      shopping_score: num(r.shopping_score),
      overly_touristy_score: num(r.overly_touristy_score),
      morning_score: num(r.morning_score),
      sunset_score: num(r.sunset_score),
    });
  }

  return map;
}
