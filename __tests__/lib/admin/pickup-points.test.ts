import { mapPickupPoints } from '@/lib/admin/pickup-points';

describe('mapPickupPoints (W3.7 / AR-3)', () => {
  it('maps valid rows and attaches the tour id', () => {
    const r = mapPickupPoints(
      [{ name: ' Hongdae ', address: 'Seoul', lat: '37.55', lng: '126.92', pickup_time: '09:00' }],
      42,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows[0]).toEqual({
        tour_id: 42,
        name: 'Hongdae',
        address: 'Seoul',
        lat: 37.55,
        lng: 126.92,
        pickup_time: '09:00',
        image_url: null,
      });
    }
  });

  it('rejects a non-array', () => {
    expect(mapPickupPoints({}, 1).ok).toBe(false);
  });

  it('rejects a row with no name (before any destructive delete)', () => {
    const r = mapPickupPoints([{ name: 'A' }, { address: 'x' }], 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/\[1\]/);
  });

  it('coerces blank/invalid coords to null and keeps 0', () => {
    const r = mapPickupPoints([{ name: 'A', lat: '', lng: 'abc' }], 1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows[0].lat).toBeNull();
      expect(r.rows[0].lng).toBeNull();
    }
    const z = mapPickupPoints([{ name: 'A', lat: 0, lng: 0 }], 1);
    if (z.ok) {
      expect(z.rows[0].lat).toBe(0);
      expect(z.rows[0].lng).toBe(0);
    }
  });

  it('maps an empty array to no rows', () => {
    const r = mapPickupPoints([], 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows).toHaveLength(0);
  });
});
