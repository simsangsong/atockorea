/**
 * A3 — the POI master as an arrival-content tier.
 *
 * Live numbers this exists for: the arrival card reached 11 POIs (the curated
 * spots) and fell back to an English fact sheet for everything else, while
 * `match_pois.content_locales` held real per-locale writing for 117. Nothing
 * read it. With this tier the same 124 stops a private charter can pick go from
 * 11 to 122 with something to say.
 */

import { withMatchPoiContent } from '@/lib/tour-room/poiContent.server';
import type { SpotContentByLocale } from '@/lib/tour-room/spotContent';

const ROW = {
  poi_key: 'seopjikoji',
  name_en: 'Seopjikoji',
  description: 'English master description.',
  highlights: ['Cliff walk', 'Lighthouse'],
  images: [{ url: 'https://cdn.test/seopjikoji.webp' }],
  default_image_url: null,
  visit_basics: { hours: '09:00–18:00' },
  convenience: { restroom: 'By the car park' },
  smart_notes: { photo: 'Golden hour on the ridge' },
  content_locales: {
    en: { name: 'Seopjikoji', description: 'A headland of wind and rapeseed.', highlights: ['Cliff walk'] },
    ko: { name: '섭지코지', description: '바람과 유채의 곶.', highlights: ['절벽 산책'], insider_tip: '등대까지 걸어가세요.' },
  },
  // A4 — the review gate is fail-closed, so a fixture must say what is approved.
  content_locale_status: { en: 'approved', ko: 'approved' },
};

function fakeDb(row: unknown = ROW) {
  return {
    from() {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => ({ data: row, error: null });
      return chain;
    },
  } as never;
}

describe('withMatchPoiContent', () => {
  it('gives a stop that had nothing a real briefing', async () => {
    const merged = await withMatchPoiContent(fakeDb(), 'seopjikoji', ['ko', 'en'], {});
    expect(merged.ko?.tier).toBe('match_poi');
    expect(merged.ko?.lang).toBe('ko');
    expect(merged.ko?.content.description).toBe('바람과 유채의 곶.');
    expect(merged.ko?.content.smartNotes?.tip).toBe('등대까지 걸어가세요.');
  });

  it('keeps the practical rows the fact sheet supplied', async () => {
    // poi_kb owns hours/restroom, match_pois owns the story — a stop should get
    // both, not one replacing the other.
    const merged = await withMatchPoiContent(fakeDb(), 'seopjikoji', ['en'], {});
    expect(merged.en?.content.visitBasics?.hours).toBe('09:00–18:00');
    expect(merged.en?.content.convenience?.restroom).toBe('By the car park');
    expect(merged.en?.content.description).toBe('A headland of wind and rapeseed.');
  });

  it('never overrides curated content', async () => {
    const base: SpotContentByLocale = {
      ko: { content: { name: '섭지코지', description: '큐레이션된 해설.' }, lang: 'ko', tier: 'curated' },
    };
    const merged = await withMatchPoiContent(fakeDb(), 'seopjikoji', ['ko'], base);
    expect(merged.ko?.tier).toBe('curated');
    expect(merged.ko?.content.description).toBe('큐레이션된 해설.');
  });

  it('reports English honestly for a locale the POI has not been translated into', async () => {
    const merged = await withMatchPoiContent(fakeDb(), 'seopjikoji', ['fr'], {});
    expect(merged.fr?.lang).toBe('en');
    expect(merged.fr?.content.description).toBe('A headland of wind and rapeseed.');
  });

  it('leaves the base untouched when the POI is unknown or the lookup fails', async () => {
    expect(await withMatchPoiContent(fakeDb(null), 'nope', ['en'], {})).toEqual({});
    expect(await withMatchPoiContent(fakeDb(), null, ['en'], {})).toEqual({});
    const throwing = {
      from() {
        throw new Error('db down');
      },
    } as never;
    // An arrival must still send when the POI table is unavailable.
    expect(await withMatchPoiContent(throwing, 'seopjikoji', ['en'], {})).toEqual({});
  });

  it('adds nothing for a POI row with no prose at all', async () => {
    const bare = { ...ROW, description: null, highlights: [], content_locales: {} };
    expect(await withMatchPoiContent(fakeDb(bare), 'seopjikoji', ['en'], {})).toEqual({});
  });
});

describe('withMatchPoiContent — A4 review gate', () => {
  it('does not serve a locale that has not been approved', async () => {
    // The whole reason the gate exists: machine translation lands in
    // content_locales, and until a human approves it the guest must not see it
    // — and must not HEAR it, since the arrival card speaks this text.
    const staged = {
      ...ROW,
      content_locales: {
        ...ROW.content_locales,
        fr: { name: 'Seopjikoji', description: 'Traduction automatique non relue.' },
      },
      content_locale_status: { en: 'approved', ko: 'approved', fr: 'pending' },
    };
    const merged = await withMatchPoiContent(fakeDb(staged), 'seopjikoji', ['fr'], {});
    expect(merged.fr?.content.description).toBe('A headland of wind and rapeseed.');
    expect(merged.fr?.lang).toBe('en');
  });

  it('serves it the moment it is approved', async () => {
    const approved = {
      ...ROW,
      content_locales: { ...ROW.content_locales, fr: { name: 'Seopjikoji', description: 'Un cap de vent.' } },
      content_locale_status: { en: 'approved', ko: 'approved', fr: 'approved' },
    };
    const merged = await withMatchPoiContent(fakeDb(approved), 'seopjikoji', ['fr'], {});
    expect(merged.fr?.content.description).toBe('Un cap de vent.');
    expect(merged.fr?.lang).toBe('fr');
  });

  it('treats a missing status as NOT approved', async () => {
    // Fail-closed: a writer that forgets to set a status stages content
    // invisibly rather than publishing it by accident.
    const ungated = { ...ROW, content_locale_status: null };
    expect(await withMatchPoiContent(fakeDb(ungated), 'seopjikoji', ['ko', 'en'], {})).toEqual({});
  });

  it('withholds the English master too when English is unapproved', async () => {
    const koOnly = { ...ROW, content_locale_status: { ko: 'approved' } };
    const merged = await withMatchPoiContent(fakeDb(koOnly), 'seopjikoji', ['ko', 'en'], {});
    expect(merged.ko?.content.description).toBe('바람과 유채의 곶.');
    expect(merged.en).toBeUndefined();
  });
});
