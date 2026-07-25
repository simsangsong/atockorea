/**
 * P1-7 — no site locale may 404 on a product detail page.
 *
 * middleware.ts SUPPORTED_LOCALES grew to 10 when fr/de/it/ru were added with
 * their messages/*.json, but the product page's own whitelist stayed at 5, so
 * /fr/tour-product/<slug> routed fine and then called notFound().
 *
 * tour_product_pages only holds en/ko/ja/es/zh/zh-TW (verified live: 34 slugs
 * each, zero rows for fr/de/it/ru), so the fix is a fallback, not a wider
 * whitelist — listing a locale we cannot render would serve an empty page.
 *
 * This test is the guard: every locale the site routes must either resolve to a
 * db locale or be declared an English-fallback locale. Adding a locale to
 * middleware without doing one of the two fails here instead of in production.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TOUR_PRODUCT_URL_LOCALES,
  TOUR_PRODUCT_FALLBACK_URL_LOCALES,
  tourProductDbLocaleFromUrlLocale,
  tourProductLocaleNeedsEnglishFallback,
} from '@/app/tour-product/[slug]/tourProductPageBody';

/** Read SUPPORTED_LOCALES straight out of middleware.ts — the real source. */
function supportedLocalesFromMiddleware(): string[] {
  const source = readFileSync(join(process.cwd(), 'middleware.ts'), 'utf8');
  const match = source.match(/const SUPPORTED_LOCALES = \[([^\]]+)\]/);
  if (!match) throw new Error('SUPPORTED_LOCALES not found in middleware.ts');
  return match[1]
    .split(',')
    .map((token) => token.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

describe('P1-7 product detail routing covers every site locale', () => {
  const supported = supportedLocalesFromMiddleware();

  it('middleware advertises more locales than the page can render (the trap)', () => {
    expect(supported).toEqual(expect.arrayContaining(['fr', 'de', 'it', 'ru']));
    expect(TOUR_PRODUCT_URL_LOCALES).not.toEqual(expect.arrayContaining(['fr']));
  });

  it.each(supportedLocalesFromMiddleware())('%s resolves or falls back — never 404', (locale) => {
    if (locale === 'en') return; // canonical bare path
    const handled =
      tourProductDbLocaleFromUrlLocale(locale) !== null ||
      tourProductLocaleNeedsEnglishFallback(locale);
    expect(handled).toBe(true);
  });

  it('maps zh-CN onto the zh rows and leaves the other content locales alone', () => {
    expect(tourProductDbLocaleFromUrlLocale('zh-CN')).toBe('zh');
    expect(tourProductDbLocaleFromUrlLocale('zh-TW')).toBe('zh-TW');
    expect(tourProductDbLocaleFromUrlLocale('ko')).toBe('ko');
  });

  it('never marks a content locale as a fallback locale', () => {
    for (const locale of TOUR_PRODUCT_URL_LOCALES) {
      expect(tourProductLocaleNeedsEnglishFallback(locale)).toBe(false);
    }
    for (const locale of TOUR_PRODUCT_FALLBACK_URL_LOCALES) {
      expect(tourProductDbLocaleFromUrlLocale(locale)).toBeNull();
    }
  });

  it('an unknown locale is still not silently served', () => {
    expect(tourProductDbLocaleFromUrlLocale('xx')).toBeNull();
    expect(tourProductLocaleNeedsEnglishFallback('xx')).toBe(false);
  });
});
