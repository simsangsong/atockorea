/**
 * Bounded travel resolution for deterministic route assembly (cache → live → stale → estimate).
 * Wraps `travel-time.ts` — does not call Kakao directly.
 */
import type { JejuPoiRow } from '@/lib/itinerary/types';
import { travelMinutesBetweenRows } from '@/lib/itinerary/travel-between-stops';
import {
  getTravelMinutesBetweenPois,
  getTravelMinutesFromCoordsToPoi,
  getTravelMinutesFromPoiToCoords,
  type TravelResolutionSource,
} from '@/lib/itinerary/reco/travel-time';
import { isTravelEdgeStale, resolveTravelTimeBucket, type TravelTimeBucket } from '@/lib/travel-time/time-bucket';
import { parseCoord } from '@/lib/geo/haversine';
import type { RouteEndpoint } from '@/lib/itinerary/reco/planning-context';
import { normalizeEndpointForCache } from '@/lib/itinerary/reco/endpoint-cache-key';
import { getCachedEndpointTravelEdge, upsertEndpointTravelCacheRow } from '@/lib/itinerary/reco/endpoint-travel-cache';

export type RouteTravelResolution = {
  minutes: number;
  source: TravelResolutionSource;
  distanceMeters?: number | null;
  timeBucket: 0 | 1 | 2 | 3;
};

export type RouteTravelStats = {
  freshCacheHits: number;
  liveRefreshes: number;
  staleFallbacks: number;
  estimateFallbacks: number;
  regionFallbacks: number;
  legacyAssumedFallbacks: number;
  /** Persistent `endpoint_travel_cache` hits (separate from POI↔POI `travel_time_edges`). */
  endpointCacheFreshHits: number;
  endpointCacheStaleHits: number;
  endpointLiveRefreshes: number;
  endpointEstimatedFallbacks: number;
  endpointCacheWrites: number;
};

export function createEmptyRouteTravelStats(): RouteTravelStats {
  return {
    freshCacheHits: 0,
    liveRefreshes: 0,
    staleFallbacks: 0,
    estimateFallbacks: 0,
    regionFallbacks: 0,
    legacyAssumedFallbacks: 0,
    endpointCacheFreshHits: 0,
    endpointCacheStaleHits: 0,
    endpointLiveRefreshes: 0,
    endpointEstimatedFallbacks: 0,
    endpointCacheWrites: 0,
  };
}

function bucketToNumeric(bucket: TravelTimeBucket): 0 | 1 | 2 | 3 {
  if (bucket === 'am_peak') return 1;
  if (bucket === 'pm_peak') return 2;
  if (bucket === 'weekend') return 3;
  return 0;
}

function bumpStats(stats: RouteTravelStats, source: TravelResolutionSource): void {
  if (source === 'cache_fresh') stats.freshCacheHits += 1;
  else if (source === 'live') stats.liveRefreshes += 1;
  else if (source === 'cache_stale') stats.staleFallbacks += 1;
  else if (source === 'estimate') stats.estimateFallbacks += 1;
  else if (source === 'region_fallback') stats.regionFallbacks += 1;
  else if (source === 'legacy_assumed') stats.legacyAssumedFallbacks += 1;
}

/**
 * `assembleRoute` fills `REQUEST_LOCAL_EDGE_CACHE` during exploratory scoring; `computeFinalTravelStatsForDraftStops`
 * runs again with a fresh `RouteTravelStats`. Without this, memo hits return the cached resolution but skip
 * endpoint counters — fresh deterministic responses showed assemblyEndpoint* = 0 while reuse (no prior assemble) did not.
 */
function bumpEndpointStatsFromMemo(stats: RouteTravelStats, res: RouteTravelResolution): void {
  const src = res.source;
  if (src === 'cache_fresh') stats.endpointCacheFreshHits += 1;
  else if (src === 'live') stats.endpointLiveRefreshes += 1;
  else if (src === 'estimate') stats.endpointEstimatedFallbacks += 1;
  else if (src === 'cache_stale') stats.endpointCacheStaleHits += 1;
}

const REQUEST_LOCAL_EDGE_CACHE = new Map<string, RouteTravelResolution>();

function endpointPoiCacheKey(
  kind: 'to_poi' | 'from_poi',
  endpoint: RouteEndpoint,
  poi: JejuPoiRow,
  departureAt: string | null,
): string {
  const lat = endpoint.lat ?? 'x';
  const lng = endpoint.lng ?? 'x';
  const pid = String(poi.content_id ?? poi.id ?? '');
  return `${kind}:${lat},${lng}->${pid}@${departureAt ?? 'null'}`;
}

function hasEndpointCoords(endpoint: RouteEndpoint | null | undefined): endpoint is RouteEndpoint & {
  lat: number;
  lng: number;
} {
  return (
    endpoint != null &&
    typeof endpoint.lat === 'number' &&
    Number.isFinite(endpoint.lat) &&
    typeof endpoint.lng === 'number' &&
    Number.isFinite(endpoint.lng)
  );
}

function hasPoiCoords(row: JejuPoiRow | undefined): boolean {
  if (!row) return false;
  return parseCoord(row.mapx) != null && parseCoord(row.mapy) != null;
}

function approximateRegionLegMinutes(a: string, b: string): number {
  if (a === b) return 15;
  return 45;
}

export async function resolveLegMinutes(args: {
  from: JejuPoiRow | undefined;
  to: JejuPoiRow | undefined;
  departureAt?: string | null;
  stats: RouteTravelStats;
}): Promise<RouteTravelResolution> {
  const bucket = resolveTravelTimeBucket(args.departureAt ?? null);
  const timeBucket = bucketToNumeric(bucket);

  if (!args.from || !args.to) {
    bumpStats(args.stats, 'estimate');
    return {
      minutes: 25,
      source: 'estimate',
      distanceMeters: null,
      timeBucket,
    };
  }

  const fromId = Number(args.from.id);
  const toId = Number(args.to.id);
  if (!Number.isFinite(fromId) || !Number.isFinite(toId)) {
    bumpStats(args.stats, 'estimate');
    const m = travelMinutesBetweenRows(args.from, args.to);
    return { minutes: m, source: 'estimate', distanceMeters: null, timeBucket };
  }

  const r = await getTravelMinutesBetweenPois({
    fromPoiId: fromId,
    toPoiId: toId,
    fromRow: args.from,
    toRow: args.to,
    departureAt: args.departureAt ?? null,
  });

  bumpStats(args.stats, r.source);

  return {
    minutes: r.minutes,
    source: r.source,
    distanceMeters: null,
    timeBucket: bucketToNumeric(r.bucket),
  };
}

/**
 * Resolves travel minutes from one origin to a small top-N slice only (bounded Kakao).
 */
export async function resolveTopCandidateLegs(args: {
  origin: JejuPoiRow | undefined;
  candidates: JejuPoiRow[];
  departureAt?: string | null;
  maxCandidatesForLive?: number;
  stats: RouteTravelStats;
}): Promise<Map<string, RouteTravelResolution>> {
  const max = Math.max(1, Math.min(10, args.maxCandidatesForLive ?? 8));
  const slice = args.candidates.slice(0, max);
  const map = new Map<string, RouteTravelResolution>();

  for (const to of slice) {
    const key = String(to.content_id);
    const res = await resolveLegMinutes({
      from: args.origin,
      to,
      departureAt: args.departureAt,
      stats: args.stats,
    });
    map.set(key, res);
  }

  return map;
}

export async function resolveEndpointToPoiMinutes(args: {
  endpoint: RouteEndpoint | null;
  poiRow: JejuPoiRow | undefined;
  departureAt?: string | null;
  stats: RouteTravelStats;
  fallbackAssumedMinutes?: number;
}): Promise<RouteTravelResolution> {
  const dep = args.departureAt ?? null;
  const bucket = resolveTravelTimeBucket(dep);
  const timeBucket = bucketToNumeric(bucket);
  const fallbackMin = args.fallbackAssumedMinutes ?? 18;

  const poi = args.poiRow;
  if (hasEndpointCoords(args.endpoint) && poi && hasPoiCoords(poi)) {
    const key = endpointPoiCacheKey('to_poi', args.endpoint, poi, dep);
    const memo = REQUEST_LOCAL_EDGE_CACHE.get(key);
    if (memo) {
      bumpEndpointStatsFromMemo(args.stats, memo);
      return memo;
    }

    const normalizedEp = normalizeEndpointForCache(args.endpoint);
    const endpointKey = normalizedEp.endpointKey;
    const poiId = Number(poi.id);
    const poiContentId = String(poi.content_id ?? '');
    let staleFallbackMinutes: number | null = null;

    if (endpointKey != null && Number.isFinite(poiId)) {
      const row = await getCachedEndpointTravelEdge({
        endpointKey,
        poiId,
        direction: 'endpoint_to_poi',
        bucket,
      });
      if (row?.duration_minutes != null && row.duration_minutes > 0) {
        // Same freshness window as `travel_time_edges` / POI↔POI (`lib/travel-time/time-bucket.ts`).
        const freshEnough = !isTravelEdgeStale({
          lastVerifiedAt: row.last_verified_at,
          bucket,
        });
        if (freshEnough) {
          args.stats.endpointCacheFreshHits += 1;
          const out: RouteTravelResolution = {
            minutes: row.duration_minutes,
            source: 'cache_fresh',
            distanceMeters: row.distance_meters,
            timeBucket,
          };
          REQUEST_LOCAL_EDGE_CACHE.set(key, out);
          return out;
        }
        staleFallbackMinutes = row.duration_minutes;
      }
    }

    const r = await getTravelMinutesFromCoordsToPoi({
      fromLng: args.endpoint.lng,
      fromLat: args.endpoint.lat,
      fromRegion: args.endpoint.regionGroup ?? null,
      toRow: poi,
      departureAt: dep,
      staleFallbackMinutes,
    });

    // Endpoint legs: count only assemblyEndpoint* — do not bump POI↔POI assembly* counters (resolveLegMinutes).
    if (r.source === 'live') {
      args.stats.endpointLiveRefreshes += 1;
    } else if (r.source === 'estimate') {
      args.stats.endpointEstimatedFallbacks += 1;
    } else if (r.source === 'cache_stale') {
      args.stats.endpointCacheStaleHits += 1;
    }

    if (
      endpointKey != null &&
      Number.isFinite(poiId) &&
      (r.source === 'live' || r.source === 'estimate')
    ) {
      const ok = await upsertEndpointTravelCacheRow({
        endpointKey,
        endpointKind: normalizedEp.endpointKind,
        endpointRegionGroup: normalizedEp.endpointRegionGroup,
        endpointLatRounded: normalizedEp.endpointLatRounded!,
        endpointLngRounded: normalizedEp.endpointLngRounded!,
        poiId,
        poiContentId,
        direction: 'endpoint_to_poi',
        provider: r.source === 'live' ? 'kakao' : 'haversine',
        timeBucket: bucket,
        durationMinutes: r.minutes,
        distanceMeters: r.distanceMeters,
        sourceType: r.source === 'live' ? 'live' : 'estimated',
      });
      if (ok) args.stats.endpointCacheWrites += 1;
    }

    const out: RouteTravelResolution = {
      minutes: r.minutes,
      source: r.source,
      distanceMeters: r.distanceMeters ?? null,
      timeBucket: bucketToNumeric(r.bucket),
    };
    REQUEST_LOCAL_EDGE_CACHE.set(key, out);
    return out;
  }

  const eg = args.endpoint?.regionGroup != null ? String(args.endpoint.regionGroup).trim() : '';
  const pg =
    poi?.region_group != null ? String(poi.region_group).trim() : '';
  if (eg !== '' && pg !== '') {
    const minutes = approximateRegionLegMinutes(eg, pg);
    bumpStats(args.stats, 'region_fallback');
    const out: RouteTravelResolution = {
      minutes,
      source: 'region_fallback',
      distanceMeters: null,
      timeBucket,
    };
    return out;
  }

  bumpStats(args.stats, 'legacy_assumed');
  return {
    minutes: fallbackMin,
    source: 'legacy_assumed',
    distanceMeters: null,
    timeBucket,
  };
}

export async function resolvePoiToEndpointMinutes(args: {
  poiRow: JejuPoiRow | undefined;
  endpoint: RouteEndpoint | null;
  departureAt?: string | null;
  stats: RouteTravelStats;
}): Promise<RouteTravelResolution | null> {
  if (!args.endpoint) return null;

  const dep = args.departureAt ?? null;
  const bucket = resolveTravelTimeBucket(dep);
  const timeBucket = bucketToNumeric(bucket);
  const poi = args.poiRow;

  if (hasEndpointCoords(args.endpoint) && poi && hasPoiCoords(poi)) {
    const key = endpointPoiCacheKey('from_poi', args.endpoint, poi, dep);
    const memo = REQUEST_LOCAL_EDGE_CACHE.get(key);
    if (memo) {
      bumpEndpointStatsFromMemo(args.stats, memo);
      return memo;
    }

    const normalizedEp = normalizeEndpointForCache(args.endpoint);
    const endpointKey = normalizedEp.endpointKey;
    const poiId = Number(poi.id);
    const poiContentId = String(poi.content_id ?? '');
    let staleFallbackMinutes: number | null = null;

    if (endpointKey != null && Number.isFinite(poiId)) {
      const row = await getCachedEndpointTravelEdge({
        endpointKey,
        poiId,
        direction: 'poi_to_endpoint',
        bucket,
      });
      if (row?.duration_minutes != null && row.duration_minutes > 0) {
        // Same freshness window as POI↔POI edges (`isTravelEdgeStale`).
        const freshEnough = !isTravelEdgeStale({
          lastVerifiedAt: row.last_verified_at,
          bucket,
        });
        if (freshEnough) {
          args.stats.endpointCacheFreshHits += 1;
          const out: RouteTravelResolution = {
            minutes: row.duration_minutes,
            source: 'cache_fresh',
            distanceMeters: row.distance_meters,
            timeBucket,
          };
          REQUEST_LOCAL_EDGE_CACHE.set(key, out);
          return out;
        }
        staleFallbackMinutes = row.duration_minutes;
      }
    }

    const r = await getTravelMinutesFromPoiToCoords({
      fromRow: poi,
      toLng: args.endpoint.lng,
      toLat: args.endpoint.lat,
      toRegion: args.endpoint.regionGroup ?? null,
      departureAt: dep,
      staleFallbackMinutes,
    });

    if (r.source === 'live') {
      args.stats.endpointLiveRefreshes += 1;
    } else if (r.source === 'estimate') {
      args.stats.endpointEstimatedFallbacks += 1;
    } else if (r.source === 'cache_stale') {
      args.stats.endpointCacheStaleHits += 1;
    }

    if (
      endpointKey != null &&
      Number.isFinite(poiId) &&
      (r.source === 'live' || r.source === 'estimate')
    ) {
      const ok = await upsertEndpointTravelCacheRow({
        endpointKey,
        endpointKind: normalizedEp.endpointKind,
        endpointRegionGroup: normalizedEp.endpointRegionGroup,
        endpointLatRounded: normalizedEp.endpointLatRounded!,
        endpointLngRounded: normalizedEp.endpointLngRounded!,
        poiId,
        poiContentId,
        direction: 'poi_to_endpoint',
        provider: r.source === 'live' ? 'kakao' : 'haversine',
        timeBucket: bucket,
        durationMinutes: r.minutes,
        distanceMeters: r.distanceMeters,
        sourceType: r.source === 'live' ? 'live' : 'estimated',
      });
      if (ok) args.stats.endpointCacheWrites += 1;
    }

    const out: RouteTravelResolution = {
      minutes: r.minutes,
      source: r.source,
      distanceMeters: r.distanceMeters ?? null,
      timeBucket: bucketToNumeric(r.bucket),
    };
    REQUEST_LOCAL_EDGE_CACHE.set(key, out);
    return out;
  }

  const eg = args.endpoint.regionGroup != null ? String(args.endpoint.regionGroup).trim() : '';
  const pg = poi?.region_group != null ? String(poi.region_group).trim() : '';
  if (eg !== '' && pg !== '') {
    bumpStats(args.stats, 'region_fallback');
    return {
      minutes: approximateRegionLegMinutes(pg, eg),
      source: 'region_fallback',
      distanceMeters: null,
      timeBucket,
    };
  }

  return null;
}
