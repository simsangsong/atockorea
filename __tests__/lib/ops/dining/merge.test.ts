/**
 * Kakao × Google merge (§5.7 R-3, spec K1/K7).
 *
 * The two rules that carry consequences:
 *   - an unmatched GOOGLE place is dropped (no Kakao id → no deep link → the
 *     card has no way to navigate there);
 *   - an unmatched KAKAO place survives with a null rating (a rural cell may be
 *     entirely un-matched, and that is what the K1 fallback is for).
 */

import {
  MERGE_MAX_DISTANCE_M,
  deriveTags,
  extractSignatureMenus,
  isSameBusiness,
  mergeKakaoGoogle,
  nameSimilarity,
  normalizeName,
} from '@/lib/ops/dining/merge.server';
import type { GooglePlace } from '@/lib/ops/dining/google.server';
import type { KakaoPlaceDoc } from '@/lib/ops/dining/kakao.server';

const CENTER = { lat: 33.4586, lng: 126.9425 };
/** ~1 metre of latitude in degrees — used to place fixtures a known distance apart. */
const DEG_PER_M = 1 / 111_320;

function kakaoDoc(overrides: Partial<KakaoPlaceDoc> = {}): KakaoPlaceDoc {
  return {
    id: '21499361',
    place_name: '올레국수',
    category_name: '음식점 > 한식 > 국수',
    category_group_code: 'FD6',
    phone: '064-000-0000',
    address_name: '제주 서귀포시',
    road_address_name: '제주 서귀포시 일주동로',
    place_url: 'http://place.map.kakao.com/21499361',
    x: CENTER.lng,
    y: CENTER.lat,
    distance: 210,
    ...overrides,
  };
}

function googlePlace(overrides: Partial<GooglePlace> = {}): GooglePlace {
  return {
    id: 'ChIJolle',
    displayName: '올레국수',
    lat: CENTER.lat,
    lng: CENTER.lng,
    rating: 4.4,
    userRatingCount: 312,
    priceBand: 2,
    regularOpeningHours: { periods: [] },
    primaryTypeDisplayName: 'Korean restaurant',
    servesVegetarianFood: null,
    goodForChildren: null,
    menuForChildren: null,
    takeout: null,
    dineIn: null,
    hasParking: false,
    reservable: null,
    googleMapsUri: 'https://maps.google.com/?cid=1',
    reviews: [],
    ...overrides,
  };
}

describe('normalizeName / nameSimilarity', () => {
  it('strips branch suffixes, punctuation and brackets', () => {
    expect(normalizeName('흑돼지가든 제주점')).toBe(normalizeName('흑돼지가든'));
    expect(normalizeName('Olle Guksu (Seogwipo)')).toBe('olleguksu');
    expect(normalizeName('  올레  국수  ')).toBe('올레국수');
    expect(normalizeName(null)).toBe('');
  });

  it('scores identical and containing names high, unrelated names low', () => {
    expect(nameSimilarity('올레국수', '올레국수')).toBe(1);
    expect(nameSimilarity('흑돼지가든 제주점', '흑돼지가든')).toBe(1);
    expect(nameSimilarity('올레국수', '성산포횟집')).toBeLessThan(0.3);
    expect(nameSimilarity('', 'x')).toBe(0);
  });
});

describe('isSameBusiness', () => {
  it('requires both proximity and name similarity', () => {
    expect(isSameBusiness(kakaoDoc(), googlePlace())).toBe(true);

    // Same name, 200 m away → different branch, not a match.
    const far = googlePlace({ lat: CENTER.lat + 200 * DEG_PER_M });
    expect(isSameBusiness(kakaoDoc(), far)).toBe(false);

    // 🔴 The food-street trap: same building, completely different restaurant.
    const neighbour = googlePlace({ id: 'ChIJother', displayName: '성산포횟집' });
    expect(isSameBusiness(kakaoDoc(), neighbour)).toBe(false);
  });

  it('tolerates a branch-suffix difference within the distance bound', () => {
    const within = googlePlace({
      displayName: '올레국수 성산점',
      lat: CENTER.lat + (MERGE_MAX_DISTANCE_M - 5) * DEG_PER_M,
    });
    expect(isSameBusiness(kakaoDoc(), within)).toBe(true);
  });
});

describe('deriveTags', () => {
  it('🔴 halal / vegan only from the business\'s own name or category', () => {
    expect(deriveTags(kakaoDoc({ place_name: '할랄 케밥 하우스' }), null)).toContain('halal');
    expect(deriveTags(kakaoDoc({ place_name: '비건 카페' }), null)).toEqual(
      expect.arrayContaining(['vegan', 'vegetarian_friendly']),
    );
    // A generic Korean restaurant with every Google flag set is still not halal.
    const enriched = googlePlace({ goodForChildren: true, takeout: true, dineIn: true, reservable: true });
    expect(deriveTags(kakaoDoc(), enriched)).not.toContain('halal');
    expect(deriveTags(kakaoDoc(), enriched)).not.toContain('vegan');
  });

  it('promotes Google\'s explicit vegetarian flag but not to vegan', () => {
    const tags = deriveTags(kakaoDoc(), googlePlace({ servesVegetarianFood: true }));
    expect(tags).toContain('vegetarian_friendly');
    expect(tags).not.toContain('vegan');
  });

  it('maps the operational flags and the cafe group', () => {
    const tags = deriveTags(
      kakaoDoc({ category_group_code: 'CE7' }),
      googlePlace({ menuForChildren: true, takeout: true, dineIn: true, hasParking: true, reservable: true }),
    );
    expect(tags).toEqual(expect.arrayContaining(['cafe', 'kids_ok', 'takeout', 'dine_in', 'parking', 'reservable']));
  });

  it('is empty for a bare Kakao row with no Google match', () => {
    expect(deriveTags(kakaoDoc(), null)).toEqual([]);
  });
});

describe('extractSignatureMenus (review bundle)', () => {
  it('bounds the bundle and normalizes whitespace', () => {
    const bundle = extractSignatureMenus(
      [
        { text: '고기국수가  정말   맛있어요', languageCode: 'ko', rating: 5 },
        { text: 'Great noodles', languageCode: 'en', rating: 4 },
      ],
      { maxReviews: 1 },
    );
    expect(bundle).toBe('고기국수가 정말 맛있어요');
  });

  it('is empty when there are no reviews', () => {
    expect(extractSignatureMenus(null)).toBe('');
    expect(extractSignatureMenus([])).toBe('');
  });
});

describe('mergeKakaoGoogle', () => {
  it('keys on Kakao and folds in the Google quality fields', () => {
    const [row] = mergeKakaoGoogle([kakaoDoc()], [googlePlace({ reviews: [{ text: '고기국수 최고', languageCode: 'ko', rating: 5 }] })]);
    expect(row.place_key).toBe('kakao:21499361');
    expect(row.name).toBe('올레국수');
    expect(row.cuisine).toBe('국수');
    expect(row.rating).toBe(4.4);
    expect(row.review_count).toBe(312);
    expect(row.price_band).toBe(2);
    expect(row.google_place_id).toBe('ChIJolle');
    expect(row.review_text).toBe('고기국수 최고');
    expect(row.cell).toHaveLength(7);
  });

  it('🔴 drops unmatched Google places entirely (no Kakao id → no deep link)', () => {
    const orphan = googlePlace({ id: 'ChIJorphan', displayName: 'Nowhere Cafe', lat: CENTER.lat + 0.01 });
    const rows = mergeKakaoGoogle([kakaoDoc()], [orphan, googlePlace()]);
    expect(rows).toHaveLength(1);
    expect(rows.map((r) => r.google_place_id)).toEqual(['ChIJolle']);
  });

  it('keeps unmatched Kakao places with a null rating', () => {
    const rows = mergeKakaoGoogle([kakaoDoc(), kakaoDoc({ id: '999', place_name: '무명식당', x: CENTER.lng + 0.02 })], [googlePlace()]);
    expect(rows).toHaveLength(2);
    const orphan = rows.find((r) => r.place_key === 'kakao:999');
    expect(orphan?.rating).toBeNull();
    expect(orphan?.review_count).toBeNull();
    expect(orphan?.place_url).toBe('http://place.map.kakao.com/21499361');
  });

  it('lets one Google place enrich at most one Kakao row', () => {
    // Two Kakao rows in the same building with the same name (a real pattern:
    // a restaurant listed twice). Only the best match may claim the rating.
    const rows = mergeKakaoGoogle([kakaoDoc(), kakaoDoc({ id: '21499362' })], [googlePlace()]);
    expect(rows.filter((r) => r.google_place_id !== null)).toHaveLength(1);
  });

  it('de-duplicates repeated Kakao ids and backfills distance from the centre', () => {
    const rows = mergeKakaoGoogle(
      [kakaoDoc({ distance: null }), kakaoDoc()],
      [],
      { centerLat: CENTER.lat, centerLng: CENTER.lng + 0.002 },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].distance_m).toBeGreaterThan(100);
  });

  it('is empty-safe', () => {
    expect(mergeKakaoGoogle([], [])).toEqual([]);
    expect(mergeKakaoGoogle([], [googlePlace()])).toEqual([]);
  });
});
