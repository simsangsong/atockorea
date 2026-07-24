/**
 * Card contract + 5-locale chrome (§5.7 R-5).
 *
 * Two things this suite exists to prevent: a missing translation key shipping
 * as `undefined` into a guest's message, and the caution line silently
 * disappearing from a filtered card.
 */

import {
  DINING_COPY,
  composeDiningText,
  composeDiningTranslations,
  diningTitle,
  hoursLabel,
  kakaoDirectionsUrl,
  kakaoPlaceUrl,
  placeDisplayName,
  priceBandLabel,
  type DiningCardMeta,
  type DiningPlace,
} from '@/lib/ops/dining/card';
import { DIETARY_CAUTION } from '@/lib/ops/dining/dietary';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

function diningPlace(overrides: Partial<DiningPlace> = {}): DiningPlace {
  return {
    place_key: 'kakao:21499361',
    name: '올레국수',
    name_i18n: { en: 'Olle Guksu', ja: 'オルレグクス' },
    cuisine: '해물,생선',
    category_name: '음식점 > 한식 > 해물,생선',
    lat: 33.4586,
    lng: 126.9425,
    distance_m: 240,
    walk_min: 3,
    price_band: 2,
    rating: 4.4,
    review_count: 312,
    tags: ['dine_in'],
    signature_menus: [{ name: '고기국수' }],
    place_url: 'http://place.map.kakao.com/21499361',
    open_today: true,
    closes_at: '21:00',
    ...overrides,
  };
}

function meta(overrides: Partial<DiningCardMeta> = {}): DiningCardMeta {
  return {
    kind: 'dining_card',
    poi_key: 'seongsan_ilchulbong',
    spot_title: 'Seongsan Ilchulbong',
    cell: 'wvfq2du',
    meal: 'lunch',
    dietary: [],
    places: [diningPlace()],
    source: 'cache',
    ...overrides,
  };
}

describe('DINING_COPY completeness', () => {
  const KEYS = [
    'walk',
    'openUntil',
    'openNow',
    'closedToday',
    'hoursUnknown',
    'unrated',
    'reviews',
    'filteredFor',
    'goHere',
    'reportWrong',
    'mapLink',
    'directions',
    'caution',
    'empty',
  ] as const;

  it('every room locale has every chrome key, non-empty', () => {
    const problems: string[] = [];
    for (const locale of ROOM_LOCALES) {
      const copy = DINING_COPY[locale];
      if (!copy) {
        problems.push(`${locale}: missing`);
        continue;
      }
      for (const key of KEYS) {
        if (typeof copy[key] !== 'string' || copy[key].trim() === '') problems.push(`${locale}.${key}`);
      }
      for (const mealKind of ['lunch', 'dinner', 'snack'] as const) {
        if (!copy.title[mealKind]?.includes('{spot}')) problems.push(`${locale}.title.${mealKind}`);
      }
      if (!copy.walk.includes('{min}')) problems.push(`${locale}.walk`);
      if (!copy.openUntil.includes('{time}')) problems.push(`${locale}.openUntil`);
      if (!copy.reviews.includes('{count}')) problems.push(`${locale}.reviews`);
    }
    expect(problems).toEqual([]);
  });

  it('carries the mandatory caution line from dietary.ts verbatim', () => {
    for (const locale of ROOM_LOCALES) {
      expect(DINING_COPY[locale].caution).toBe(DIETARY_CAUTION[locale]);
    }
  });

  it('exposes both guest actions in every locale', () => {
    expect(DINING_COPY.ko.goHere).toBe('여기 갈게요');
    expect(DINING_COPY.ko.reportWrong).toBe('정보가 틀려요');
  });
});

describe('priceBandLabel', () => {
  it('maps 1..4 to ₩..₩₩₩₩', () => {
    expect(priceBandLabel(1)).toBe('₩');
    expect(priceBandLabel(4)).toBe('₩₩₩₩');
  });

  it('is null-safe and rejects out-of-range bands', () => {
    expect(priceBandLabel(null)).toBeNull();
    expect(priceBandLabel(undefined)).toBeNull();
    expect(priceBandLabel(0)).toBeNull();
    expect(priceBandLabel(9)).toBeNull();
    expect(priceBandLabel(Number.NaN)).toBeNull();
  });
});

describe('kakao links', () => {
  it('🔴 upgrades the cached http URL to https (iOS mixed-content would kill it)', () => {
    expect(kakaoPlaceUrl({ place_url: 'http://place.map.kakao.com/21499361' })).toBe(
      'https://place.map.kakao.com/21499361',
    );
    expect(kakaoPlaceUrl({ place_url: 'https://place.map.kakao.com/1' })).toBe('https://place.map.kakao.com/1');
    expect(kakaoPlaceUrl({ place_url: '//place.map.kakao.com/1' })).toBe('https://place.map.kakao.com/1');
    expect(kakaoPlaceUrl({ place_url: '' })).toBe('');
  });

  it('builds a name,lat,lng directions link', () => {
    expect(kakaoDirectionsUrl({ name: '올레국수', lat: 33.4586, lng: 126.9425 })).toBe(
      `https://map.kakao.com/link/to/${encodeURIComponent('올레국수')},33.4586,126.9425`,
    );
  });

  it('returns empty for unusable coordinates', () => {
    expect(kakaoDirectionsUrl({ name: 'x', lat: Number.NaN, lng: 126 })).toBe('');
  });
});

describe('placeDisplayName', () => {
  it('keeps the Korean original in parentheses for non-Korean locales', () => {
    expect(placeDisplayName(diningPlace(), 'en')).toBe('Olle Guksu (올레국수)');
    expect(placeDisplayName(diningPlace(), 'ja')).toBe('オルレグクス (올레국수)');
  });

  it('shows the Korean name alone for ko and when no translation exists', () => {
    expect(placeDisplayName(diningPlace(), 'ko')).toBe('올레국수');
    expect(placeDisplayName(diningPlace({ name_i18n: null }), 'en')).toBe('올레국수');
    expect(placeDisplayName(diningPlace({ name_i18n: { en: '올레국수' } }), 'en')).toBe('올레국수');
  });
});

describe('hoursLabel', () => {
  it('distinguishes open-until, open-now, closed and unknown', () => {
    expect(hoursLabel({ open_today: true, closes_at: '21:00' }, 'en')).toBe('Open until 21:00');
    expect(hoursLabel({ open_today: true, closes_at: null }, 'en')).toBe('Open now');
    expect(hoursLabel({ open_today: false, closes_at: null }, 'en')).toBe('Closed right now');
    expect(hoursLabel({ open_today: null, closes_at: null }, 'en')).toBe('Hours unknown');
  });
});

describe('composeDiningText', () => {
  it('renders title, numbered picks, walk time and price', () => {
    const text = composeDiningText(meta(), 'en');
    expect(text).toContain('Lunch near Seongsan Ilchulbong');
    expect(text).toContain('1. Olle Guksu (올레국수)');
    expect(text).toContain('3 min walk');
    expect(text).toContain('₩₩');
    expect(text).toContain('★4.4');
    expect(text).toContain('Open until 21:00');
  });

  it('🔴 always appends the caution line when a filter was applied', () => {
    const filtered = meta({ dietary: ['no_pork', 'kids'] });
    const missing: string[] = [];
    for (const locale of ROOM_LOCALES) {
      const text = composeDiningText(filtered, locale);
      if (!text.includes(DIETARY_CAUTION[locale])) missing.push(`${locale}:caution`);
      if (!text.includes(DINING_COPY[locale].filteredFor)) missing.push(`${locale}:filteredFor`);
    }
    expect(missing).toEqual([]);
    // …and never claims a filter that was not applied.
    expect(composeDiningText(meta(), 'en')).not.toContain(DIETARY_CAUTION.en);
  });

  it('shows the honest unrated badge when the cell had no ratings', () => {
    const text = composeDiningText(meta({ places: [diningPlace({ unrated: true, rating: null })] }), 'ko');
    expect(text).toContain(DINING_COPY.ko.unrated);
  });

  it('falls back to the empty line rather than an empty list', () => {
    for (const locale of ROOM_LOCALES) {
      expect(composeDiningText(meta({ places: [] }), locale)).toContain(DINING_COPY[locale].empty);
    }
  });

  it('uses the right title per meal', () => {
    expect(diningTitle({ meal: 'dinner', spot_title: 'Jeju' }, 'ko')).toBe('Jeju 근처 저녁');
    expect(diningTitle({ meal: 'snack', spot_title: 'Jeju' }, 'ko')).toBe('Jeju 근처 간단히');
  });
});

describe('composeDiningTranslations', () => {
  it('mirrors composeApproachTranslations: en source + all room locales', () => {
    const payload = composeDiningTranslations(meta());
    expect(payload.source_locale).toBe('en');
    expect(payload.source_text).toBe(payload.translations.en);
    expect(Object.keys(payload.translations).sort()).toEqual([...ROOM_LOCALES].sort());
    for (const locale of ROOM_LOCALES) {
      expect(payload.translations[locale].trim()).not.toBe('');
      expect(payload.translations[locale]).toBe(composeDiningText(meta(), locale));
    }
  });

  it('produces genuinely different text per locale (no accidental en fallback)', () => {
    const { translations } = composeDiningTranslations(meta());
    expect(translations.ko).not.toBe(translations.en);
    expect(translations.ja).not.toBe(translations.en);
    expect(translations.zh).not.toBe(translations.es);
  });
});
