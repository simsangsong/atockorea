/**
 * A4 — the review gate on the itinerary builder's POI localization.
 *
 * `normalizeBuilderLocale` happens to exclude fr/de/ru/it, so unreviewed
 * machine translation cannot reach guests through this path today. That is an
 * accident of an allowlist, not a guarantee — the day a locale is added there,
 * whatever sits in `content_locales` ships. These pin the gate itself.
 */

import { localizePoiRow, normalizeBuilderLocale } from '@/lib/itinerary-builder/locale-content';
import type { MatchPoiRow } from '@/lib/itinerary-builder/types';

const POI = {
  poi_key: 'seopjikoji',
  name_en: 'Seopjikoji',
  name_ko: '섭지코지',
  description: 'English master description.',
  highlights: ['Cliff walk'],
  content_locales: {
    ko: { name: '섭지코지', description: '바람과 유채의 곶.' },
    fr: { name: 'Seopjikoji', description: 'Traduction automatique non relue.' },
  },
  content_locale_status: { ko: 'approved', fr: 'pending' },
} as unknown as MatchPoiRow;

describe('localizePoiRow — review gate', () => {
  it('localizes an approved locale', () => {
    const row = localizePoiRow(POI, 'ko');
    expect(row.description).toBe('바람과 유채의 곶.');
  });

  it('leaves the row in English when the locale is pending', () => {
    const pending = { ...POI, content_locale_status: { ko: 'pending' } } as unknown as MatchPoiRow;
    expect(localizePoiRow(pending, 'ko').description).toBe('English master description.');
  });

  it('treats a missing status as NOT approved', () => {
    const ungated = { ...POI, content_locale_status: undefined } as unknown as MatchPoiRow;
    expect(localizePoiRow(ungated, 'ko').description).toBe('English master description.');
  });

  it('still refuses locales outside the builder allowlist', () => {
    // Belt and braces: even approved, fr never becomes a builder locale here.
    expect(normalizeBuilderLocale('fr')).toBeNull();
    expect(normalizeBuilderLocale('de')).toBeNull();
    expect(normalizeBuilderLocale('zh-CN')).toBe('zh');
  });
});
