import type { SupabaseClient } from '@supabase/supabase-js';
import type { ItineraryUserInput } from './types';
import type { JejuPoiRow } from './types';

const DEFAULT_LIMIT = 55;

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Minimal POI projection for Gemini / Claude prompts (token-efficient).
 * Example (one object):
 * contentId, title, region_group, base_score, manual_priority, manual_boost_score, recommended_duration_min,
 * is_indoor, is_outdoor, is_free, is_paid, use_time_text, fee_text,
 * admin_short_desc_ko, admin_note_ko, overview, tags,
 * travel_value_score, photo_score, senior_score, family_score, couple_score, rainy_day_score, route_efficiency_score,
 * plus contentTypeId for echoing into the draft JSON.
 */
export type CandidatePoiPromptSlice = {
  contentId: string;
  contentTypeId: number;
  title: string | null;
  region_group: string | null;
  base_score: unknown;
  manual_priority: unknown;
  /** Additive generation ranking push (after manual_priority in candidate sort). */
  manual_boost_score: unknown;
  recommended_duration_min: number | null;
  is_indoor: boolean | null;
  is_outdoor: boolean | null;
  is_free: boolean | null;
  is_paid: boolean | null;
  use_time_text: string | null;
  fee_text: string | null;
  admin_short_desc_ko: string | null;
  admin_note_ko: string | null;
  overview: string;
  tags: string[];
  travel_value_score: unknown;
  photo_score: unknown;
  senior_score: unknown;
  family_score: unknown;
  couple_score: unknown;
  rainy_day_score: unknown;
  route_efficiency_score: unknown;
};

/**
 * Fetch POI candidates from jeju_kor_tourapi_places (source of truth).
 * Excludes manual_hidden; sorts for generation as:
 * - `manual_priority` — operator ordering / primary rank (unchanged semantics)
 * - `manual_boost_score` — additive push among ties (does not replace priority)
 * - then base_score, data quality, title
 */
export async function fetchJejuPoiCandidates(
  supabase: SupabaseClient<any, any, any>,
  input: ItineraryUserInput,
  limit = DEFAULT_LIMIT,
): Promise<JejuPoiRow[]> {
  let q = supabase
    .from('jeju_kor_tourapi_places')
    .select('*')
    .or('manual_hidden.eq.false,manual_hidden.is.null')
    .limit(Math.min(120, Math.max(20, limit)));

  const rg = input.destination?.toLowerCase().includes('jeju')
    ? undefined
    : undefined;

  void rg;

  const { data, error } = await q;
  if (error) {
    throw new Error(`candidate query: ${error.message}`);
  }
  const rows = (data ?? []) as JejuPoiRow[];

  let filtered = rows;

  if (input.indoorOutdoor === 'indoor') {
    filtered = filtered.filter((r) => r.is_indoor === true || r.is_indoor == null);
  } else if (input.indoorOutdoor === 'outdoor') {
    filtered = filtered.filter((r) => r.is_outdoor === true || r.is_outdoor == null);
  }

  if (input.rainyDay) {
    filtered = filtered.filter(
      (r) => r.is_indoor === true || r.rainy_day_score == null || num(r.rainy_day_score) >= 0,
    );
  }

  filtered.sort((a, b) => {
    const pri = num(b.manual_priority) - num(a.manual_priority);
    if (pri !== 0) return pri;
    const boost = num(b.manual_boost_score) - num(a.manual_boost_score);
    if (boost !== 0) return boost;
    const bs = num(b.base_score) - num(a.base_score);
    if (bs !== 0) return bs;
    const dq = num(b.data_quality_score) - num(a.data_quality_score);
    if (dq !== 0) return dq;
    return (a.title || '').localeCompare(b.title || '');
  });

  return filtered.slice(0, limit);
}

export function candidatesToPromptSlice(rows: JejuPoiRow[]): string {
  const slice: CandidatePoiPromptSlice[] = rows.map((r) => ({
    contentId: String(r.content_id),
    contentTypeId: r.content_type_id ?? 12,
    title: r.title,
    region_group: r.region_group,
    base_score: r.base_score,
    manual_priority: r.manual_priority,
    manual_boost_score: r.manual_boost_score,
    recommended_duration_min: r.recommended_duration_min,
    is_indoor: r.is_indoor,
    is_outdoor: r.is_outdoor,
    is_free: r.is_free,
    is_paid: r.is_paid,
    use_time_text: r.use_time_text,
    fee_text: r.fee_text,
    admin_short_desc_ko: r.admin_short_desc_ko,
    admin_note_ko: r.admin_note_ko,
    overview: (r.overview || '').slice(0, 400),
    tags: r.admin_tags ?? [],
    travel_value_score: r.travel_value_score ?? null,
    photo_score: r.photo_score ?? null,
    senior_score: r.senior_score,
    family_score: r.family_score,
    couple_score: r.couple_score,
    rainy_day_score: r.rainy_day_score,
    route_efficiency_score: r.route_efficiency_score ?? null,
  }));
  return JSON.stringify(slice);
}
