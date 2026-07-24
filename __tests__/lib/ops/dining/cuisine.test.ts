/**
 * Exclusion semantics (§5.7 R-4) — the safety-critical file.
 *
 * The invariant under test: we EXCLUDE conflicting places, and we NEVER assert
 * that a place complies. A halal claim that turns out to be wrong is the worst
 * outcome this feature can produce, so `satisfiesPositively` must stay false
 * unless an explicit verified tag sits on the row.
 */

import {
  EXCLUSION_KEYWORDS,
  cuisineLeaf,
  exclusionReasons,
  satisfiesPositively,
  violatesDietary,
} from '@/lib/ops/dining/cuisine';
import { DIETARY_TAGS } from '@/lib/ops/dining/dietary';

describe('cuisineLeaf', () => {
  it('takes the leaf of a Kakao category path', () => {
    expect(cuisineLeaf('음식점 > 한식 > 해물,생선')).toBe('해물,생선');
    expect(cuisineLeaf('음식점 > 카페 > 커피전문점')).toBe('커피전문점');
  });

  it('drops uninformative single-node categories', () => {
    expect(cuisineLeaf('음식점')).toBeNull();
    expect(cuisineLeaf('카페')).toBeNull();
  });

  it('is null-safe', () => {
    expect(cuisineLeaf(null)).toBeNull();
    expect(cuisineLeaf(undefined)).toBeNull();
    expect(cuisineLeaf('')).toBeNull();
    expect(cuisineLeaf(7)).toBeNull();
  });
});

describe('EXCLUSION_KEYWORDS', () => {
  it('covers every storable dietary tag', () => {
    for (const tag of DIETARY_TAGS) {
      expect(Array.isArray(EXCLUSION_KEYWORDS[tag])).toBe(true);
      expect(EXCLUSION_KEYWORDS[tag].length).toBeGreaterThan(0);
    }
  });
});

describe('violatesDietary', () => {
  const blackPork = { name: '성산 흑돼지 맛집', category_name: '음식점 > 한식 > 육류,고기' };

  it('excludes a 흑돼지 place for BOTH no_pork and halal', () => {
    expect(violatesDietary(blackPork, ['no_pork'])).toBe(true);
    expect(violatesDietary(blackPork, ['halal'])).toBe(true);
  });

  it('excludes on the category path even when the name is neutral', () => {
    expect(violatesDietary({ name: '올레식당', category_name: '음식점 > 한식 > 돼지고기구이' }, ['no_pork'])).toBe(
      true,
    );
  });

  it('excludes seafood venues for no_seafood and shellfish venues for no_shellfish', () => {
    expect(violatesDietary({ name: '성산포 횟집' }, ['no_seafood'])).toBe(true);
    expect(violatesDietary({ name: '전복돌솥밥' }, ['no_shellfish'])).toBe(true);
    // A grilled-pork house is fine for a seafood restriction.
    expect(violatesDietary(blackPork, ['no_seafood'])).toBe(false);
  });

  it('treats gluten exclusion as advisory but still drops wheat-identity venues', () => {
    expect(violatesDietary({ name: '올레국수' }, ['gluten_free'])).toBe(true);
    expect(violatesDietary({ name: '제주 베이커리' }, ['gluten_free'])).toBe(true);
  });

  it('never excludes for kids or an unknown tag', () => {
    expect(violatesDietary(blackPork, ['kids'])).toBe(false);
    expect(violatesDietary(blackPork, ['astrology'])).toBe(false);
  });

  it('is false with no tags, no place text, or malformed input', () => {
    expect(violatesDietary(blackPork, [])).toBe(false);
    expect(violatesDietary(blackPork, null)).toBe(false);
    expect(violatesDietary({}, ['no_pork'])).toBe(false);
  });

  it('reports which keyword fired (admin/debug surface)', () => {
    expect(exclusionReasons(blackPork, ['no_pork'])).toEqual([{ tag: 'no_pork', keyword: '돼지' }]);
  });
});

describe('satisfiesPositively — the narrow exception', () => {
  it('🔴 never asserts halal without an explicit verified tag', () => {
    // The words are right there in the name, but the ROW carries no tag: the
    // caller (deriveTags) is the only thing allowed to promote a name into a
    // tag, and until it has, we make no claim.
    expect(satisfiesPositively({ name: '할랄 케밥 halal kebab', tags: [] }, 'halal')).toBe(false);
    expect(satisfiesPositively({ name: '할랄 케밥' }, 'halal')).toBe(false);
    expect(satisfiesPositively({ name: '무슬림 식당', tags: ['dine_in', 'takeout'] }, 'halal')).toBe(false);
    // With the verified tag it is allowed — as a ranking bonus only.
    expect(satisfiesPositively({ name: '할랄 케밥', tags: ['halal'] }, 'halal')).toBe(true);
  });

  it('supports vegetarian / vegan / kids from verified tags', () => {
    expect(satisfiesPositively({ tags: ['vegetarian_friendly'] }, 'vegetarian')).toBe(true);
    expect(satisfiesPositively({ tags: ['vegan'] }, 'vegetarian')).toBe(true);
    expect(satisfiesPositively({ tags: ['vegetarian_friendly'] }, 'vegan')).toBe(false);
    expect(satisfiesPositively({ tags: ['kids_ok'] }, 'kids')).toBe(true);
  });

  it('is structurally false for the unverifiable restrictions', () => {
    for (const tag of ['no_pork', 'no_seafood', 'no_shellfish', 'no_nuts', 'gluten_free'] as const) {
      expect(satisfiesPositively({ tags: ['halal', 'vegan', 'kids_ok'] }, tag)).toBe(false);
    }
  });
});
