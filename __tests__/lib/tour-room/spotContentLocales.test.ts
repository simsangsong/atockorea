/**
 * A1/A2 — the arrival briefing per language, and the words spoken aloud.
 *
 * Regression anchor: before A1 the routes resolved the briefing ONCE, for
 * whoever triggered the stop, and shipped that single blob to the whole room.
 * The arrived line was 10-locale; the guiding itself was in the driver's
 * language. These tests pin the two invariants that fix depends on —
 * per-locale resolution, and an honest record of which language the prose is
 * actually in (curated covers 6 locales, poi_kb is English-only).
 */

import {
  composeSpotNarration,
  packSpotContent,
  pickSpotContent,
  resolveSpotContentFor,
  resolveSpotContentForLocales,
  speechSafe,
  splitEmphasis,
} from '@/lib/tour-room/spotContent';

const CURATED = {
  en: { description: 'A seaside temple.', highlights: ['Sunrise'] },
  ko: { description: '바다 절벽 위의 사찰.', highlights: ['일출'] },
  ja: { description: '海辺の寺院。' },
};

const SPOT = { title: 'Haedong Yonggungsa', content: CURATED, poi_key: 'haedong_yonggungsa' };

describe('resolveSpotContentFor', () => {
  it('serves a covered locale in its own language', () => {
    const resolved = resolveSpotContentFor(SPOT, 'ko');
    expect(resolved?.lang).toBe('ko');
    expect(resolved?.tier).toBe('curated');
    expect(resolved?.content.description).toBe('바다 절벽 위의 사찰.');
  });

  it('records English as the language when a locale is not covered', () => {
    // fr/de/ru/it were added to the app UI but never to the curated content.
    const resolved = resolveSpotContentFor(SPOT, 'fr');
    expect(resolved?.lang).toBe('en');
    expect(resolved?.content.description).toBe('A seaside temple.');
  });

  it('marks the poi_kb fact sheet as English whatever the locale asks for', () => {
    const resolved = resolveSpotContentFor(
      { title: 'Haedong Yonggungsa', content: null, poi_key: 'haedong_yonggungsa' },
      'ja',
    );
    expect(resolved?.tier).toBe('poi_kb');
    expect(resolved?.lang).toBe('en');
  });

  it('is null when nothing covers the spot', () => {
    expect(resolveSpotContentFor({ title: 'Nowhere', content: null, poi_key: 'no_such_poi' }, 'en')).toBeNull();
  });
});

describe('packSpotContent / pickSpotContent', () => {
  it('deduplicates locales that share a language', () => {
    const byLocale = resolveSpotContentForLocales(SPOT, ['ko', 'fr', 'de', 'it']);
    const pack = packSpotContent(byLocale);
    // fr/de/it all fall back to English — one blob on the wire, not three.
    expect(Object.keys(pack!.content_by_lang).sort()).toEqual(['en', 'ko']);
    expect(pack!.content_langs).toEqual({ ko: 'ko', fr: 'en', de: 'en', it: 'en' });
  });

  it('gives each viewer their own language back', () => {
    const pack = packSpotContent(resolveSpotContentForLocales(SPOT, ['ko', 'ja', 'de']))!;
    const meta = { kind: 'spot_arrival', ...pack } as Record<string, unknown>;
    expect(pickSpotContent(meta, 'ko')?.content.description).toBe('바다 절벽 위의 사찰.');
    expect(pickSpotContent(meta, 'ja')?.content.description).toBe('海辺の寺院。');
    const german = pickSpotContent(meta, 'de');
    expect(german?.content.description).toBe('A seaside temple.');
    expect(german?.lang).toBe('en'); // the voice layer must not say this in German
  });

  it('still renders arrival rows posted before A1', () => {
    const legacy = { kind: 'spot_arrival', content: { name: 'Old', description: 'legacy blob' } };
    expect(pickSpotContent(legacy, 'ko')?.content.description).toBe('legacy blob');
  });

  it('is null when the spot had no content at all', () => {
    expect(packSpotContent({})).toBeNull();
    expect(pickSpotContent({ kind: 'spot_arrival' }, 'en')).toBeNull();
  });

  it('ignores locales outside ROOM_LOCALES', () => {
    const byLocale = resolveSpotContentForLocales(SPOT, ['ko', 'tlh', '']);
    expect(Object.keys(byLocale)).toEqual(['ko']);
  });

  it('keeps page-payload junk off the realtime wire', () => {
    // Live curated rows carry galleryItems/_poi_meta/imageCredits — a whole
    // page payload, once per language, on every arrival broadcast.
    const fat = {
      title: 'Spot',
      poi_key: null,
      content: {
        en: {
          description: 'Story.',
          highlights: ['a'],
          galleryItems: [{ src: 'x' }],
          imageCredits: 'someone',
          _poi_meta: { internal: true },
          whyOnRoute: 'ops note',
        },
      },
    };
    const pack = packSpotContent(resolveSpotContentForLocales(fat, ['en']))!;
    expect(Object.keys(pack.content_by_lang.en!).sort()).toEqual(['description', 'highlights', 'name']);
  });
});

describe('composeSpotNarration', () => {
  it('narrates name, story, then highlights', () => {
    const spoken = composeSpotNarration({
      name: 'Haedong Yonggungsa',
      description: 'A seaside temple founded in 1376',
      highlights: ['Sunrise rock', 'Ocean cliffs'],
    });
    expect(spoken).toBe(
      'Haedong Yonggungsa. A seaside temple founded in 1376. Sunrise rock. Ocean cliffs.',
    );
  });

  it('falls back to the facts when a stop has no prose', () => {
    // The tier 82 of today's POIs actually have — silence would be worse.
    const spoken = composeSpotNarration({
      name: 'Jagalchi Market',
      visitBasics: { hours: 'Daily 05:00–22:00' },
      convenience: { restroom: 'Second floor' },
    });
    expect(spoken).toContain('Daily 05:00–22:00');
    expect(spoken).toContain('Second floor');
  });

  it('does not offer a voice for a bare name', () => {
    expect(composeSpotNarration({ name: 'Nowhere' })).toBe('');
    expect(composeSpotNarration(null)).toBe('');
  });

  it('stays inside the TTS length budget', () => {
    const spoken = composeSpotNarration({ name: 'X', description: 'y '.repeat(3000) });
    expect(spoken.length).toBeLessThanOrEqual(1200);
  });
});

describe('speechSafe', () => {
  it('strips the markdown the curated rows are written in', () => {
    // Every live briefing uses **bold**; a speech engine reads the asterisks.
    expect(speechSafe('**Haedong Yonggungsa** is a *seaside* temple')).toBe(
      'Haedong Yonggungsa is a seaside temple',
    );
    expect(speechSafe('See [the map](https://x.test/a) here')).toBe('See the map here');
    expect(speechSafe('## Heading\n- bullet one')).toBe('Heading bullet one');
  });

  it('leaves ordinary punctuation and CJK alone', () => {
    expect(speechSafe('해동 용궁사 — 부산의 사찰입니다.')).toBe('해동 용궁사 — 부산의 사찰입니다.');
  });
});

describe('composeSpotNarration — real-world shape', () => {
  it('never speaks markdown', () => {
    const spoken = composeSpotNarration({
      name: '**Gamcheon** Culture Village',
      description: "**Gamcheon Culture Village (감천문화마을)** — nicknamed **'Korea's Santorini'**.",
    });
    expect(spoken).not.toMatch(/\*\*/);
    expect(spoken).toContain("Korea's Santorini");
  });

  it('ends on a sentence, not mid-word, when it hits the budget', () => {
    const sentence = 'This stop has a long story that keeps going. ';
    const spoken = composeSpotNarration({ name: 'X', description: sentence.repeat(60) });
    expect(spoken.length).toBeLessThanOrEqual(1200);
    expect(spoken.endsWith('.')).toBe(true);
  });
});

describe('splitEmphasis — display', () => {
  it('turns **bold** into emphasis parts instead of literal asterisks', () => {
    // 116 of 117 live English descriptions are written in markdown, and the
    // card renders description as plain text — guests were reading asterisks.
    expect(splitEmphasis('**9.81 Park** is Korea’s first **gravity-powered** kart facility')).toEqual([
      { text: '9.81 Park', bold: true },
      { text: ' is Korea’s first ', bold: false },
      { text: 'gravity-powered', bold: true },
      { text: ' kart facility', bold: false },
    ]);
  });

  it('spans newlines, since the briefings are multi-paragraph', () => {
    expect(splitEmphasis('a **b\nc** d').some((p) => p.bold && p.text === 'b\nc')).toBe(true);
  });

  it('leaves lone asterisks and underscores alone', () => {
    // Measurements and transliterations use them in real prose.
    expect(splitEmphasis('5 * 3 m and snake_case')).toEqual([
      { text: '5 * 3 m and snake_case', bold: false },
    ]);
  });

  it('is empty for empty input', () => {
    expect(splitEmphasis('')).toEqual([]);
    expect(splitEmphasis(null)).toEqual([]);
  });
});
