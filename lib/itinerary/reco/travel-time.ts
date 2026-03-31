/**
 * Travel-time: `public.travel_time_edges` (cache-first) + optional Kakao live + haversine estimate.
 * Parser / recovery code must not import Kakao — only this module calls the client.
 */
import { parseCoord } from '@/lib/geo/haversine';
import type { GeminiDraft, JejuPoiRow, ValidationMeta } from '@/lib/itinerary/types';
import { travelMinutesBetweenRows } from '@/lib/itinerary/travel-between-stops';
import {
  getCachedEdgesForOneOrigin,
  getCachedTravelEdge,
  upsertTravelEdge,
} from '@/lib/travel-time/cache';
import {
  getKakaoDrivingDuration,
  getKakaoFutureDrivingDuration,
  getKakaoMultiDestinationDurations,
  isKakaoMobilityLiveEnabled,
} from '@/lib/travel-time/kakao-client';
import { isTravelEdgeStale, resolveTravelTimeBucket, type TravelTimeBucket } from '@/lib/travel-time/time-bucket';

export type TravelResolutionSource =
  | 'cache_fresh'
  | 'cache_stale'
  | 'live'
  | 'estimate'
  | 'legacy_assumed'
  | 'region_fallback';

export type TravelResolutionLeg = {
  fromContentId: string;
  toContentId: string;
  source: TravelResolutionSource;
  minutes: number;
};

export type TravelTimeResolutionStats = {
  timeBucket: TravelTimeBucket;
  kakaoLiveUsed: boolean;
  freshCacheHits: number;
  staleCacheHits: number;
  liveRefreshCount: number;
  estimateFallbackCount: number;
  legs: TravelResolutionLeg[];
};

function rowToLngLat(row: JejuPoiRow | undefined): { lng: number; lat: number } | null {
  if (!row) return null;
  const lng = parseCoord(row.mapx);
  const lat = parseCoord(row.mapy);
  if (lng == null || lat == null) return null;
  return { lng, lat };
}

function estimateMinutesHaversine(from: JejuPoiRow | undefined, to: JejuPoiRow | undefined): number {
  return travelMinutesBetweenRows(from, to);
}

/**
 * Legacy export: single-leg resolution with DB cache + optional Kakao + estimate upsert.
 */
export async function getTravelMinutesBetweenPois(params: {
  fromPoiId: number;
  toPoiId: number;
  fromRow: JejuPoiRow | undefined;
  toRow: JejuPoiRow | undefined;
  departureAt?: string | null;
}): Promise<{
  minutes: number;
  source: TravelResolutionSource;
  bucket: TravelTimeBucket;
  kakaoLiveUsed: boolean;
}> {
  const bucket = resolveTravelTimeBucket(params.departureAt ?? null);
  const from = params.fromRow;
  const to = params.toRow;
  if (!from || !to) {
    return { minutes: 25, source: 'estimate', bucket, kakaoLiveUsed: false };
  }

  const res = await resolveTravelMinutesBetweenRows({
    from,
    to,
    departureAt: params.departureAt ?? null,
    allowLive: true,
  });
  return {
    minutes: res.minutes,
    source: res.source,
    bucket: res.bucket,
    kakaoLiveUsed: res.kakaoLiveUsed,
  };
}

type ResolveRowsResult = {
  minutes: number;
  source: TravelResolutionSource;
  bucket: TravelTimeBucket;
  kakaoLiveUsed: boolean;
};

async function resolveTravelMinutesBetweenRows(args: {
  from: JejuPoiRow;
  to: JejuPoiRow;
  departureAt?: string | null;
  allowLive?: boolean;
}): Promise<ResolveRowsResult> {
  const bucket = resolveTravelTimeBucket(args.departureAt ?? null);
  const fromId = Number(args.from.id);
  const toId = Number(args.to.id);
  if (!Number.isFinite(fromId) || !Number.isFinite(toId)) {
    const m = estimateMinutesHaversine(args.from, args.to);
    return { minutes: m, source: 'estimate', bucket, kakaoLiveUsed: false };
  }

  const fromContentId = String(args.from.content_id);
  const toContentId = String(args.to.content_id);

  let cached: Awaited<ReturnType<typeof getCachedTravelEdge>> = null;
  try {
    cached = await getCachedTravelEdge({
      fromPoiId: fromId,
      toPoiId: toId,
      bucket,
    });
  } catch (e) {
    console.error('[travel-time] cache read failed', e);
  }

  const cachedMinutes =
    typeof cached?.duration_minutes === 'number' && cached.duration_minutes > 0
      ? cached.duration_minutes
      : null;

  const freshEnough =
    cachedMinutes != null &&
    !isTravelEdgeStale({
      lastVerifiedAt: cached?.last_verified_at,
      bucket,
    });

  if (freshEnough) {
    return {
      minutes: cachedMinutes,
      source: 'cache_fresh',
      bucket,
      kakaoLiveUsed: false,
    };
  }

  const staleMinutes = cachedMinutes;

  const origin = rowToLngLat(args.from);
  const dest = rowToLngLat(args.to);

  const liveAllowed =
    args.allowLive !== false && isKakaoMobilityLiveEnabled() && origin && dest;

  if (liveAllowed) {
    try {
      const useFuture =
        typeof args.departureAt === 'string' &&
        args.departureAt.trim().length > 0 &&
        !Number.isNaN(Date.parse(args.departureAt));

      const live = useFuture
        ? await getKakaoFutureDrivingDuration({
            origin,
            destination: dest,
            departureAt: args.departureAt as string,
          })
        : await getKakaoDrivingDuration({ origin, destination: dest });

      try {
        await upsertTravelEdge({
          fromPoiId: fromId,
          toPoiId: toId,
          fromContentId,
          toContentId,
          provider: 'kakao',
          timeBucket: bucket,
          durationMinutes: live.durationMinutes,
          distanceMeters: live.distanceMeters,
          polylineSummary: live.rawSummary,
          sourceType: 'live',
        });
      } catch (upErr) {
        console.error('[travel-time] kakao upsert failed', upErr);
      }

      return {
        minutes: live.durationMinutes,
        source: 'live',
        bucket,
        kakaoLiveUsed: true,
      };
    } catch (e) {
      console.error('[travel-time] Kakao live failed', {
        bucket,
        from: fromContentId,
        to: toContentId,
        error: e instanceof Error ? e.message : e,
      });

      if (staleMinutes != null) {
        return {
          minutes: staleMinutes,
          source: 'cache_stale',
          bucket,
          kakaoLiveUsed: false,
        };
      }
    }
  }

  const estimated = estimateMinutesHaversine(args.from, args.to);
  try {
    await upsertTravelEdge({
      fromPoiId: fromId,
      toPoiId: toId,
      fromContentId,
      toContentId,
      provider: 'haversine',
      timeBucket: bucket,
      durationMinutes: estimated,
      distanceMeters: null,
      polylineSummary: null,
      sourceType: 'estimated',
    });
  } catch (e) {
    console.error('[travel-time] estimate upsert failed', e);
  }

  return {
    minutes: estimated,
    source: 'estimate',
    bucket,
    kakaoLiveUsed: false,
  };
}

/**
 * Ad-hoc origin coordinates → POI (no `travel_time_edges` row; no upsert).
 * Kakao live when enabled, else haversine/Jeju estimate via `travelMinutesBetweenRows`.
 */
export async function getTravelMinutesFromCoordsToPoi(params: {
  fromLng: number;
  fromLat: number;
  fromRegion?: string | null;
  toRow: JejuPoiRow;
  departureAt?: string | null;
  /** When Kakao fails and this is set, return stale cached minutes (aligned with POI↔POI). */
  staleFallbackMinutes?: number | null;
}): Promise<{
  minutes: number;
  source: TravelResolutionSource;
  bucket: TravelTimeBucket;
  kakaoLiveUsed: boolean;
  distanceMeters: number | null;
}> {
  const bucket = resolveTravelTimeBucket(params.departureAt ?? null);
  const dest = rowToLngLat(params.toRow);
  const origin = { lng: params.fromLng, lat: params.fromLat };

  if (!dest) {
    return { minutes: 25, source: 'estimate', bucket, kakaoLiveUsed: false, distanceMeters: null };
  }

  const liveAllowed = isKakaoMobilityLiveEnabled();

  if (liveAllowed) {
    try {
      const useFuture =
        typeof params.departureAt === 'string' &&
        params.departureAt.trim().length > 0 &&
        !Number.isNaN(Date.parse(params.departureAt));

      const live = useFuture
        ? await getKakaoFutureDrivingDuration({
            origin,
            destination: dest,
            departureAt: params.departureAt as string,
          })
        : await getKakaoDrivingDuration({ origin, destination: dest });

      return {
        minutes: live.durationMinutes,
        source: 'live',
        bucket,
        kakaoLiveUsed: true,
        distanceMeters: live.distanceMeters,
      };
    } catch (e) {
      console.error('[travel-time] coord->poi Kakao failed', {
        error: e instanceof Error ? e.message : e,
      });
      const stale =
        typeof params.staleFallbackMinutes === 'number' &&
        Number.isFinite(params.staleFallbackMinutes) &&
        params.staleFallbackMinutes > 0
          ? params.staleFallbackMinutes
          : null;
      if (stale != null) {
        return {
          minutes: stale,
          source: 'cache_stale',
          bucket,
          kakaoLiveUsed: false,
          distanceMeters: null,
        };
      }
    }
  }

  const syntheticFrom = {
    mapx: params.fromLng,
    mapy: params.fromLat,
    region_group: params.fromRegion ?? null,
  } as JejuPoiRow;

  const est = travelMinutesBetweenRows(syntheticFrom, params.toRow);
  return { minutes: est, source: 'estimate', bucket, kakaoLiveUsed: false, distanceMeters: null };
}

/** POI → ad-hoc destination coordinates (no edge cache row; no upsert). */
export async function getTravelMinutesFromPoiToCoords(params: {
  fromRow: JejuPoiRow;
  toLng: number;
  toLat: number;
  toRegion?: string | null;
  departureAt?: string | null;
  staleFallbackMinutes?: number | null;
}): Promise<{
  minutes: number;
  source: TravelResolutionSource;
  bucket: TravelTimeBucket;
  kakaoLiveUsed: boolean;
  distanceMeters: number | null;
}> {
  const bucket = resolveTravelTimeBucket(params.departureAt ?? null);
  const origin = rowToLngLat(params.fromRow);
  const destination = { lng: params.toLng, lat: params.toLat };

  if (!origin) {
    return { minutes: 25, source: 'estimate', bucket, kakaoLiveUsed: false, distanceMeters: null };
  }

  const liveAllowed = isKakaoMobilityLiveEnabled();

  if (liveAllowed) {
    try {
      const useFuture =
        typeof params.departureAt === 'string' &&
        params.departureAt.trim().length > 0 &&
        !Number.isNaN(Date.parse(params.departureAt));

      const live = useFuture
        ? await getKakaoFutureDrivingDuration({
            origin,
            destination,
            departureAt: params.departureAt as string,
          })
        : await getKakaoDrivingDuration({ origin, destination });

      return {
        minutes: live.durationMinutes,
        source: 'live',
        bucket,
        kakaoLiveUsed: true,
        distanceMeters: live.distanceMeters,
      };
    } catch (e) {
      console.error('[travel-time] poi->coord Kakao failed', {
        error: e instanceof Error ? e.message : e,
      });
      const stale =
        typeof params.staleFallbackMinutes === 'number' &&
        Number.isFinite(params.staleFallbackMinutes) &&
        params.staleFallbackMinutes > 0
          ? params.staleFallbackMinutes
          : null;
      if (stale != null) {
        return {
          minutes: stale,
          source: 'cache_stale',
          bucket,
          kakaoLiveUsed: false,
          distanceMeters: null,
        };
      }
    }
  }

  const syntheticTo = {
    mapx: params.toLng,
    mapy: params.toLat,
    region_group: params.toRegion ?? null,
  } as JejuPoiRow;

  const est = travelMinutesBetweenRows(params.fromRow, syntheticTo);
  return { minutes: est, source: 'estimate', bucket, kakaoLiveUsed: false, distanceMeters: null };
}

/**
 * Recomputes travel-related fields on validation meta using cache / Kakao / estimate.
 * Feasibility repairs stay on haversine; this only adjusts reported metrics post-validation.
 */
export async function enrichValidationMetaWithTravelTimeResolution(args: {
  meta: ValidationMeta;
  stops: GeminiDraft['stops'];
  byId: Map<string, JejuPoiRow>;
  departureAt?: string | null;
}): Promise<{ meta: ValidationMeta; stats: TravelTimeResolutionStats }> {
  const sorted = [...args.stops].sort((a, b) => a.sortOrder - b.sortOrder);
  const bucket = resolveTravelTimeBucket(args.departureAt ?? null);

  const stats: TravelTimeResolutionStats = {
    timeBucket: bucket,
    kakaoLiveUsed: false,
    freshCacheHits: 0,
    staleCacheHits: 0,
    liveRefreshCount: 0,
    estimateFallbackCount: 0,
    legs: [],
  };

  if (sorted.length < 2) {
    return { meta: args.meta, stats };
  }

  let totalTravel = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    const fromRow = args.byId.get(sorted[i].contentId);
    const toRow = args.byId.get(sorted[i + 1].contentId);
    if (!fromRow || !toRow) {
      const fallback = estimateMinutesHaversine(fromRow, toRow);
      totalTravel += fallback;
      stats.estimateFallbackCount += 1;
      stats.legs.push({
        fromContentId: sorted[i].contentId,
        toContentId: sorted[i + 1].contentId,
        source: 'estimate',
        minutes: fallback,
      });
      continue;
    }

    const r = await resolveTravelMinutesBetweenRows({
      from: fromRow,
      to: toRow,
      departureAt: args.departureAt ?? null,
      allowLive: true,
    });

    totalTravel += r.minutes;

    if (r.source === 'cache_fresh') stats.freshCacheHits += 1;
    else if (r.source === 'cache_stale') stats.staleCacheHits += 1;
    else if (r.source === 'live') {
      stats.liveRefreshCount += 1;
      stats.kakaoLiveUsed = true;
    } else stats.estimateFallbackCount += 1;

    stats.legs.push({
      fromContentId: sorted[i].contentId,
      toContentId: sorted[i + 1].contentId,
      source: r.source,
      minutes: r.minutes,
    });
  }

  const visitMin = args.meta.estimatedTotalVisitMinutes;
  const totalDay = totalTravel + visitMin;
  const totalEstimatedMin = totalDay;

  return {
    meta: {
      ...args.meta,
      estimatedTotalTravelMinutes: totalTravel,
      estimatedTotalDayMinutes: totalDay,
      totalEstimatedMin,
      travelTimeResolution: {
        timeBucket: stats.timeBucket,
        kakaoLiveUsed: stats.kakaoLiveUsed,
        freshCacheHits: stats.freshCacheHits,
        staleCacheHits: stats.staleCacheHits,
        liveRefreshCount: stats.liveRefreshCount,
        estimateFallbackCount: stats.estimateFallbackCount,
      },
    },
    stats,
  };
}

type PoiLike = {
  poi_id?: number | null;
  id?: number | null;
  content_id?: string | null;
  mapx?: number | string | null;
  mapy?: number | string | null;
};

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function getLngLat(row: PoiLike): { lng: number; lat: number } | null {
  const lng = parseCoord(row.mapx);
  const lat = parseCoord(row.mapy);
  if (lng == null || lat == null) return null;
  return { lng, lat };
}

function getPoiId(row: PoiLike): number | null {
  const n = toNumber(row.poi_id ?? row.id);
  return n != null && Number.isFinite(n) ? n : null;
}

/**
 * Bounded 1→N Kakao lookup for small batches (e.g. comparing several POIs from one origin).
 * Falls back per destination to estimate when live/cache unavailable.
 */
export async function travelMinutesFromOneToMany(args: {
  from: PoiLike;
  destinations: PoiLike[];
  departureAt?: string | null;
  allowLive?: boolean;
}): Promise<{
  bucket: TravelTimeBucket;
  kakaoLiveUsed: boolean;
  minutesByKey: Record<string, number>;
}> {
  const bucket = resolveTravelTimeBucket(args.departureAt ?? null);
  const result: Record<string, number> = {};
  const misses: PoiLike[] = [];

  const fromPid = getPoiId(args.from);
  const destPoiIds = args.destinations
    .map((d) => getPoiId(d))
    .filter((v): v is number => v != null);

  if (fromPid == null || destPoiIds.length === 0) {
    return { bucket, kakaoLiveUsed: false, minutesByKey: {} };
  }

  let cachedRows: Awaited<ReturnType<typeof getCachedEdgesForOneOrigin>> = [];
  try {
    cachedRows = await getCachedEdgesForOneOrigin({
      fromPoiId: fromPid,
      toPoiIds: destPoiIds,
      bucket,
    });
  } catch (e) {
    console.error('[travel-time] batch cache read failed', e);
  }

  const cacheByTo = new Map(cachedRows.map((r) => [r.to_poi_id, r]));

  for (const dest of args.destinations) {
    const pid = getPoiId(dest);
    const key = dest.content_id ? String(dest.content_id) : pid != null ? `poi:${pid}` : '';
    if (!key || pid == null) continue;

    const cached = cacheByTo.get(pid);
    const dm =
      typeof cached?.duration_minutes === 'number' && cached.duration_minutes > 0
        ? cached.duration_minutes
        : null;

    const fresh =
      dm != null &&
      !isTravelEdgeStale({
        lastVerifiedAt: cached?.last_verified_at,
        bucket,
      });

    if (fresh) {
      result[key] = dm;
    } else {
      misses.push(dest);
    }
  }

  const origin = getLngLat(args.from);
  let liveUsed = false;

  if (
    args.allowLive !== false &&
    isKakaoMobilityLiveEnabled() &&
    origin &&
    misses.length > 0 &&
    misses.length <= 10
  ) {
    try {
      const mapped = misses
        .map((d) => {
          const point = getLngLat(d);
          const id = getPoiId(d);
          const key = d.content_id ? String(d.content_id) : id != null ? `poi:${id}` : '';
          if (!point || !key) return null;
          return { key, point, dest: d };
        })
        .filter((v): v is { key: string; point: { lng: number; lat: number }; dest: PoiLike } =>
          Boolean(v),
        );

      const liveMap = await getKakaoMultiDestinationDurations({
        origin,
        destinations: mapped.map((m) => ({ key: m.key, point: m.point })),
      });

      for (const m of mapped) {
        const hit = liveMap[m.key];
        if (!hit) continue;
        result[m.key] = hit.durationMinutes;
        liveUsed = true;

        const toPid = getPoiId(m.dest);
        const toCid = m.dest.content_id ? String(m.dest.content_id) : '';
        if (toPid != null && toCid && fromPid != null) {
          try {
            await upsertTravelEdge({
              fromPoiId: fromPid,
              toPoiId: toPid,
              fromContentId: String(args.from.content_id ?? ''),
              toContentId: toCid,
              provider: 'kakao',
              timeBucket: bucket,
              durationMinutes: hit.durationMinutes,
              distanceMeters: hit.distanceMeters,
              polylineSummary: hit.rawSummary,
              sourceType: 'live',
            });
          } catch (e) {
            console.error('[travel-time] multi kakao upsert failed', e);
          }
        }
      }
    } catch (e) {
      console.error('[travel-time] multi-destination Kakao live failed', e);
    }
  }

  for (const dest of misses) {
    const key = dest.content_id
      ? String(dest.content_id)
      : (() => {
          const id = getPoiId(dest);
          return id != null ? `poi:${id}` : '';
        })();
    if (!key || result[key] != null) continue;
    const est = estimateMinutesHaversine(args.from as JejuPoiRow, dest as JejuPoiRow);
    result[key] = est;
  }

  return { bucket, kakaoLiveUsed: liveUsed, minutesByKey: result };
}
