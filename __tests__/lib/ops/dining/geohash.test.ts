/**
 * Geohash — the cache's cell identity (§5.7 R-3).
 *
 * The reference vector is the canonical Wikipedia example (57.64911, 10.40744
 * → u4pruydqqvj); everything else is a property test, because the contract that
 * matters is "the same point always lands in the same cell and the cell set
 * covers the circle", not any particular string.
 */

import {
  DINING_CELL_PRECISION,
  MAX_CELLS,
  cellsWithinRadius,
  decodeGeohash,
  encodeGeohash,
  geohashNeighbors,
} from '@/lib/ops/dining/geohash';
import { haversineM } from '@/lib/tour-room/geo';

// Seongsan Ilchulbong — the POI whose r=500 sweep returned 0 docs (spec K5).
const SEONGSAN = { lat: 33.4586, lng: 126.9425 };

describe('encodeGeohash', () => {
  it('matches the canonical reference vector', () => {
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe('u4pruydqqvj');
  });

  it('produces a stable cell of the requested precision', () => {
    const cell = encodeGeohash(SEONGSAN.lat, SEONGSAN.lng, 7);
    expect(cell).toHaveLength(7);
    expect(encodeGeohash(SEONGSAN.lat, SEONGSAN.lng, 7)).toBe(cell);
    // Prefixes are the coarser cells of the same point.
    expect(encodeGeohash(SEONGSAN.lat, SEONGSAN.lng, 5)).toBe(cell.slice(0, 5));
  });

  it('defaults to the dining precision', () => {
    expect(encodeGeohash(SEONGSAN.lat, SEONGSAN.lng)).toHaveLength(DINING_CELL_PRECISION);
  });

  it('returns empty for non-finite input', () => {
    expect(encodeGeohash(Number.NaN, 126.9)).toBe('');
    expect(encodeGeohash(33.4, Number.POSITIVE_INFINITY)).toBe('');
  });
});

describe('decodeGeohash', () => {
  it('round-trips: the decoded centre re-encodes to the same cell', () => {
    for (const point of [SEONGSAN, { lat: 37.5665, lng: 126.978 }, { lat: 35.1796, lng: 129.0756 }]) {
      const cell = encodeGeohash(point.lat, point.lng, 7);
      const box = decodeGeohash(cell);
      expect(encodeGeohash(box.lat, box.lng, 7)).toBe(cell);
      // The original point lies inside the decoded bounding box.
      expect(Math.abs(box.lat - point.lat)).toBeLessThanOrEqual(box.latErr);
      expect(Math.abs(box.lng - point.lng)).toBeLessThanOrEqual(box.lngErr);
    }
  });

  it('gives a ~153 m cell at geohash7', () => {
    const box = decodeGeohash(encodeGeohash(SEONGSAN.lat, SEONGSAN.lng, 7));
    const heightM = haversineM(
      { latitude: box.lat - box.latErr, longitude: box.lng },
      { latitude: box.lat + box.latErr, longitude: box.lng },
    );
    expect(heightM).toBeGreaterThan(140);
    expect(heightM).toBeLessThan(165);
  });

  it('ignores invalid characters instead of throwing', () => {
    expect(() => decodeGeohash('!!!')).not.toThrow();
    expect(decodeGeohash('').latErr).toBe(90);
  });
});

describe('geohashNeighbors', () => {
  it('returns exactly the 8 surrounding cells, never the cell itself', () => {
    const cell = encodeGeohash(SEONGSAN.lat, SEONGSAN.lng, 7);
    const neighbours = geohashNeighbors(cell);
    expect(neighbours).toHaveLength(8);
    expect(new Set(neighbours).size).toBe(8);
    expect(neighbours).not.toContain(cell);
  });

  it('neighbours are mutual', () => {
    const cell = encodeGeohash(SEONGSAN.lat, SEONGSAN.lng, 7);
    for (const neighbour of geohashNeighbors(cell)) {
      expect(geohashNeighbors(neighbour)).toContain(cell);
    }
  });

  it('is empty for an empty cell', () => {
    expect(geohashNeighbors('')).toEqual([]);
  });
});

describe('cellsWithinRadius', () => {
  it('always contains the centre cell', () => {
    const centre = encodeGeohash(SEONGSAN.lat, SEONGSAN.lng, 7);
    for (const radius of [0, 150, 800, 1500]) {
      expect(cellsWithinRadius(SEONGSAN.lat, SEONGSAN.lng, radius)).toContain(centre);
    }
  });

  it('a zero radius is just the centre cell', () => {
    expect(cellsWithinRadius(SEONGSAN.lat, SEONGSAN.lng, 0)).toEqual([
      encodeGeohash(SEONGSAN.lat, SEONGSAN.lng, 7),
    ]);
  });

  it('grows with the radius and includes the immediate neighbours at 800 m', () => {
    const small = cellsWithinRadius(SEONGSAN.lat, SEONGSAN.lng, 150);
    const large = cellsWithinRadius(SEONGSAN.lat, SEONGSAN.lng, 800);
    expect(large.length).toBeGreaterThan(small.length);
    const centre = encodeGeohash(SEONGSAN.lat, SEONGSAN.lng, 7);
    for (const neighbour of geohashNeighbors(centre)) {
      expect(large).toContain(neighbour);
    }
  });

  it('caps at MAX_CELLS and stays nearest-first', () => {
    const cells = cellsWithinRadius(SEONGSAN.lat, SEONGSAN.lng, 5000);
    expect(cells.length).toBeLessThanOrEqual(MAX_CELLS);
    // Nearest-first means the centre leads.
    expect(cells[0]).toBe(encodeGeohash(SEONGSAN.lat, SEONGSAN.lng, 7));
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('every returned cell really does intersect the circle', () => {
    const radius = 800;
    for (const cell of cellsWithinRadius(SEONGSAN.lat, SEONGSAN.lng, radius)) {
      const box = decodeGeohash(cell);
      const nearLat = Math.min(Math.max(SEONGSAN.lat, box.lat - box.latErr), box.lat + box.latErr);
      const nearLng = Math.min(Math.max(SEONGSAN.lng, box.lng - box.lngErr), box.lng + box.lngErr);
      const distance = haversineM(
        { latitude: SEONGSAN.lat, longitude: SEONGSAN.lng },
        { latitude: nearLat, longitude: nearLng },
      );
      expect(distance).toBeLessThanOrEqual(radius + 1);
    }
  });

  it('every point inside the circle falls in one of the returned cells', () => {
    // The safety property: the cell set must not lose candidates the exact
    // haversine filter would have kept.
    const radius = 600;
    const cells = new Set(cellsWithinRadius(SEONGSAN.lat, SEONGSAN.lng, radius));
    const degLat = radius / 111_320;
    const degLng = radius / (111_320 * Math.cos((SEONGSAN.lat * Math.PI) / 180));
    for (let i = 0; i < 24; i += 1) {
      const angle = (i / 24) * 2 * Math.PI;
      // 0.9 × radius keeps the sample strictly inside the circle.
      const lat = SEONGSAN.lat + 0.9 * degLat * Math.sin(angle);
      const lng = SEONGSAN.lng + 0.9 * degLng * Math.cos(angle);
      expect(cells.has(encodeGeohash(lat, lng, 7))).toBe(true);
    }
  });

  it('is empty for non-finite input', () => {
    expect(cellsWithinRadius(Number.NaN, 126.9, 800)).toEqual([]);
  });
});
