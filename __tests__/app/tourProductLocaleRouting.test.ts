/**
 * P1-7 — no site locale may 404 on a product detail page.
 *
 * middleware.ts SUPPORTED_LOCALES grew to 10 when fr/de/it/ru were added with
 * their messages/*.json, but the product page's own whitelist stayed at 5, so
 * /fr/tour-product/<slug> routed fine and then called notFound(). The fix at
 * the time was a fallback, not a wider whitelist — listing a locale with no
 * rows would have served an empty page.
 *
 * 🔴 2026-08-08: fr/de/it/ru now HAVE rows (all 21 live slugs, verified by DB
 * join), so they moved out of the fallback list and into the served list. The
 * assertion that used to pin the trap open ("fr must not be served") is gone —
 * it described a content gap that no longer exists.
 *
 * The invariant this file guards is unchanged and is what matters: every locale
 * the site routes must either resolve to a db locale or be declared an
 * English-fallback locale. Adding a locale to middleware without doing one of
 * the two fails here instead of in production.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TOUR_PRODUCT_URL_LOCALES,
  TOUR_PRODUCT_FALLBACK_URL_LOCALES,
  tourProductDbLocaleFromUrlLocale,
  tourProductLocaleNeedsEnglishFallback,
} from '@/app/(marketing)/tour-product/[slug]/tourProductPageBody';

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

  it('every locale the middleware advertises is actually served by this page', () => {
    expect(supported).toEqual(expect.arrayContaining(['fr', 'de', 'it', 'ru']));
    // The four expansion locales are served, not redirected to English.
    for (const locale of ['fr', 'de', 'it', 'ru']) {
      expect(tourProductDbLocaleFromUrlLocale(locale)).toBe(locale);
      expect(tourProductLocaleNeedsEnglishFallback(locale)).toBe(false);
    }
    // Nothing is parked in the fallback list right now — if a future locale
    // lands in middleware before its rows exist, it belongs there, not here.
    expect(TOUR_PRODUCT_FALLBACK_URL_LOCALES).toEqual([]);
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
