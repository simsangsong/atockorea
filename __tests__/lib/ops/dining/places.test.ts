/**
 * Quality filter + ranking (§5.7 R-4).
 *
 * `rankPlaces` reads no clock and no env, so every case here is a closed-form
 * assertion: the hard exclusions veto, the weights order, and the cap holds.
 */

import {
  MAX_RESULTS,
  MIN_RATING,
  MIN_REVIEWS,
  isHardExcluded,
  placeQualityScore,
  proximityBonus,
  qualityFilter,
  rankPlaces,
  walkMinutes,
  type CachedPlace,
} from '@/lib/ops/dining/places';

// Sunday 2026-07-26, 12:00 KST.
const NOW = Date.parse('2026-07-26T03:00:00Z');
const CENTER = { lat: 33.4586, lng: 126.9425 };

const openSunday = { periods: [{ open: { day: 0, hour: 11, minute: 0 }, close: { day: 0, hour: 21, minute: 0 } }] };
const closedSunday = { periods: [{ open: { day: 1, hour: 11, minute: 0 }, close: { day: 1, hour: 21, minute: 0 } }] };

let seq = 0;
function place(overrides: Partial<CachedPlace> = {}): CachedPlace {
  seq += 1;
  return {
    place_key: `kakao:${1000 + seq}`,
    cell: 'wvfq2du',
    name: `식당${seq}`,
    category_group: 'FD6',
    category_name: '음식점 > 한식',
    cuisine: '한식',
    place_url: `http://place.map.kakao.com/${1000 + seq}`,
    lat: CENTER.lat,
    lng: CENTER.lng,
    rating: 4.2,
    review_count: 100,
    tags: [],
    signature_menus: [],
    quality_score: 0,
    is_blocked: false,
    is_closed: false,
    reported_wrong_count: 0,
    distance_m: 200,
    ...overrides,
  };
}

describe('placeQualityScore / walkMinutes / proximityBonus', () => {
  it('rewards rating and sample size together', () => {
    expect(placeQualityScore({ rating: 4.5, review_count: 999 })).toBeCloseTo(4.5 * 3, 5);
    expect(placeQualityScore({ rating: 4.5, review_count: 9 })).toBeCloseTo(4.5, 5);
    // A perfect score from three reviews loses to a good score from many.
    expect(placeQualityScore({ rating: 5, review_count: 3 })).toBeLessThan(
      placeQualityScore({ rating: 4.0, review_count: 500 }),
    );
  });

  it('scores an unrated place at zero rather than throwing', () => {
    expect(placeQualityScore({ rating: null, review_count: null })).toBe(0);
  });

  it('walks at 80 m/min, rounded up, never zero', () => {
    expect(walkMinutes(80)).toBe(1);
    expect(walkMinutes(10)).toBe(1);
    expect(walkMinutes(400)).toBe(5);
    expect(walkMinutes(410)).toBe(6);
    expect(walkMinutes(null)).toBeNull();
    expect(walkMinutes(-5)).toBeNull();
  });

  it('gives full proximity credit inside 400 m, none past 800 m', () => {
    expect(proximityBonus(0)).toBe(1);
    expect(proximityBonus(400)).toBe(1);
    expect(proximityBonus(600)).toBeCloseTo(0.5, 5);
    expect(proximityBonus(800)).toBe(0);
    expect(proximityBonus(null)).toBe(0);
  });
});

describe('qualityFilter', () => {
  it('keeps only places clearing both bars', () => {
    const good = place({ rating: MIN_RATING, review_count: MIN_REVIEWS });
    const lowRating = place({ rating: 3.1, review_count: 500 });
    const fewReviews = place({ rating: 4.9, review_count: 4 });
    const result = qualityFilter([good, lowRating, fewReviews]);
    expect(result.places.map((p) => p.place_key)).toEqual([good.place_key]);
    expect(result.unrated).toBe(false);
  });

  it('drops unrated places when at least one rated candidate exists', () => {
    const rated = place({ rating: 4.4, review_count: 80 });
    const unrated = place({ rating: null, review_count: null });
    const result = qualityFilter([rated, unrated]);
    expect(result.places.map((p) => p.place_key)).toEqual([rated.place_key]);
  });

  it('🔴 K1 fallback: an all-unrated cell serves distance-ordered with the marker', () => {
    const far = place({ rating: null, review_count: null, distance_m: 700 });
    const near = place({ rating: null, review_count: null, distance_m: 120 });
    const result = qualityFilter([far, near]);
    expect(result.unrated).toBe(true);
    expect(result.places.map((p) => p.place_key)).toEqual([near.place_key, far.place_key]);
    expect(result.places.every((p) => p.unrated === true)).toBe(true);
  });

  it('is empty-safe', () => {
    expect(qualityFilter([])).toEqual({ places: [], unrated: false });
  });
});

describe('isHardExcluded', () => {
  it('vetoes blocked, closed, and 3×-reported places', () => {
    expect(isHardExcluded(place({ is_blocked: true }), [])).toBe(true);
    expect(isHardExcluded(place({ is_closed: true }), [])).toBe(true);
    expect(isHardExcluded(place({ reported_wrong_count: 3 }), [])).toBe(true);
    expect(isHardExcluded(place({ reported_wrong_count: 2 }), [])).toBe(false);
  });

  it('vetoes a dietary conflict', () => {
    expect(isHardExcluded(place({ name: '성산 흑돼지집' }), ['no_pork'])).toBe(true);
    expect(isHardExcluded(place({ name: '성산 흑돼지집' }), ['no_seafood'])).toBe(false);
  });
});

describe('rankPlaces', () => {
  it('caps at five', () => {
    const many = Array.from({ length: 9 }, () => place());
    expect(rankPlaces(many, { nowMs: NOW })).toHaveLength(MAX_RESULTS);
    expect(MAX_RESULTS).toBe(5);
  });

  it('orders by quality when everything else is equal', () => {
    const best = place({ place_key: 'kakao:best', rating: 4.8, review_count: 900 });
    const mid = place({ place_key: 'kakao:mid', rating: 4.3, review_count: 200 });
    const worst = place({ place_key: 'kakao:worst', rating: 3.6, review_count: 30 });
    const ranked = rankPlaces([worst, best, mid], { nowMs: NOW });
    expect(ranked.map((p) => p.place_key)).toEqual(['kakao:best', 'kakao:mid', 'kakao:worst']);
  });

  it('🔴 applies hard exclusions before any scoring', () => {
    const pork = place({ place_key: 'kakao:pork', name: '흑돼지 맛집', rating: 4.9, review_count: 5000 });
    const safe = place({ place_key: 'kakao:safe', name: '해장국집', rating: 3.6, review_count: 12 });
    const ranked = rankPlaces([pork, safe], { nowMs: NOW, dietary: ['no_pork'] });
    expect(ranked.map((p) => p.place_key)).toEqual(['kakao:safe']);
  });

  it('pushes a place that is closed right now below an open one', () => {
    const closed = place({ place_key: 'kakao:closed', rating: 4.6, review_count: 300, open_hours: closedSunday });
    const open = place({ place_key: 'kakao:open', rating: 4.2, review_count: 200, open_hours: openSunday });
    const ranked = rankPlaces([closed, open], { nowMs: NOW });
    expect(ranked[0].place_key).toBe('kakao:open');
    expect(ranked[0].open_today).toBe(true);
    expect(ranked[0].closes_at).toBe('21:00');
    expect(ranked[1].open_today).toBe(false);
  });

  it('does not penalise unknown hours', () => {
    const unknown = place({ place_key: 'kakao:unknown', rating: 4.4, review_count: 200, open_hours: null });
    const [ranked] = rankPlaces([unknown], { nowMs: NOW });
    expect(ranked.open_today).toBeNull();
    expect(ranked.score).toBeCloseTo(placeQualityScore(unknown) + 0.4, 5);
  });

  it('rewards a verified positive dietary tag', () => {
    const plain = place({ place_key: 'kakao:plain', rating: 4.2, review_count: 100 });
    const veg = place({ place_key: 'kakao:veg', rating: 4.2, review_count: 100, tags: ['vegan'] });
    const ranked = rankPlaces([plain, veg], { nowMs: NOW, dietary: ['vegan'] });
    expect(ranked[0].place_key).toBe('kakao:veg');
    expect(ranked[0].score - ranked[1].score).toBeCloseTo(0.6, 5);
  });

  it('folds the global feedback aggregates in', () => {
    const liked = place({ place_key: 'kakao:liked', rating: 4.0, review_count: 100 });
    const flagged = place({ place_key: 'kakao:flagged', rating: 4.0, review_count: 100 });
    const ranked = rankPlaces([flagged, liked], {
      nowMs: NOW,
      feedback: { 'kakao:liked': { visited: 2 }, 'kakao:flagged': { wrong: 1 } },
    });
    expect(ranked.map((p) => p.place_key)).toEqual(['kakao:liked', 'kakao:flagged']);
    expect(ranked[0].score - ranked[1].score).toBeCloseTo(1.6, 5);
  });

  it('backfills distance and walk minutes from the centre', () => {
    const far = place({ distance_m: null, lat: 33.4650, lng: 126.9425 });
    const [ranked] = rankPlaces([far], { nowMs: NOW, centerLat: CENTER.lat, centerLng: CENTER.lng });
    expect(ranked.distance_m).toBeGreaterThan(600);
    expect(ranked.distance_m).toBeLessThan(800);
    expect(ranked.walk_min).toBe(walkMinutes(ranked.distance_m));
  });

  it('is deterministic — same input, same order', () => {
    const rows = [place({ rating: 4.2 }), place({ rating: 4.2 }), place({ rating: 4.2 })];
    const a = rankPlaces(rows, { nowMs: NOW }).map((p) => p.place_key);
    const b = rankPlaces(rows.slice().reverse(), { nowMs: NOW }).map((p) => p.place_key);
    expect(a).toEqual(b);
  });

  it('is empty-safe', () => {
    expect(rankPlaces([], { nowMs: NOW })).toEqual([]);
  });
});
