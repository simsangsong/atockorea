/**
 * Geo distance + drive-time estimates for the itinerary builder cart.
 *
 * Phase 4b uses Haversine (great-circle) × a road factor of 1.3 ×
 * a flat 50 km/h average to estimate per-leg drive minutes. Cheap, no
 * API calls. Phase 5 may upgrade to Google Distance Matrix at quote-submit
 * time (see §H R3 mitigation).
 */

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;
const ROAD_FACTOR = 1.3; // straight-line → road-distance multiplier
const AVG_SPEED_KMH = 50;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in kilometers. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Road-distance estimate in km (Haversine × ROAD_FACTOR). */
export function roadKm(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * ROAD_FACTOR;
}

/** Drive-time estimate in minutes (rounded). */
export function driveMinutes(a: LatLng, b: LatLng): number {
  const km = roadKm(a, b);
  return Math.round((km / AVG_SPEED_KMH) * 60);
}

/** Sum drive-minutes across an ordered sequence of LatLng. */
export function totalDriveMinutes(points: LatLng[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += driveMinutes(points[i - 1], points[i]);
  }
  return total;
}

/** Human-readable "Xh Ym" / "Ym" formatter. */
export function formatMinutes(min: number): string {
  if (min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
