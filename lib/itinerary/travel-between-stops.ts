import { CROSS_REGION_FALLBACK_MIN } from '@/lib/geo/jeju-routing-constants';
import { distanceAndTravelBetweenCoords, parseCoord } from '@/lib/geo/haversine';
import type { JejuPoiRow } from './types';

/** Inter-stop travel minutes: Haversine + Jeju avg speed when coords exist; region heuristics otherwise. */
export function travelMinutesBetweenRows(a: JejuPoiRow | undefined, b: JejuPoiRow | undefined): number {
  if (!a || !b) return CROSS_REGION_FALLBACK_MIN;
  const lon1 = parseCoord(a.mapx);
  const lat1 = parseCoord(a.mapy);
  const lon2 = parseCoord(b.mapx);
  const lat2 = parseCoord(b.mapy);
  return distanceAndTravelBetweenCoords(lon1, lat1, lon2, lat2, a.region_group, b.region_group)
    .estimatedTravelMinutes;
}
