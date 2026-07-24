/**
 * Meal-stop detection (§5.7 R-2).
 *
 * Over-firing is the failure that costs us the room: a restaurant list pushed
 * at a waterfall stop teaches guests to ignore the feed. So the negative cases
 * matter as much as the positive ones.
 */

import { isMealStop, mealForMinute } from '@/lib/ops/dining/mealStop';

// 2026-07-26 12:30 KST.
const NOON_MS = Date.parse('2026-07-26T03:30:00Z');

describe('signal ① stop_type', () => {
  it('trusts the planner vocabulary', () => {
    expect(isMealStop({ stop_type: 'meal', title: 'Somewhere' }, NOON_MS)).toMatchObject({
      isMeal: true,
      reason: 'stop_type',
    });
    expect(isMealStop({ stop_type: 'lunch' })).toMatchObject({ isMeal: true, meal: 'lunch', reason: 'stop_type' });
    expect(isMealStop({ stop_type: 'DINNER' })).toMatchObject({ isMeal: true, meal: 'dinner', reason: 'stop_type' });
  });

  it('resolves a generic "meal" from the stop time', () => {
    expect(isMealStop({ stop_type: 'meal', arrival_planned: '18:30' })).toMatchObject({
      isMeal: true,
      meal: 'dinner',
    });
  });

  it('ignores non-meal stop types', () => {
    expect(isMealStop({ stop_type: 'sightseeing', title: 'Seongsan' }).isMeal).toBe(false);
  });
});

describe('signal ② time window', () => {
  it('fires inside the lunch and dinner windows', () => {
    expect(isMealStop({ arrival_planned: '12:30', title: 'Seongsan' })).toMatchObject({
      isMeal: true,
      meal: 'lunch',
      reason: 'time_window',
    });
    expect(isMealStop({ time: '18:00', title: 'Seongsan' })).toMatchObject({
      isMeal: true,
      meal: 'dinner',
      reason: 'time_window',
    });
    // Boundaries are inclusive.
    expect(isMealStop({ arrival_planned: '11:00', title: 'x' }).isMeal).toBe(true);
    expect(isMealStop({ arrival_planned: '20:00', title: 'x' }).isMeal).toBe(true);
  });

  it('does not fire outside them', () => {
    expect(isMealStop({ arrival_planned: '09:00', title: 'Seongsan Ilchulbong' }).isMeal).toBe(false);
    expect(isMealStop({ arrival_planned: '15:30', title: 'Seongsan Ilchulbong' }).isMeal).toBe(false);
  });

  it('🔴 the wall clock alone never turns a sightseeing stop into a meal stop', () => {
    // It is 12:30 right now, but this stop has no time and no meal keyword.
    expect(isMealStop({ title: 'Seongsan Ilchulbong', poi_key: 'seongsan_ilchulbong' }, NOON_MS).isMeal).toBe(false);
  });

  it('accepts an HH:MM fallback clock and tolerates junk times', () => {
    expect(isMealStop({ title: 'Somewhere' }, '12:30').isMeal).toBe(false);
    expect(isMealStop({ arrival_planned: 'noon-ish', title: 'Somewhere' }).isMeal).toBe(false);
    expect(isMealStop({ arrival_planned: '99:99', title: 'Somewhere' }).isMeal).toBe(false);
  });
});

describe('signal ③ keywords', () => {
  it('catches markets, food streets and restaurants in either language', () => {
    expect(isMealStop({ title: 'Dongmun Market', arrival_planned: '21:30' })).toMatchObject({
      isMeal: true,
      reason: 'keyword',
      meal: 'dinner',
    });
    expect(isMealStop({ title: '서귀포 매일올레시장', arrival_planned: '09:30' })).toMatchObject({
      isMeal: true,
      reason: 'keyword',
    });
    expect(isMealStop({ poi_key: 'jeju_black_pork_street', title: '흑돼지거리 맛집' }).isMeal).toBe(true);
    expect(isMealStop({ poi_key: 'gukje_market' }).isMeal).toBe(true);
  });

  it('🔴 does not fire on "seafood" — the substring trap', () => {
    expect(isMealStop({ title: 'Seafood Cliff Viewpoint', arrival_planned: '09:00' }).isMeal).toBe(false);
  });

  it('does not fire on unrelated titles', () => {
    expect(isMealStop({ title: 'Hallasan Trailhead', arrival_planned: '08:00' }).isMeal).toBe(false);
    expect(isMealStop({ title: 'Manjanggul Cave' }).isMeal).toBe(false);
  });
});

describe('mealForMinute', () => {
  it('labels wider than the detection windows so 20:30 is still dinner', () => {
    expect(mealForMinute(12 * 60)).toBe('lunch');
    expect(mealForMinute(20 * 60 + 30)).toBe('dinner');
    expect(mealForMinute(15 * 60 + 30)).toBe('snack');
    expect(mealForMinute(null)).toBe('snack');
  });
});

describe('robustness', () => {
  it('never throws on garbage', () => {
    expect(isMealStop(null).isMeal).toBe(false);
    expect(isMealStop(undefined, NOON_MS).isMeal).toBe(false);
    expect(isMealStop({}).isMeal).toBe(false);
  });
});
