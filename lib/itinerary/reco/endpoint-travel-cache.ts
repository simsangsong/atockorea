/**
 * Persistent endpoint <-> POI travel cache. Uses service-role client only (RLS bypass).
 *
 * Resolution order in `route-travel-resolver` for coordinate endpoints:
 * 1) request-local memo → 2) this table (Kakao row preferred, then haversine) →
 * 3) Kakao live / estimate via `getTravelMinutesFromCoordsToPoi` → 4) write-through upsert when exact coords.
 * Region-only endpoints: no `endpoint_key`; do not call upsert (no false-precision rows).
 */
import { createServiceRoleClient } from '@/lib/supabase';
import type { TravelTimeBucket } from '@/lib/travel-time/time-bucket';

const ENDPOINT_CACHE_COLUMNS =
  'endpoint_key,endpoint_kind,endpoint_region_group,endpoint_lat_rounded,endpoint_lng_rounded,poi_id,poi_content_id,direction,provider,time_bucket,duration_minutes,distance_meters,source_type,last_verified_at';

export type EndpointTravelCacheRow = {
  endpoint_key: string;
  endpoint_kind: string;
  endpoint_region_group: string | null;
  endpoint_lat_rounded: number | null;
  endpoint_lng_rounded: number | null;
  poi_id: number;
  poi_content_id: string;
  direction: 'endpoint_to_poi' | 'poi_to_endpoint';
  provider: string;
  time_bucket: string;
  duration_minutes: number | null;
  distance_meters: number | null;
  source_type: string;
  last_verified_at: string | null;
};

async function fetchEndpointRowByProvider(args: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  endpointKey: string;
  poiId: number;
  direction: 'endpoint_to_poi' | 'poi_to_endpoint';
  bucket: TravelTimeBucket;
  provider: 'kakao' | 'haversine';
}): Promise<EndpointTravelCacheRow | null> {
  const { data, error } = await args.supabase
    .from('endpoint_travel_cache')
    .select(ENDPOINT_CACHE_COLUMNS)
    .eq('endpoint_key', args.endpointKey)
    .eq('poi_id', args.poiId)
    .eq('direction', args.direction)
    .eq('time_bucket', args.bucket)
    .eq('provider', args.provider)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/**
 * Prefer Kakao row, then haversine estimate — explicit priority (no string sort).
 */
export async function getCachedEndpointTravelEdge(args: {
  endpointKey: string;
  poiId: number;
  direction: 'endpoint_to_poi' | 'poi_to_endpoint';
  bucket: TravelTimeBucket;
}): Promise<EndpointTravelCacheRow | null> {
  try {
    const supabase = createServiceRoleClient();

    const kakao = await fetchEndpointRowByProvider({
      supabase,
      endpointKey: args.endpointKey,
      poiId: args.poiId,
      direction: args.direction,
      bucket: args.bucket,
      provider: 'kakao',
    });
    if (kakao) return kakao;

    const haversine = await fetchEndpointRowByProvider({
      supabase,
      endpointKey: args.endpointKey,
      poiId: args.poiId,
      direction: args.direction,
      bucket: args.bucket,
      provider: 'haversine',
    });
    return haversine ?? null;
  } catch (e) {
    console.error('[endpoint-travel-cache] read failed', e);
    return null;
  }
}

function safePoiContentId(poiContentId: string, poiId: number): string {
  const t = String(poiContentId ?? '').trim();
  return t !== '' ? t : `poi:${poiId}`;
}

export async function upsertEndpointTravelCacheRow(args: {
  endpointKey: string;
  endpointKind: string;
  endpointRegionGroup: string | null;
  endpointLatRounded: number;
  endpointLngRounded: number;
  poiId: number;
  poiContentId: string;
  direction: 'endpoint_to_poi' | 'poi_to_endpoint';
  provider: 'kakao' | 'haversine';
  timeBucket: TravelTimeBucket;
  durationMinutes: number;
  distanceMeters: number | null;
  sourceType: 'live' | 'estimated';
}): Promise<boolean> {
  try {
    const supabase = createServiceRoleClient();
    const now = new Date().toISOString();
    const poiContentIdSafe = safePoiContentId(args.poiContentId, args.poiId);
    const { error } = await supabase.from('endpoint_travel_cache').upsert(
      {
        endpoint_key: args.endpointKey,
        endpoint_kind: args.endpointKind,
        endpoint_region_group: args.endpointRegionGroup,
        endpoint_lat_rounded: args.endpointLatRounded,
        endpoint_lng_rounded: args.endpointLngRounded,
        poi_id: args.poiId,
        poi_content_id: poiContentIdSafe,
        direction: args.direction,
        provider: args.provider,
        time_bucket: args.timeBucket,
        duration_minutes: Math.round(args.durationMinutes),
        distance_meters:
          args.distanceMeters != null && Number.isFinite(args.distanceMeters)
            ? Math.round(args.distanceMeters)
            : null,
        source_type: args.sourceType,
        last_verified_at: now,
        updated_at: now,
      },
      { onConflict: 'endpoint_key,poi_id,direction,provider,time_bucket' },
    );
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('[endpoint-travel-cache] upsert failed', e);
    return false;
  }
}
