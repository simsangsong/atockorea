/**
 * Grounding tests for the POI intro script (plan §14.3).
 *
 * The contract under test is the repo's hard rule for generated travel copy:
 * a factual claim comes from the source data or it is omitted. These tests
 * exercise it from both directions — a model draft that invents hours/prices
 * must lose those sentences, and a claim that IS in the source must survive.
 */

import {
  buildFactSheet,
  detectClaims,
  splitSentences,
  stripUnsupportedClaims,
} from '@/lib/video-automation/poiFacts';
import {
  assembleGroundedScript,
  buildPoiScriptPrompt,
  parsePoiScriptJson,
} from '@/lib/video-automation/poiScript';
import {
  localizedFromGeneratedSpot,
  localizedFromMatchPoi,
  mergePoiSources,
  sourceFromDbRows,
} from '@/lib/video-automation/poiDbSource';
import type { VideoPoiSource } from '@/lib/video-automation/types';

const source: VideoPoiSource = {
  poiId: 'jagalchi_market',
  canonicalName: 'Jagalchi Market',
  tourSlug: 'busan-day-tour',
  sourcePaths: ['components/product-tour-static/busan-day-tour/busan-day-tour.en.json'],
  localized: {
    en: {
      language: 'en',
      sourceLocale: 'en',
      name: 'Jagalchi Market',
      category: 'Seafood market by Busan harbour.',
      description:
        "Jagalchi Market is Korea's largest seafood market, spread along the Nampo-dong waterfront.",
      highlights: ['Watch the auction floor on the ground level.', 'Second-floor restaurants cook what you pick.'],
      visitBasics: { walking: 'Allow 45 minutes for a full loop.' },
      smartNotes: { photo: 'The harbour side catches the best morning light.' },
      sourceFactIds: ['file:components/product-tour-static/busan-day-tour/busan-day-tour.en.json'],
    },
  },
};

describe('claim detection', () => {
  it('flags times, prices, phone numbers, measurements, years and superlatives', () => {
    const kinds = (text: string) => detectClaims(text).map((claim) => claim.kind);
    expect(kinds('Open from 09:00 every day.')).toContain('time');
    expect(kinds('Entry costs ₩5,000.')).toContain('money');
    expect(kinds('Call 051-245-2594 to book.')).toContain('phone');
    expect(kinds('It is 300 m from the subway.')).toContain('measurement');
    expect(kinds('Founded in 1889.')).toContain('year');
    expect(kinds('It is the largest market in Korea.')).toContain('superlative');
    expect(kinds('Free admission all year.')).toEqual(expect.arrayContaining(['admission']));
  });

  it('leaves atmosphere and sensory copy alone', () => {
    expect(detectClaims('Salt air, shouting traders, and crates of live fish.')).toHaveLength(0);
  });

  it('splits on CJK terminators as well as Latin ones', () => {
    expect(splitSentences('朝の光がきれいです。海側へ歩きましょう。')).toHaveLength(2);
    expect(splitSentences('One. Two! Three?')).toHaveLength(3);
  });
});

describe('stripUnsupportedClaims', () => {
  const sheet = buildFactSheet(source, 'en');

  it('drops a sentence whose price is nowhere in the facts', () => {
    const result = stripUnsupportedClaims(
      'The market opens early. Entry costs ₩5,000 per person.',
      sheet,
    );
    expect(result.text).toBe('The market opens early.');
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].claim.kind).toBe('money');
  });

  it('drops invented opening hours', () => {
    const result = stripUnsupportedClaims('Stalls trade from 05:00 until late.', sheet);
    expect(result.text).toBe('');
    expect(result.removed[0].claim.kind).toBe('time');
  });

  it('keeps a superlative that the source itself makes', () => {
    const result = stripUnsupportedClaims("It is Korea's largest seafood market.", sheet);
    expect(result.text).toContain('largest');
    expect(result.removed).toHaveLength(0);
  });

  it('keeps a measurement the source states', () => {
    const result = stripUnsupportedClaims('Allow 45 minutes for a full loop.', sheet);
    expect(result.removed).toHaveLength(0);
  });

  it('drops bare numbers the facts never state, even without a unit', () => {
    const result = stripUnsupportedClaims('The crater is ringed by 99 jagged rocks.', sheet);
    expect(result.text).toBe('');
    expect(result.removed[0].claim.kind).toBe('quantity');
  });

  it('does not let a substring of another number license a claim', () => {
    const withYear = buildFactSheet(
      {
        ...source,
        localized: {
          en: {
            ...source.localized.en!,
            description: 'The market moved to its current hall in 1990.',
          },
        },
      },
      'en',
    );
    // "90" occurs inside "1990" but is not a number the source states.
    expect(stripUnsupportedClaims('The hall is 90 m long.', withYear).removed).toHaveLength(1);
    expect(stripUnsupportedClaims('The hall opened in 1990.', withYear).removed).toHaveLength(0);
  });
});

describe('assembleGroundedScript', () => {
  it('removes unsupported claims from an LLM draft but keeps the supported half', () => {
    const result = assembleGroundedScript(source, 'en', {
      identity: 'A seafood market on the Busan waterfront.',
      background: "It is Korea's largest seafood market. It was founded in 1889.",
      must_see: 'The ground-floor auction floor. Tickets cost ₩12,000.',
      visit_tip: 'Go early for the morning light.',
    });

    const narration = result.script.scenes.map((scene) => scene.narration);
    expect(narration[2]).toContain('largest');
    expect(narration[2]).not.toContain('1889');
    expect(narration[3]).not.toContain('12,000');
    expect(narration[3]).toContain('auction floor');
    expect(result.narrationSource).toBe('llm');
    expect(result.removedClaims.map((entry) => entry.kind).sort()).toEqual(['money', 'year']);
  });

  it('never filters the fixed brand hook and CTA', () => {
    const result = assembleGroundedScript(source, 'en', null);
    // "in 60 seconds" is about the film, not a claim about the market.
    expect(result.script.scenes[0].narration).toContain('60 seconds');
    expect(result.script.scenes[5].narration).toContain('ATOCKOREA');
    expect(result.removedClaims).toHaveLength(0);
  });

  it('falls back to template narration when there is no draft', () => {
    const result = assembleGroundedScript(source, 'en', null);
    expect(result.narrationSource).toBe('template');
    expect(result.script.scenes).toHaveLength(6);
    expect(result.script.scenes[1].narration.length).toBeGreaterThan(0);
  });

  it('leaves a scene silent rather than inventing filler', () => {
    const bare: VideoPoiSource = {
      ...source,
      localized: {
        en: {
          language: 'en',
          sourceLocale: 'en',
          name: 'Nameless Lookout',
          highlights: [],
          sourceFactIds: [],
        },
      },
    };
    const result = assembleGroundedScript(bare, 'en', {
      identity: 'Admission is ₩3,000.',
      background: 'It opened in 1974.',
    });
    expect(result.script.scenes[1].narration).toBe('');
    expect(result.script.scenes[2].narration).toBe('');
    expect(result.emptyScenes.length).toBeGreaterThanOrEqual(2);
  });
});

describe('prompt + parsing hygiene', () => {
  it('lists every fact with its field so the model can cite nothing else', () => {
    const prompt = buildPoiScriptPrompt(buildFactSheet(source, 'en'));
    expect(prompt.user).toContain('highlights[0]');
    expect(prompt.user).toContain('the only permitted source of factual claims');
    expect(prompt.system).toContain('OMITTED');
  });

  it('parses fenced JSON and ignores unknown keys', () => {
    const parsed = parsePoiScriptJson('```json\n{"identity":"A market.","junk":"x"}\n```');
    expect(parsed).toEqual({ identity: 'A market.' });
  });

  it('returns null on garbage', () => {
    expect(parsePoiScriptJson('sorry, I cannot help with that')).toBeNull();
    expect(parsePoiScriptJson('{"identity": 42}')).toBeNull();
  });
});

describe('DB-backed sources', () => {
  const matchPoi = {
    poi_key: 'haedong_yonggungsa',
    name_en: 'Haedong Yonggungsa',
    content_locales: {
      ja: { name: '海東龍宮寺', description: '海沿いに建つ寺院です。', highlights: ['海に面した本堂。'] },
    },
    region: 'busan',
    description: 'A seaside temple on the Busan coast.',
    highlights: ['The main hall faces the sea.'],
    images: ['/images/pois/haedong/1.webp'],
  };

  it('prefers the per-locale block and falls back to the row columns', () => {
    expect(localizedFromMatchPoi(matchPoi, 'ja')?.name).toBe('海東龍宮寺');
    expect(localizedFromMatchPoi(matchPoi, 'ja')?.sourceLocale).toBe('ja');
    expect(localizedFromMatchPoi(matchPoi, 'en')?.description).toContain('seaside temple');
    expect(localizedFromMatchPoi(matchPoi, 'en')?.sourceLocale).toBe('en');
  });

  it('returns null when a row carries nothing narratable', () => {
    expect(localizedFromMatchPoi({ poi_key: 'empty', name_en: 'Empty' }, 'en')).toBeNull();
  });

  it('reads the generated tier by room locale (zh-Hant → zh)', () => {
    const row = {
      poi_ref: 'poi:some_spot',
      title: 'Some Spot',
      status: 'ready',
      content_locales: { zh: { description: '一個安靜的觀景點。' } },
    };
    expect(localizedFromGeneratedSpot(row, 'zh-Hant')?.description).toBe('一個安靜的觀景點。');
    expect(localizedFromGeneratedSpot({ ...row, status: 'failed' }, 'zh-Hant')).toBeNull();
  });

  it('lets file content win over DB content for the same language', () => {
    const dbSource = sourceFromDbRows({ poiKey: 'jagalchi_market', matchPoi });
    const merged = mergePoiSources(source, dbSource);
    expect(merged?.localized.en?.sourcePath).toBeUndefined();
    expect(merged?.localized.en?.description).toContain('Nampo-dong');
  });
});
