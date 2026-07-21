/**
 * A2 — next-stop distance + ETA ladder (measured > synthetic).
 * (docs/smart-guide-ops-detail-audit-2026-07-21.md)
 */
import {
  daypartOf,
  formatDistance,
  mergeMeasured,
  renderNextLegLine,
  syntheticLeg,
  ROAD_FACTOR,
  SYNTHETIC_KMH,
} from '@/lib/tour-room/eta';
import { estimateNextLeg } from '@/lib/tour-room/eta.server';

describe('daypartOf (KST bands, mirrors flywheel writer)', () => {
  it('classifies KST hours', () => {
    expect(daypartOf('2099-07-21T00:30:00Z')).toBe('am'); // 09:30 KST
    expect(daypartOf('2099-07-21T03:30:00Z')).toBe('midday'); // 12:30 KST
    expect(daypartOf('2099-07-21T06:30:00Z')).toBe('pm'); // 15:30 KST
    expect(daypartOf('2099-07-21T10:30:00Z')).toBe('evening'); // 19:30 KST
  });
});

describe('syntheticLeg + formatting', () => {
  const seongsan = { lat: 33.458, lng: 126.9425 };
  const udo = { lat: 33.5045, lng: 126.9523 };

  it('haversine × road factor at the synthetic speed', () => {
    const leg = syntheticLeg(seongsan, udo);
    expect(leg.source).toBe('synthetic');
    expect(leg.distanceM).toBeGreaterThan(4000);
    expect(leg.distanceM).toBeLessThan(7000);
    const expected = Math.max(1, Math.round(((leg.distanceM / 1000) * ROAD_FACTOR * 60) / SYNTHETIC_KMH));
    expect(leg.minutes).toBe(expected);
  });

  it('measured minutes replace synthetic, distance stays', () => {
    const leg = mergeMeasured(syntheticLeg(seongsan, udo), 23.4);
    expect(leg.minutes).toBe(23);
    expect(leg.source).toBe('measured');
  });

  it('invalid measured values keep the synthetic estimate', () => {
    expect(mergeMeasured(syntheticLeg(seongsan, udo), null).source).toBe('synthetic');
    expect(mergeMeasured(syntheticLeg(seongsan, udo), 0).source).toBe('synthetic');
    expect(mergeMeasured(syntheticLeg(seongsan, udo), Number.NaN).source).toBe('synthetic');
  });

  it('formats metres / decimal km / whole km', () => {
    expect(formatDistance(480)).toBe('480 m');
    expect(formatDistance(8400)).toBe('8.4 km');
    expect(formatDistance(20400)).toBe('20 km');
  });

  it('renders the localized tail line', () => {
    const args = { title: '우도', distanceM: 20400, minutes: 23 };
    expect(renderNextLegLine('ko', args)).toBe('다음 이동: 우도 — 20 km, 약 23분.');
    expect(renderNextLegLine('en', args)).toBe('Next: 우도 — 20 km, about 23 min.');
  });
});

describe('estimateNextLeg (server ladder)', () => {
  function fakeDb(opts: {
    coords?: Record<string, { lat: number; lng: number }>;
    measured?: number | null;
  }) {
    return {
      from(table: string) {
        const filters: Record<string, unknown> = {};
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: (col: string, value: unknown) => {
            filters[col] = value;
            return chain;
          },
          maybeSingle: async () => {
            if (table === 'match_pois') {
              const hit = opts.coords?.[String(filters.poi_key)];
              return { data: hit ?? null, error: null };
            }
            if (table === 'poi_travel_matrix') {
              return {
                data: opts.measured != null ? { minutes_p50: opts.measured } : null,
                error: null,
              };
            }
            return { data: null, error: null };
          },
        };
        return chain;
      },
    };
  }

  const coords = {
    a: { lat: 33.458, lng: 126.9425 },
    b: { lat: 33.5045, lng: 126.9523 },
  };

  it('prefers the measured matrix row', async () => {
    const leg = await estimateNextLeg(fakeDb({ coords, measured: 31 }), {
      fromPoiKey: 'a',
      toPoiKey: 'b',
    });
    expect(leg).not.toBeNull();
    expect(leg!.minutes).toBe(31);
    expect(leg!.source).toBe('measured');
  });

  it('falls back to synthetic when the pair is unseen', async () => {
    const leg = await estimateNextLeg(fakeDb({ coords, measured: null }), {
      fromPoiKey: 'a',
      toPoiKey: 'b',
    });
    expect(leg!.source).toBe('synthetic');
  });

  it('prefers live vehicle coords as the origin', async () => {
    const leg = await estimateNextLeg(fakeDb({ coords, measured: null }), {
      fromCoords: { lat: 33.46, lng: 126.94 },
      fromPoiKey: 'a',
      toPoiKey: 'b',
    });
    expect(leg).not.toBeNull();
  });

  it('null when the destination has no coords', async () => {
    const leg = await estimateNextLeg(fakeDb({ coords: {}, measured: 10 }), {
      fromPoiKey: 'a',
      toPoiKey: 'b',
    });
    expect(leg).toBeNull();
  });
});
