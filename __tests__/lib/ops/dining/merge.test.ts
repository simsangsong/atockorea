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
  MERGE_MIN_NAME_SIMILARITY,
  deriveTags,
  extractSignatureMenus,
  isSameBusiness,
  mergeKakaoGoogle,
  nameSimilarity,
  normalizeName,
  qualifierFreeTokens,
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

  it('drops a trailing latin brand tag, but only when a Korean name survives', () => {
    expect(normalizeName('꽃담수제버거 GreenroofJeju')).toBe('꽃담수제버거');
    // No Hangul to fall back on → the latin words ARE the name.
    expect(normalizeName('Olle Guksu')).toBe('olleguksu');
  });

  it('🔴 containment no longer short-circuits a higher bigram score', () => {
    // The old scorer returned 4/9 = 0.44 here and never computed the bigram
    // score (0.67), so a true match fell under the floor.
    expect(nameSimilarity('해녀의집', '성산어촌계해녀의집')).toBeGreaterThanOrEqual(
      MERGE_MIN_NAME_SIMILARITY,
    );
  });

  it('scores whole-word overlap, not just substrings', () => {
    // "해일리 카페" is not a substring of "해일리 베이커리 카페", but two of its
    // three tokens match exactly.
    expect(nameSimilarity('해일리 카페', '해일리 베이커리 카페')).toBeGreaterThanOrEqual(
      MERGE_MIN_NAME_SIMILARITY,
    );
    // Sharing only a generic category word is not enough.
    expect(nameSimilarity('해일리 카페', '라이트 카페')).toBeLessThan(MERGE_MIN_NAME_SIMILARITY);
  });

  it('treats branch markers as noise wherever the qualifier sits', () => {
    expect(normalizeName('스타벅스 성산일출봉점')).toBe('스타벅스');
    expect(normalizeName('어우름 고기국수 성산일출봉본점')).toBe('어우름고기국수');
    // A name that is ONLY a branch marker keeps its spelling instead of
    // normalizing to '' (which would score 0 against everything).
    expect(normalizeName('제주점')).not.toBe('');
  });
});

/**
 * 🔴 THE REGRESSION CONTRACT.
 *
 * Every row below is a REAL pair measured against the live Kakao + Google APIs
 * at Seongsan Ilchulbong (33.45806, 126.9425, r=1500) — not invented fixtures.
 * The `sim` column is what the OLD scorer returned; all six SAME pairs sat under
 * the 0.6 floor, which is how a guest at the flagship POI ended up with two
 * restaurant options out of twenty rated candidates.
 *
 * The four DIFFERENT pairs are the other half of the contract. Loosening the
 * scorer until the SAME pairs pass is easy; doing it without letting these four
 * through is the actual constraint. 성산수산식당 vs 성산해나 is the sharp one —
 * both begin with 성산, so any naive prefix strip merges them.
 */
describe('🔴 measured Seongsan pairs (regression contract)', () => {
  const SAME: Array<[google: string, kakao: string, distanceM: number, oldSim: number]> = [
    ['프릳츠 제주 성산', '프릳츠 제주성산점', 12, 0.43],
    ['청운식당', '성산일출봉 청운식당', 7, 0.44],
    ['해녀의집', '성산어촌계해녀의집', 10, 0.44],
    ['성산일출봉 해일리 베이커리 카페', '해일리 카페', 7, 0.47],
    ['꽃담수제버거 GreenroofJeju', '꽃담수제버거', 7, 0.32],
    ['어우름 고기국수 성산일출봉본점', '어우름 제주고기국수 성산본점', 6, 0.71],
  ];

  const DIFFERENT: Array<[google: string, kakao: string, distanceM: number]> = [
    ['성산수산식당', '성산해나', 28],
    ['금돗 성산 흑돼지', '메가MGC커피 제주성산일출봉점', 22],
    ['시안', '카페더라이트', 48],
    ['갈치왕 성산점', '성산해나', 142],
  ];

  /** Place a Google fixture `distanceM` north of the Kakao fixture. */
  function pairAt(googleName: string, kakaoName: string, distanceM: number) {
    return {
      kakao: kakaoDoc({ place_name: kakaoName }),
      google: googlePlace({
        displayName: googleName,
        lat: CENTER.lat + distanceM * DEG_PER_M,
      }),
    };
  }

  it.each(SAME)('matches %s ≡ %s (%s m, old scorer said %s)', (google, kakao, distanceM) => {
    expect(nameSimilarity(kakao, google)).toBeGreaterThanOrEqual(MERGE_MIN_NAME_SIMILARITY);
    const pair = pairAt(google, kakao, distanceM);
    expect(isSameBusiness(pair.kakao, pair.google)).toBe(true);
  });

  it.each(DIFFERENT)('keeps %s and %s apart (%s m)', (google, kakao, distanceM) => {
    const pair = pairAt(google, kakao, distanceM);
    expect(isSameBusiness(pair.kakao, pair.google)).toBe(false);
  });

  it('🔴 성산수산식당 vs 성산해나 stays apart AFTER the shared 성산 is stripped', () => {
    // The danger the qualifier stripper creates: both names begin with 성산, so
    // stripping it must leave two names that still score ~0 against each other.
    expect(qualifierFreeTokens('성산수산식당')).toEqual(['수산식당']);
    expect(qualifierFreeTokens('성산해나')).toEqual(['해나']);
    expect(nameSimilarity('성산수산식당', '성산해나')).toBeLessThan(MERGE_MIN_NAME_SIMILARITY);
  });

  it('🔴 does not reduce a bare place name to nothing', () => {
    // "제주" IS the business name here. Stripping it to '' would score 1.0
    // against every other fully-stripped name in the cell.
    expect(qualifierFreeTokens('제주')).toEqual(['제주']);
    expect(nameSimilarity('제주', '성산')).toBeLessThan(MERGE_MIN_NAME_SIMILARITY);
  });

  it('still refuses to match a romanized name to its Korean original', () => {
    // We translate names ourselves; guessing a romanization table here would
    // glue ratings onto the wrong business.
    expect(nameSimilarity('흑돼지가든', 'Heukdwaeji Garden')).toBeLessThan(MERGE_MIN_NAME_SIMILARITY);
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

  it('🔴 keeps distance a FLAT hard gate — an identical name does not buy extra metres', () => {
    // A tiered gate (40-120 m for a near-identical name) was built and probed
    // against three Jeju areas; it matched zero additional places, so it was
    // removed rather than shipped as an untested widening of a safety gate.
    const justOutside = googlePlace({
      displayName: '올레국수',
      lat: CENTER.lat + (MERGE_MAX_DISTANCE_M + 5) * DEG_PER_M,
    });
    expect(nameSimilarity(kakaoDoc().place_name, justOutside.displayName ?? '')).toBe(1);
    expect(isSameBusiness(kakaoDoc(), justOutside)).toBe(false);
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
