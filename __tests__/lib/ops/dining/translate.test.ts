/**
 * Translation + verbatim menu extraction (§5.7, spec K2/K3).
 *
 * The hard rule under test: a dish name reaches a guest ONLY if a reviewer
 * literally wrote it. The LLM critic is a first pass; `filterMenusToReviewText`
 * is the gate that actually guarantees it, because the critic can be skipped
 * (budget), fail (outage), or hallucinate on its own.
 */

import {
  DINING_LOCALES,
  buildMenuCriticPrompt,
  buildTranslationPrompt,
  filterMenusToReviewText,
  parseCriticJson,
  parseTranslationJson,
} from '@/lib/ops/dining/translate.server';

const KEYS = ['kakao:1', 'kakao:2'];

describe('DINING_LOCALES', () => {
  it('is the 10 site locales, matching middleware SUPPORTED_LOCALES', () => {
    expect([...DINING_LOCALES]).toEqual(['en', 'ko', 'zh-CN', 'zh-TW', 'ja', 'es', 'fr', 'de', 'it', 'ru']);
  });
});

describe('buildTranslationPrompt', () => {
  it('states the verbatim menu rule and the empty-array escape', () => {
    const { system, user } = buildTranslationPrompt({
      places: [{ place_key: 'kakao:1', name: '올레국수', review_text: '고기국수 최고' }],
      locales: DINING_LOCALES,
    });
    expect(system).toMatch(/STRICT JSON/);
    expect(system).toMatch(/LITERALLY/);
    expect(system).toMatch(/EMPTY ARRAY/);
    expect(user).toContain('kakao:1');
    expect(user).toContain('올레국수');
    expect(user).toContain('고기국수 최고');
    expect(user).toContain('zh-TW');
  });

  it('truncates very long review bundles', () => {
    const { user } = buildTranslationPrompt({
      places: [{ place_key: 'kakao:1', name: 'x', review_text: 'ㄱ'.repeat(5000) }],
      locales: ['en'],
    });
    expect(user.length).toBeLessThan(2500);
  });
});

describe('buildMenuCriticPrompt', () => {
  it('instructs deletion-only, never rewriting', () => {
    const { system, user } = buildMenuCriticPrompt({
      places: [{ place_key: 'kakao:1', review_text: '고기국수 최고', menus: ['고기국수', '전복죽'] }],
    });
    expect(system).toMatch(/KEEP a dish name only if/);
    expect(system).toMatch(/Do not add anything/);
    expect(user).toContain('전복죽');
  });
});

describe('parseTranslationJson', () => {
  it('parses a clean payload', () => {
    const raw = JSON.stringify({
      'kakao:1': { name_i18n: { en: 'Olle Guksu', ja: 'オルレグクス' }, signature_menus: ['고기국수'] },
    });
    expect(parseTranslationJson(raw, KEYS)).toEqual({
      'kakao:1': { name_i18n: { en: 'Olle Guksu', ja: 'オルレグクス' }, signature_menus: ['고기국수'] },
    });
  });

  it('strips markdown fences and surrounding chatter', () => {
    const raw = 'Sure! ```json\n{"kakao:1":{"name_i18n":{"en":"A"},"signature_menus":[]}}\n``` done';
    expect(parseTranslationJson(raw, KEYS)?.['kakao:1'].name_i18n).toEqual({ en: 'A' });
  });

  it('drops unknown place keys and unknown locales', () => {
    const raw = JSON.stringify({
      'kakao:1': { name_i18n: { en: 'A', klingon: 'B', '': 'C' }, signature_menus: [] },
      'kakao:hallucinated': { name_i18n: { en: 'Nope' }, signature_menus: [] },
    });
    const parsed = parseTranslationJson(raw, KEYS);
    expect(Object.keys(parsed ?? {})).toEqual(['kakao:1']);
    expect(parsed?.['kakao:1'].name_i18n).toEqual({ en: 'A' });
  });

  it('caps menus at 3, de-duplicates, and ignores non-strings', () => {
    const raw = JSON.stringify({
      'kakao:1': { name_i18n: {}, signature_menus: ['a', 'a', 'b', 'c', 'd', 42, null] },
    });
    expect(parseTranslationJson(raw, KEYS)?.['kakao:1'].signature_menus).toEqual(['a', 'b', 'c']);
  });

  it('returns null on unusable output instead of throwing', () => {
    expect(parseTranslationJson('', KEYS)).toBeNull();
    expect(parseTranslationJson('not json at all', KEYS)).toBeNull();
    expect(parseTranslationJson('{ broken', KEYS)).toBeNull();
    expect(parseTranslationJson('[1,2,3]', KEYS)).toBeNull();
    expect(parseTranslationJson(JSON.stringify({ 'kakao:unknown': {} }), KEYS)).toBeNull();
  });
});

describe('parseCriticJson', () => {
  it('reads the pruned lists and ignores unknown keys', () => {
    const raw = JSON.stringify({ 'kakao:1': ['고기국수'], 'kakao:9': ['x'] });
    expect(parseCriticJson(raw, KEYS)).toEqual({ 'kakao:1': ['고기국수'] });
  });

  it('is null on garbage', () => {
    expect(parseCriticJson('nope', KEYS)).toBeNull();
  });
});

describe('filterMenusToReviewText — the K3 gate', () => {
  const reviews = '고기국수가 정말 맛있어요.\n---\nThe abalone porridge was fine but the noodles are the star.';

  it('🔴 strips a hallucinated dish the critic let through', () => {
    expect(filterMenusToReviewText(['고기국수', '흑돼지 오겹살'], reviews)).toEqual(['고기국수']);
  });

  it('matches case-insensitively and ignores whitespace runs', () => {
    expect(filterMenusToReviewText(['ABALONE   PORRIDGE'], reviews)).toEqual(['ABALONE   PORRIDGE']);
  });

  it('🔴 keeps nothing when there are no reviews at all', () => {
    expect(filterMenusToReviewText(['고기국수'], '')).toEqual([]);
    expect(filterMenusToReviewText(['고기국수'], null)).toEqual([]);
    expect(filterMenusToReviewText(['고기국수'], undefined)).toEqual([]);
  });

  it('ignores empty and non-string entries', () => {
    expect(filterMenusToReviewText(['', '   ', 고기국수Junk()], reviews)).toEqual([]);
  });
});

// A deliberately non-string entry, kept out of the array literal for clarity.
function 고기국수Junk(): string {
  return undefined as unknown as string;
}
