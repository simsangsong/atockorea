/**
 * P1-8 — proper-noun glossary.
 *
 * The reported defect: 감천문화마을 translated to 甘泉文化村 (spring) instead of
 * the confirmed 甘川文化村 (river). The knowledge base had the right name all
 * along; the model overrode it. Masking makes that impossible — the model never
 * sees the name, so the rendering comes from the KB, not from its priors.
 */
import {
  maskGlossaryTerms,
  restoreGlossaryTerms,
  glossaryToken,
  hasUnresolvedToken,
  collectUnknownProperNouns,
  type GlossaryEntry,
} from '@/lib/ai/glossary';
import { rowsToGlossaryEntries } from '@/lib/ai/glossary.server';

const GAMCHEON: GlossaryEntry = {
  key: 'gamcheon_culture_village',
  names: {
    en: 'Gamcheon Culture Village',
    ko: '감천문화마을',
    zh: '甘川文化村',
    'zh-TW': '甘川文化村',
    ja: '甘川文化村',
    es: 'Pueblo Cultural de Gamcheon',
  },
};

const JAGALCHI: GlossaryEntry = {
  key: 'jagalchi_market',
  names: { en: 'Jagalchi Market', ko: '자갈치시장', zh: '札嘎其市场' },
};

describe('P1-8 masking keeps proper nouns away from the model', () => {
  it('replaces the Korean name with an opaque token', () => {
    const { text, terms } = maskGlossaryTerms('오늘은 감천문화마을에 갑니다', [GAMCHEON]);
    expect(text).toBe(`오늘은 ${glossaryToken(0)}에 갑니다`);
    expect(text).not.toContain('감천');
    expect(terms).toHaveLength(1);
    expect(terms[0].entry.key).toBe('gamcheon_culture_village');
  });

  it('matches whichever language the name was written in, case-insensitively', () => {
    expect(maskGlossaryTerms('We visit gamcheon culture village today', [GAMCHEON]).terms).toHaveLength(1);
    expect(maskGlossaryTerms('明天去甘川文化村', [GAMCHEON]).terms).toHaveLength(1);
  });

  it('masks several POIs in one utterance and reuses one token per POI', () => {
    const { text, terms } = maskGlossaryTerms(
      '감천문화마을 다음에 자갈치시장, 그리고 다시 감천문화마을',
      [GAMCHEON, JAGALCHI],
    );
    expect(terms).toHaveLength(2);
    expect(text.match(/⟦G0⟧/g)).toHaveLength(2);
    expect(text).not.toContain('자갈치');
  });

  it('leaves text without known names untouched', () => {
    const { text, terms } = maskGlossaryTerms('버스가 10분 늦습니다', [GAMCHEON]);
    expect(text).toBe('버스가 10분 늦습니다');
    expect(terms).toEqual([]);
  });
});

describe('P1-8 restoring uses the confirmed name for the target locale', () => {
  it('🔴 renders 甘川文化村, never the 甘泉 mistranslation', () => {
    const { text, terms } = maskGlossaryTerms('오늘은 감천문화마을에 갑니다', [GAMCHEON]);
    // Whatever the model returns around the token, the name is ours.
    const modelOutput = `今天我们去${terms[0].token}。`;
    const restored = restoreGlossaryTerms(modelOutput, terms, 'zh');
    expect(restored).toBe('今天我们去甘川文化村。');
    expect(restored).not.toContain('甘泉');
    expect(text).not.toContain('감천문화마을');
  });

  it('falls back locale → base language → en → the original surface form', () => {
    const { terms } = maskGlossaryTerms('감천문화마을', [GAMCHEON]);
    expect(restoreGlossaryTerms(terms[0].token, terms, 'zh-CN')).toBe('甘川文化村'); // base zh
    expect(restoreGlossaryTerms(terms[0].token, terms, 'ja')).toBe('甘川文化村');

    const sparse = maskGlossaryTerms('자갈치시장', [JAGALCHI]);
    // No French name exists — English rather than an untranslated token.
    expect(restoreGlossaryTerms(sparse.terms[0].token, sparse.terms, 'fr')).toBe('Jagalchi Market');
  });

  it('never leaves a raw token in guest-visible text', () => {
    const { terms } = maskGlossaryTerms('감천문화마을 좋아요', [GAMCHEON]);
    const restored = restoreGlossaryTerms(`Go to ${terms[0].token} now`, terms, 'en');
    expect(hasUnresolvedToken(restored)).toBe(false);
    expect(restored).toBe('Go to Gamcheon Culture Village now');
  });
});

describe('P1-8 glossary is seeded from the POI knowledge base', () => {
  it('builds entries from match_pois rows, skipping ones with no usable name', () => {
    const entries = rowsToGlossaryEntries([
      {
        poi_key: 'gamcheon_culture_village',
        name_en: 'Gamcheon Culture Village',
        name_ko: null,
        names_other_locales: { zh: '甘川文化村', ja: '甘川文化村', es: 'Pueblo Cultural de Gamcheon' },
      },
      { poi_key: 'no_names', name_en: null, name_ko: null, names_other_locales: null },
      { poi_key: null, name_en: 'orphan', name_ko: null, names_other_locales: null },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].names.zh).toBe('甘川文化村');
    expect(entries[0].names.en).toBe('Gamcheon Culture Village');
    expect(entries[0].names.ko).toBeUndefined();
  });
});

describe('P1-8 uncovered proper nouns are collected for later', () => {
  it('reports place-like names the glossary does not know, and not ones it does', () => {
    const found = collectUnknownProperNouns('감천문화마을 다음에 해운대해수욕장에 갑니다', [GAMCHEON]);
    expect(found).toContain('해운대해수욕장');
    expect(found).not.toContain('감천문화마을');
  });
});
