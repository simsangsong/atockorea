/**
 * Geohash — the cell grid the dining cache is keyed on (§5.7 R-3, spec K4).
 *
 * Why geohash at all: the cache HIT decision is "have we already collected the
 * area around this point?", and that question needs a *stable, discretized*
 * identity for "around this point". Raw coordinates never repeat (a bus parks
 * 12 m from where it parked yesterday), so a lat/lng key would miss forever.
 * A geohash7 cell is ~153 m × 153 m — small enough that two points in the same
 * cell genuinely share a walkable neighbourhood, big enough that repeat visits
 * to the same attraction land on the same key.
 *
 * Pure and client-safe: no node:*, no supabase, no fetch. The chat client
 * imports this file directly (it re-filters the cached payload when the guest
 * taps a dietary chip), which is why the io helpers live in `*.server.ts`.
 */

import { haversineM } from '@/lib/tour-room/geo';

/** Standard geohash alphabet (base32, ambiguous letters a/i/l/o removed). */
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

const BASE32_INDEX: Record<string, number> = {};
for (let i = 0; i < BASE32.length; i += 1) BASE32_INDEX[BASE32[i]] = i;

/** Cache cells are geohash7 (~153 m × 153 m at Korean latitudes). */
export const DINING_CELL_PRECISION = 7;

/**
 * Hard cap on `cellsWithinRadius`. See that function's contract: the caller
 * ALWAYS applies an exact haversine filter afterwards, so a truncated (or
 * over-inclusive) cell set can only cost a little recall, never correctness.
 */
export const MAX_CELLS = 64;

export interface GeohashBox {
  /** Cell centre. */
  lat: number;
  lng: number;
  /** Half-height in degrees (cell spans lat ± latErr). */
  latErr: number;
  /** Half-width in degrees (cell spans lng ± lngErr). */
  lngErr: number;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Wrap a longitude into [-180, 180). */
function wrapLng(lng: number): number {
  let out = lng;
  while (out < -180) out += 360;
  while (out >= 180) out -= 360;
  return out;
}

/**
 * Standard geohash encode. Interleaves longitude (even bits) and latitude
 * (odd bits), emitting one base32 character per 5 bits.
 */
export function encodeGeohash(lat: number, lng: number, precision: number = DINING_CELL_PRECISION): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  const steps = Math.max(1, Math.min(12, Math.floor(precision)));

  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  const safeLat = clamp(lat, -90, 90);
  const safeLng = wrapLng(lng);

  let hash = '';
  let bit = 0;
  let charIndex = 0;
  let even = true; // longitude first

  while (hash.length < steps) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (safeLng >= mid) {
        charIndex = charIndex * 2 + 1;
        lngMin = mid;
      } else {
        charIndex *= 2;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (safeLat >= mid) {
        charIndex = charIndex * 2 + 1;
        latMin = mid;
      } else {
        charIndex *= 2;
        latMax = mid;
      }
    }
    even = !even;

    bit += 1;
    if (bit === 5) {
      hash += BASE32[charIndex];
      bit = 0;
      charIndex = 0;
    }
  }

  return hash;
}

/**
 * Decode a cell to its centre plus the half-extent on each axis. The bounding
 * box is [lat − latErr, lat + latErr] × [lng − lngErr, lng + lngErr], so a
 * round trip `encodeGeohash(decodeGeohash(c).lat, …)` returns `c` exactly.
 * Invalid characters are ignored (an all-invalid string decodes to the whole
 * world, which callers treat as "no useful cell").
 */
export function decodeGeohash(cell: string): GeohashBox {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let even = true;

  for (const char of String(cell ?? '').toLowerCase()) {
    const idx = BASE32_INDEX[char];
    if (idx === undefined) continue;
    for (let mask = 16; mask >= 1; mask >>= 1) {
      const on = (idx & mask) !== 0;
      if (even) {
        const mid = (lngMin + lngMax) / 2;
        if (on) lngMin = mid;
        else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (on) latMin = mid;
        else latMax = mid;
      }
      even = !even;
    }
  }

  return {
    lat: (latMin + latMax) / 2,
    lng: (lngMin + lngMax) / 2,
    latErr: (latMax - latMin) / 2,
    lngErr: (lngMax - lngMin) / 2,
  };
}

/**
 * The 8 surrounding cells (N, NE, E, SE, S, SW, W, NW).
 *
 * Implemented by stepping one full cell (2 × err) from the centre and
 * re-encoding, rather than the classic border/neighbour lookup tables — same
 * result, far less code to get subtly wrong. Cells that fall off the poles are
 * dropped and the centre cell is never returned.
 */
export function geohashNeighbors(cell: string): string[] {
  const precision = String(cell ?? '').length;
  if (precision === 0) return [];
  const box = decodeGeohash(cell);
  const latStep = box.latErr * 2;
  const lngStep = box.lngErr * 2;

  const out: string[] = [];
  const seen = new Set<string>([cell]);
  for (let dLat = 1; dLat >= -1; dLat -= 1) {
    for (let dLng = -1; dLng <= 1; dLng += 1) {
      if (dLat === 0 && dLng === 0) continue;
      const lat = box.lat + dLat * latStep;
      if (lat > 90 || lat < -90) continue; // past a pole — no neighbour there
      const neighbour = encodeGeohash(lat, wrapLng(box.lng + dLng * lngStep), precision);
      if (!neighbour || seen.has(neighbour)) continue;
      seen.add(neighbour);
      out.push(neighbour);
    }
  }
  return out;
}

/** Metres per degree of latitude (spherical earth — good to ~0.3 %). */
const M_PER_DEG_LAT = 111_320;

/**
 * Every cell whose bounding box intersects the circle (lat, lng, radiusM),
 * nearest first, capped at MAX_CELLS.
 *
 * 🔴 Contract: the caller ALWAYS re-filters the loaded rows with an exact
 * haversine distance against the same centre/radius (see `readCellCache`).
 * That makes this function's precision non-critical in both directions:
 *   - over-inclusive (a corner-touching cell) → the rows it contributes are
 *     dropped by the exact filter;
 *   - under-inclusive (the 64-cell cap truncating a huge radius) → we lose a
 *     few far candidates, and the far candidates are exactly the ones ranking
 *     would have dropped anyway.
 * At geohash7 a cell is ~153 m, so an 800 m radius needs ~11×11 = 121 cells
 * before the intersection test prunes the corners; the cap keeps the eventual
 * `cell in (...)` predicate small enough to stay index-friendly.
 */
export function cellsWithinRadius(
  lat: number,
  lng: number,
  radiusM: number,
  precision: number = DINING_CELL_PRECISION,
): string[] {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const radius = Number.isFinite(radiusM) ? Math.max(0, radiusM) : 0;

  const centre = encodeGeohash(lat, lng, precision);
  if (!centre) return [];
  if (radius === 0) return [centre];

  const box = decodeGeohash(centre);
  const latStep = box.latErr * 2;
  const lngStep = box.lngErr * 2;
  if (latStep <= 0 || lngStep <= 0) return [centre];

  const mPerDegLng = Math.max(1, M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  // +1 ring of slack so a circle that only clips the outer band is covered.
  let latSpan = Math.ceil(radius / M_PER_DEG_LAT / latStep) + 1;
  let lngSpan = Math.ceil(radius / mPerDegLng / lngStep) + 1;
  // Scanning guard: a huge radius at a fine precision must not build a
  // million-entry grid just to throw it away at the cap.
  const SCAN_LIMIT = 40;
  latSpan = Math.min(latSpan, SCAN_LIMIT);
  lngSpan = Math.min(lngSpan, SCAN_LIMIT);

  const from = { latitude: lat, longitude: lng };
  const hits: Array<{ cell: string; distance: number }> = [];
  const seen = new Set<string>();

  for (let i = -latSpan; i <= latSpan; i += 1) {
    const cellLat = box.lat + i * latStep;
    if (cellLat > 90 || cellLat < -90) continue;
    for (let j = -lngSpan; j <= lngSpan; j += 1) {
      const cellLng = wrapLng(box.lng + j * lngStep);
      const cell = encodeGeohash(cellLat, cellLng, precision);
      if (!cell || seen.has(cell)) continue;

      // Nearest point of the cell's bounding box to the circle centre.
      const nearLat = clamp(lat, cellLat - box.latErr, cellLat + box.latErr);
      const nearLng = clamp(lng, cellLng - box.lngErr, cellLng + box.lngErr);
      const distance = haversineM(from, { latitude: nearLat, longitude: nearLng });
      if (distance > radius) continue;

      seen.add(cell);
      hits.push({ cell, distance });
    }
  }

  if (hits.length === 0) return [centre];
  return hits
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_CELLS)
    .map((h) => h.cell);
}
