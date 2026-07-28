/**
 * N6 — the entry locale has to be decidable identically on both sides of the
 * wire, because the moment the server and the browser disagree, React throws
 * away the server render. Measured on `/tour-mode` 2026-07-28 (dev, Playwright):
 *
 *   ko-KR → 1 hydration error · fr-FR → 1 · en-US → 0
 *
 * These cases are the header shapes real phones send, plus the two traps:
 * q-value ordering (a Korean phone lists English second, and picking the wrong
 * end serves English to a Korean guest) and zh-Hant, which is a different room
 * locale from zh.
 */
import {
  normalizeEntryLocale,
  entryLocaleFromCookieHeader,
  entryLocaleFromAcceptLanguage,
  resolveEntryLocale,
} from '@/lib/tour-room/entryLocale';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

describe('normalizeEntryLocale', () => {
  it('maps a regional tag onto its base room locale', () => {
    expect(normalizeEntryLocale('ko-KR')).toBe('ko');
    expect(normalizeEntryLocale('fr-CA')).toBe('fr');
    expect(normalizeEntryLocale('EN')).toBe('en');
  });

  it('routes traditional-script Chinese to zh-TW, not zh', () => {
    for (const tag of ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-TW']) {
      expect(normalizeEntryLocale(tag)).toBe('zh-TW');
    }
    expect(normalizeEntryLocale('zh-CN')).toBe('zh');
  });

  it('returns null for locales we do not serve, rather than a silent fallback', () => {
    expect(normalizeEntryLocale('th')).toBeNull();
    expect(normalizeEntryLocale('pt-BR')).toBeNull();
    expect(normalizeEntryLocale('')).toBeNull();
    expect(normalizeEntryLocale(undefined)).toBeNull();
  });

  it('accepts every locale the room actually ships', () => {
    for (const locale of ROOM_LOCALES) {
      expect(normalizeEntryLocale(locale)).toBe(locale);
    }
  });
});

describe('entryLocaleFromCookieHeader', () => {
  it('finds NEXT_LOCALE anywhere in the header', () => {
    expect(entryLocaleFromCookieHeader('NEXT_LOCALE=de')).toBe('de');
    expect(entryLocaleFromCookieHeader('a=1; NEXT_LOCALE=ja; b=2')).toBe('ja');
  });

  it('is not fooled by a cookie whose name merely ends in NEXT_LOCALE', () => {
    // `sb-NEXT_LOCALE=ru` must not be read as the app's own preference.
    expect(entryLocaleFromCookieHeader('sb-NEXT_LOCALE=ru')).toBeNull();
  });

  it('ignores an unsupported or empty value', () => {
    expect(entryLocaleFromCookieHeader('NEXT_LOCALE=th')).toBeNull();
    expect(entryLocaleFromCookieHeader('')).toBeNull();
    expect(entryLocaleFromCookieHeader(null)).toBeNull();
  });
});

describe('entryLocaleFromAcceptLanguage', () => {
  it('🔴 honours q-values — a Korean phone lists English second', () => {
    // Reading this list left-to-right by position alone still works here, but
    // the header below proves the ordering is real work, not decoration.
    expect(entryLocaleFromAcceptLanguage('ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7')).toBe('ko');
    expect(entryLocaleFromAcceptLanguage('en;q=0.4,ja;q=0.9')).toBe('ja');
  });

  it('skips languages we do not serve and takes the next best', () => {
    expect(entryLocaleFromAcceptLanguage('th-TH,th;q=0.9,fr;q=0.5')).toBe('fr');
  });

  it('ignores the wildcard and zero-quality entries', () => {
    expect(entryLocaleFromAcceptLanguage('*')).toBeNull();
    expect(entryLocaleFromAcceptLanguage('de;q=0,en;q=0.5')).toBe('en');
  });

  it('handles the header being absent or junk', () => {
    expect(entryLocaleFromAcceptLanguage(undefined)).toBeNull();
    expect(entryLocaleFromAcceptLanguage('')).toBeNull();
    expect(entryLocaleFromAcceptLanguage(',,,')).toBeNull();
  });
});

describe('resolveEntryLocale', () => {
  it('prefers the cookie — an in-app choice beats the phone setting', () => {
    expect(
      resolveEntryLocale({ cookieHeader: 'NEXT_LOCALE=es', acceptLanguage: 'ko-KR,ko;q=0.9' }),
    ).toBe('es');
  });

  it('falls back to the phone, then to English', () => {
    expect(resolveEntryLocale({ acceptLanguage: 'de-DE,de;q=0.9' })).toBe('de');
    expect(resolveEntryLocale({})).toBe('en');
    expect(resolveEntryLocale({ cookieHeader: 'NEXT_LOCALE=th', acceptLanguage: 'th' })).toBe('en');
  });

  it('agrees with the client-side order the browser will use', () => {
    // detectEntryLocale() checks cookie first, then navigator.language. If these
    // two ever diverge the hydration error comes straight back, so the ordering
    // is pinned here rather than left to reviewers to notice.
    const cookieWins = resolveEntryLocale({
      cookieHeader: 'NEXT_LOCALE=ja',
      acceptLanguage: 'fr-FR,fr;q=0.9',
    });
    expect(cookieWins).toBe('ja');
  });
});
