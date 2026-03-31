import {
  CROSS_REGION_FALLBACK_MIN,
  EARTH_RADIUS_KM,
  JEJU_TOURISM_AVG_KMH,
  MAX_TRAVEL_LEG_MIN_ESTIMATE,
  MIN_TRAVEL_LEG_MIN,
  SAME_REGION_TRAVEL_MIN,
} from './jeju-routing-constants';

export function parseCoord(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Haversine distance in km (WGS84). For Jeju POIs: lon1/mapx, lat1/mapy. */
export function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export type DistanceAndTravelEstimate = {
  distanceKm: number;
  /** Driving time from distance at JEJU_TOURISM_AVG_KMH, clamped to leg min/max. */
  estimatedTravelMinutes: number;
};

/**
 * Travel minutes from straight-line km using configured average speed, then clamped.
 */
export function estimateTravelMinutesFromKm(km: number): number {
  if (!Number.isFinite(km) || km < 0) {
    return MIN_TRAVEL_LEG_MIN;
  }
  const raw = (km / JEJU_TOURISM_AVG_KMH) * 60;
  return Math.min(
    MAX_TRAVEL_LEG_MIN_ESTIMATE,
    Math.max(MIN_TRAVEL_LEG_MIN, Math.round(raw)),
  );
}

/**
 * Haversine km + estimated travel minutes (coord-based). If coords invalid, distanceKm is NaN
 * and estimatedTravelMinutes uses region heuristics (same as legacy itinerary validation).
 */
export function distanceAndTravelBetweenCoords(
  lon1: number | null,
  lat1: number | null,
  lon2: number | null,
  lat2: number | null,
  regionA: string | null | undefined,
  regionB: string | null | undefined,
): DistanceAndTravelEstimate {
  if (
    lon1 != null &&
    lat1 != null &&
    lon2 != null &&
    lat2 != null &&
    Number.isFinite(lon1) &&
    Number.isFinite(lat1) &&
    Number.isFinite(lon2) &&
    Number.isFinite(lat2)
  ) {
    const distanceKm = haversineKm(lon1, lat1, lon2, lat2);
    return {
      distanceKm,
      estimatedTravelMinutes: estimateTravelMinutesFromKm(distanceKm),
    };
  }
  const rgA = (regionA ?? '').trim();
  const rgB = (regionB ?? '').trim();
  const fallbackMin =
    rgA !== '' && rgB !== '' && rgA === rgB ? SAME_REGION_TRAVEL_MIN : CROSS_REGION_FALLBACK_MIN;
  return {
    distanceKm: NaN,
    estimatedTravelMinutes: fallbackMin,
  };
}
