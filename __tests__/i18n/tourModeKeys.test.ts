/**
 * T1.8 — tourMode.* i18n key parity across every site locale (AC: 키 누락 0).
 * The standalone /tour-mode pages ship their own bundled 5-locale constants
 * (§O-1 ② — no site i18n shell); these messages/* keys serve main-site
 * surfaces (nav links, mypage cards) that point INTO tour mode.
 */
import en from '@/messages/en.json';
import ko from '@/messages/ko.json';
import ja from '@/messages/ja.json';
import es from '@/messages/es.json';
import zh from '@/messages/zh.json';
import zhTW from '@/messages/zh-TW.json';

const LOCALES: Record<string, Record<string, unknown>> = {
  en, ko, ja, es, zh, 'zh-TW': zhTW,
};

describe('tourMode i18n namespace', () => {
  const reference = Object.keys((en as { tourMode: Record<string, string> }).tourMode).sort();

  it('exists with a non-empty reference key set', () => {
    expect(reference.length).toBeGreaterThan(0);
  });

  it.each(Object.keys(LOCALES))('locale %s carries the exact same tourMode keys, all non-empty', (locale) => {
    const bundle = LOCALES[locale].tourMode as Record<string, string> | undefined;
    expect(bundle).toBeDefined();
    expect(Object.keys(bundle!).sort()).toEqual(reference);
    for (const key of reference) {
      expect(typeof bundle![key]).toBe('string');
      expect(bundle![key].trim().length).toBeGreaterThan(0);
    }
  });
});
