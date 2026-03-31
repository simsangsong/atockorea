/**
 * Stable endpoint cache keys: rounded coordinates drive identity (label excluded).
 * Kind / region are stored on cache rows for debugging, not for key equality.
 */
import type { RouteEndpoint } from '@/lib/itinerary/reco/planning-context';

/** ~11m grid — balances same-hotel geocoder jitter vs false collisions (Step 11). */
const COORD_DECIMALS = 4;

function normalizeKind(value: unknown): string {
  if (typeof value === 'string' && value.trim() !== '') return value.trim().toLowerCase();
  return 'unknown';
}

function normalizeRegion(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim().toLowerCase();
  return t !== '' ? t : null;
}

export type NormalizedEndpointCacheKey = {
  /** Null when `hasExactCoords` is false — never persist exact rows in that case. */
  endpointKey: string | null;
  endpointKind: string;
  endpointRegionGroup: string | null;
  endpointLatRounded: number | null;
  endpointLngRounded: number | null;
  hasExactCoords: boolean;
};

/**
 * Canonical view for endpoint cache: key + rounded coords + flags.
 * Does not use label text for `endpointKey`.
 */
export function normalizeEndpointForCache(endpoint: RouteEndpoint | null | undefined): NormalizedEndpointCacheKey {
  const endpointKind = normalizeKind(endpoint?.kind);
  const endpointRegionGroup = normalizeRegion(endpoint?.regionGroup);
  if (!hasEndpointCoordsForCache(endpoint)) {
    return {
      endpointKey: null,
      endpointKind,
      endpointRegionGroup,
      endpointLatRounded: null,
      endpointLngRounded: null,
      hasExactCoords: false,
    };
  }
  const endpointLatRounded = roundCoordForEndpointCache(endpoint.lat);
  const endpointLngRounded = roundCoordForEndpointCache(endpoint.lng);
  const endpointKey = buildEndpointSpatialKey(endpoint);
  return {
    endpointKey,
    endpointKind,
    endpointRegionGroup,
    endpointLatRounded,
    endpointLngRounded,
    hasExactCoords: true,
  };
}

export function roundCoordForEndpointCache(value: number): number {
  const f = 10 ** COORD_DECIMALS;
  return Math.round(value * f) / f;
}

export function hasEndpointCoordsForCache(
  endpoint: RouteEndpoint | null | undefined,
): endpoint is RouteEndpoint & { lat: number; lng: number } {
  return (
    endpoint != null &&
    typeof endpoint.lat === 'number' &&
    Number.isFinite(endpoint.lat) &&
    typeof endpoint.lng === 'number' &&
    Number.isFinite(endpoint.lng)
  );
}

/**
 * Returns null when coordinates are absent — callers must not persist exact cache rows in that case.
 * Key is coordinate-only so hotel vs custom / label changes still match the same bucket.
 */
export function buildEndpointSpatialKey(endpoint: RouteEndpoint | null | undefined): string | null {
  if (!hasEndpointCoordsForCache(endpoint)) return null;
  const lat = roundCoordForEndpointCache(endpoint.lat);
  const lng = roundCoordForEndpointCache(endpoint.lng);
  return `v1|${lat}|${lng}`;
}
