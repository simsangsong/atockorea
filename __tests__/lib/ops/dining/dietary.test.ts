/**
 * Dietary intake (§5.7 R-1).
 *
 * Two properties carry real risk and both are pinned here:
 *   - a restriction the guest declared must never be lost (needs → tags);
 *   - a restriction the guest did NOT declare must never be invented by the
 *     free-text scan (a false positive silently hides restaurants and the guest
 *     has no way to see why).
 */

import {
  DIETARY_CAUTION,
  DIETARY_LABELS,
  DIETARY_TAGS,
  dietaryFromSpecialRequests,
  dietaryLabel,
  isDietaryFilterTag,
  needsToDietary,
} from '@/lib/ops/dining/dietary';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

describe('DIETARY_TAGS', () => {
  it('is the 8 storable chips (the shipped 6 plus no_shellfish / no_nuts)', () => {
    expect([...DIETARY_TAGS]).toEqual([
      'vegetarian',
      'vegan',
      'halal',
      'no_pork',
      'no_seafood',
      'no_shellfish',
      'no_nuts',
      'gluten_free',
    ]);
  });

  it('treats kids as a derived filter tag, not a storable chip', () => {
    expect(isDietaryFilterTag('kids')).toBe(true);
    expect((DIETARY_TAGS as readonly string[]).includes('kids')).toBe(false);
  });
});

describe('needsToDietary', () => {
  it('normalizes the A10 checklist into filter tags', () => {
    const result = needsToDietary({ dietary: ['vegetarian', 'no_shellfish'], allergy_note: '  땅콩  ' });
    expect(result.tags).toEqual(['vegetarian', 'no_shellfish']);
    expect(result.allergyNote).toBe('땅콩');
    expect(result.kids).toBe(false);
  });

  it('derives kids from children > 0 without storing it', () => {
    const result = needsToDietary({ dietary: ['halal'], children: 2 });
    expect(result.tags).toEqual(['halal', 'kids']);
    expect(result.kids).toBe(true);
    expect(result.children).toBe(2);
  });

  it('derives kids from child_ages when children was left blank', () => {
    expect(needsToDietary({ child_ages: [5, 8] }).kids).toBe(true);
  });

  it('accepts loose spellings and drops unknown strings', () => {
    const result = needsToDietary({ dietary: ['Gluten-Free', 'nut free', 'astrology', 42] });
    expect(result.tags).toEqual(['no_nuts', 'gluten_free']);
  });

  it('returns a stable order regardless of input order', () => {
    const a = needsToDietary({ dietary: ['gluten_free', 'vegan'] });
    const b = needsToDietary({ dietary: ['vegan', 'gluten_free'] });
    expect(a.tags).toEqual(b.tags);
  });

  it('survives null / malformed needs', () => {
    expect(needsToDietary(null).tags).toEqual([]);
    expect(needsToDietary(undefined).tags).toEqual([]);
    expect(needsToDietary({ dietary: 'vegan' }).tags).toEqual([]);
  });
});

describe('dietaryFromSpecialRequests', () => {
  it('reads unambiguous English declarations', () => {
    expect(dietaryFromSpecialRequests('No pork please, and one of us is gluten free.')).toEqual([
      'no_pork',
      'gluten_free',
    ]);
  });

  it('reads Korean / Japanese / Spanish / Chinese declarations', () => {
    expect(dietaryFromSpecialRequests('저희는 돼지고기 못 먹어요')).toContain('no_pork');
    expect(dietaryFromSpecialRequests('ハラール対応のお店をお願いします')).toContain('halal');
    expect(dietaryFromSpecialRequests('Somos vegetarianos')).toContain('vegetarian');
    expect(dietaryFromSpecialRequests('我们不吃海鲜')).toContain('no_seafood');
  });

  it('expands halal to no_pork and vegan to vegetarian (same exclusion set)', () => {
    const halal = dietaryFromSpecialRequests('halal only please');
    expect(halal).toEqual(expect.arrayContaining(['halal', 'no_pork']));
    const vegan = dietaryFromSpecialRequests('vegan');
    expect(vegan).toEqual(expect.arrayContaining(['vegan', 'vegetarian']));
  });

  it('🔴 does NOT invent restrictions from incidental words', () => {
    // "doughnuts" must not read as a nut allergy; "we love seafood" is not a
    // seafood restriction; a bare "bar" is not a halal problem.
    expect(dietaryFromSpecialRequests('We love doughnuts and seafood!')).toEqual([]);
    expect(dietaryFromSpecialRequests('Please book a table near the window')).toEqual([]);
    expect(dietaryFromSpecialRequests('')).toEqual([]);
    expect(dietaryFromSpecialRequests(null)).toEqual([]);
    expect(dietaryFromSpecialRequests(12345)).toEqual([]);
  });
});

describe('labels + caution', () => {
  it('every filter tag has a label in all 5 room locales', () => {
    const missing: string[] = [];
    for (const [tag, labels] of Object.entries(DIETARY_LABELS)) {
      for (const locale of ROOM_LOCALES) {
        if (typeof labels[locale] !== 'string' || labels[locale].trim() === '') missing.push(`${tag}/${locale}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('the mandatory caution line exists in all 5 room locales', () => {
    for (const locale of ROOM_LOCALES) {
      expect(DIETARY_CAUTION[locale].trim()).not.toBe('');
    }
  });

  it('dietaryLabel falls back to the raw tag for unknown values', () => {
    expect(dietaryLabel('vegan', 'ko')).toBe('비건');
    expect(dietaryLabel('made_up', 'ko')).toBe('made_up');
  });
});
