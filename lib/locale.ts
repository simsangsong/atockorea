export type Locale = 'en' | 'ko' | 'zh' | 'zh-TW' | 'es' | 'ja';

export const locales: Locale[] = ['en', 'ko', 'zh', 'zh-TW', 'es', 'ja'];

export const defaultLocale: Locale = 'en';

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
  zh: '中文 (简体)',
  'zh-TW': '中文 (繁體)',
  es: 'Español',
  ja: '日本語',
};

/**
 * Export/Import 쿼리 `?locale=` / `?applyLocale=` — URL 관례(`zh-CN`)와 앱 `Locale`(`zh`) 불일치 보정.
 * 일치하지 않으면 null.
 */
export function normalizeLocaleQueryParam(value: string | null | undefined): Locale | null {
  if (value === undefined || value === null) return null;
  const v = String(value).trim();
  if (v === '' || v === 'zh-CN') return 'zh';
  if (locales.includes(v as Locale)) return v as Locale;
  return null;
}

/** Path segment (`zh-CN`, `ko`, …) → app `Locale` (middleware). */
export function appLocaleFromPathSegment(segment: string): Locale | null {
  if (segment === 'zh-CN') return 'zh';
  if (segment === 'zh-TW') return 'zh-TW';
  if (locales.includes(segment as Locale)) return segment as Locale;
  return null;
}

/** `NEXT_LOCALE` cookie uses middleware segments (`zh-CN`); app `Locale` uses `zh`. */
export function localeFromCookieValue(value: string | undefined): Locale | undefined {
  if (!value) return undefined;
  if (value === 'zh-CN') return 'zh';
  if (locales.includes(value as Locale)) return value as Locale;
  return undefined;
}

/** BCP 47 tag for `Intl` date/number formatting */
export const localeToBcp47: Record<Locale, string> = {
  en: 'en-US',
  ko: 'ko-KR',
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  es: 'es-ES',
  ja: 'ja-JP',
};

/** BCP 47 `lang` for `<html lang>` */
export function htmlLangFromLocale(locale: Locale): string {
  const map: Record<Locale, string> = {
    en: 'en',
    ko: 'ko',
    zh: 'zh-CN',
    'zh-TW': 'zh-TW',
    es: 'es',
    ja: 'ja',
  };
  return map[locale] ?? 'en';
}
