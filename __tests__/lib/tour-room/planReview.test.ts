/**
 * W2 — guide plan-review helpers (§G draft diff + W2.2 swap suggestions).
 */

import { markNewStops, swapSuggestions } from '@/lib/tour-room/planReview';
import type { DayPlanStop } from '@/lib/tour-room/dayPlan';

const stop = (over: Partial<DayPlanStop> & Record<string, unknown>): DayPlanStop => ({
  id: 'stop-1',
  seq: 1,
  source: 'poi',
  stop_type: 'sight',
  status: 'pending',
  ...over,
});

describe('markNewStops — §G confirm-screen diff', () => {
  const schedule = [
    { title: 'Seongsan Ilchulbong', poi_key: 'seongsan_ilchulbong' },
    { title: 'Hamdeok Beach' },
  ];

  it('flags stops absent from the served schedule', () => {
    const fresh = markNewStops(
      [
        stop({ id: 'a', poi_key: 'seongsan_ilchulbong' }),
        stop({ id: 'b', name_i18n: { en: 'Udo Island' } }),
      ],
      schedule,
    );
    expect(fresh.has('a')).toBe(false);
    expect(fresh.has('b')).toBe(true);
  });

  it('matches by title case-insensitively (free stops)', () => {
    const fresh = markNewStops([stop({ id: 'a', name_i18n: { en: 'hamdeok beach' } })], schedule);
    expect(fresh.size).toBe(0);
  });

  it('matches a poi stop against schedule titles via the humanized key', () => {
    const fresh = markNewStops(
      [stop({ id: 'a', poi_key: 'hamdeok_beach', name_i18n: null })],
      schedule,
    );
    expect(fresh.size).toBe(0);
  });

  it('handles empty schedules (everything is new)', () => {
    const fresh = markNewStops([stop({ id: 'a', name_i18n: { en: 'Anywhere' } })], []);
    expect(fresh.has('a')).toBe(true);
  });
});

describe('swapSuggestions — W2.2 same-category nearby replacements', () => {
  const pois = [
    { poi_key: 'a_museum', name_en: 'A Museum', category: 'museum', lat: 33.5, lng: 126.5 },
    { poi_key: 'b_museum', name_en: 'B Museum', category: 'museum', lat: 33.52, lng: 126.55 },
    { poi_key: 'far_museum', name_en: 'Far Museum', category: 'museum', lat: 34.9, lng: 128.0 },
    { poi_key: 'a_beach', name_en: 'A Beach', category: 'beach', lat: 33.5, lng: 126.51 },
  ];

  it('suggests same-category pois within the radius, nearest first', () => {
    const out = swapSuggestions({
      target: stop({ id: 's', poi_key: 'a_museum', lat: 33.5, lng: 126.5 }),
      pois,
    });
    expect(out.map((s) => s.poi.poi_key)).toEqual(['b_museum']);
    expect(out[0].distance_km).toBeLessThan(20);
  });

  it('excludes pois already in the plan and the target itself', () => {
    const out = swapSuggestions({
      target: stop({ id: 's', poi_key: 'a_museum', lat: 33.5, lng: 126.5 }),
      pois,
      excludePoiKeys: ['b_museum'],
    });
    expect(out).toEqual([]);
  });

  it('falls back to distance-only for google/free stops (no category)', () => {
    const out = swapSuggestions({
      target: stop({ id: 's', source: 'google', place_id: 'x', lat: 33.5, lng: 126.5 }),
      pois,
    });
    // no category constraint → both museums and the beach, nearest first
    expect(out.map((s) => s.poi.poi_key)).toEqual(['a_beach', 'b_museum', 'a_museum'].sort(
      (x, y) =>
        (out.find((s) => s.poi.poi_key === x)?.distance_km ?? 0) -
        (out.find((s) => s.poi.poi_key === y)?.distance_km ?? 0),
    ));
    expect(out).toHaveLength(3);
  });

  it('returns nothing without target coords', () => {
    expect(swapSuggestions({ target: stop({ id: 's' }), pois })).toEqual([]);
  });
});
