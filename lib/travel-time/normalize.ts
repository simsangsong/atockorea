import type { TravelTimeBucket } from '@/lib/travel-time/time-bucket';

/** Row shape for `public.travel_time_edges` upsert (explicit columns). */
export type TravelEdgeUpsertRow = {
  from_poi_id: number;
  to_poi_id: number;
  from_content_id: string;
  to_content_id: string;
  provider: 'kakao' | 'haversine';
  time_bucket: TravelTimeBucket;
  duration_minutes: number;
  distance_meters: number | null;
  polyline_summary: unknown | null;
  source_type: 'live' | 'estimated' | 'cached';
  last_verified_at: string;
};

export function buildTravelEdgeUpsertRow(input: {
  fromPoiId: number;
  toPoiId: number;
  fromContentId: string;
  toContentId: string;
  provider: 'kakao' | 'haversine';
  timeBucket: TravelTimeBucket;
  durationMinutes: number;
  distanceMeters?: number | null;
  polylineSummary?: unknown;
  sourceType: 'live' | 'estimated' | 'cached';
}): TravelEdgeUpsertRow {
  return {
    from_poi_id: input.fromPoiId,
    to_poi_id: input.toPoiId,
    from_content_id: input.fromContentId,
    to_content_id: input.toContentId,
    provider: input.provider,
    time_bucket: input.timeBucket,
    duration_minutes: input.durationMinutes,
    distance_meters: input.distanceMeters ?? null,
    polyline_summary: input.polylineSummary ?? null,
    source_type: input.sourceType,
    last_verified_at: new Date().toISOString(),
  };
}
