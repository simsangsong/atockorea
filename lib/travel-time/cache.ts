import { createServerClient } from '@/lib/supabase';
import { buildTravelEdgeUpsertRow } from '@/lib/travel-time/normalize';
import type { TravelTimeBucket } from '@/lib/travel-time/time-bucket';

const EDGE_COLUMNS =
  'from_poi_id,to_poi_id,from_content_id,to_content_id,provider,time_bucket,duration_minutes,distance_meters,polyline_summary,source_type,last_verified_at';

export type CachedTravelEdgeRow = {
  from_poi_id: number;
  to_poi_id: number;
  from_content_id: string;
  to_content_id: string;
  provider: string;
  time_bucket: string;
  duration_minutes: number | null;
  distance_meters: number | null;
  polyline_summary: unknown | null;
  source_type: string;
  last_verified_at: string | null;
};

/**
 * Prefer Kakao row over haversine estimate for the same leg + bucket (lex: kakao > haversine when desc).
 */
export async function getCachedTravelEdge(args: {
  fromPoiId: number;
  toPoiId: number;
  bucket: TravelTimeBucket;
}): Promise<CachedTravelEdgeRow | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('travel_time_edges')
    .select(EDGE_COLUMNS)
    .eq('from_poi_id', args.fromPoiId)
    .eq('to_poi_id', args.toPoiId)
    .eq('time_bucket', args.bucket)
    .in('provider', ['kakao', 'haversine'])
    .order('provider', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function upsertTravelEdge(
  input: Parameters<typeof buildTravelEdgeUpsertRow>[0],
): Promise<void> {
  const supabase = createServerClient();
  const payload = buildTravelEdgeUpsertRow(input);

  const { error } = await supabase.from('travel_time_edges').upsert(payload, {
    onConflict: 'from_poi_id,to_poi_id,provider,time_bucket',
  });
  if (error) throw error;
}

/**
 * Cached edges from one origin to many destinations (same bucket). Used for bounded 1→N refresh.
 */
export async function getCachedEdgesForOneOrigin(args: {
  fromPoiId: number;
  toPoiIds: number[];
  bucket: TravelTimeBucket;
}): Promise<CachedTravelEdgeRow[]> {
  if (args.toPoiIds.length === 0) return [];

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('travel_time_edges')
    .select(EDGE_COLUMNS)
    .eq('from_poi_id', args.fromPoiId)
    .eq('time_bucket', args.bucket)
    .in('to_poi_id', args.toPoiIds)
    .in('provider', ['kakao', 'haversine']);

  if (error) throw error;
  const rows = data ?? [];

  const bestByTo = new Map<number, CachedTravelEdgeRow>();
  for (const row of rows) {
    const prev = bestByTo.get(row.to_poi_id);
    if (!prev) {
      bestByTo.set(row.to_poi_id, row);
      continue;
    }
    if (row.provider === 'kakao' && prev.provider !== 'kakao') {
      bestByTo.set(row.to_poi_id, row);
    }
  }
  return [...bestByTo.values()];
}
