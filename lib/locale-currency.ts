import type { Locale } from '@/lib/i18n';
import type { CurrencyCode } from '@/lib/currency';

/** BCP 47 tag for `Intl.NumberFormat` / `Intl.DateTimeFormat` from UI language. */
export function intlLocaleForUiLocale(locale: Locale): string {
  switch (locale) {
    case 'en':
      return 'en-US';
    case 'ko':
      return 'ko-KR';
    case 'zh':
      return 'zh-CN';
    case 'zh-TW':
      return 'zh-TW';
    case 'ja':
      return 'ja-JP';
    case 'es':
      return 'es-ES';
    default:
      return 'en-US';
  }
}

/**
 * Default display currency when the user switches UI language.
 * Spanish (`es`) has no mapping — caller should leave currency unchanged.
 */
export function defaultCurrencyForLocale(locale: Locale): CurrencyCode | null {
  switch (locale) {
    case 'en':
      return 'USD';
    case 'ko':
      return 'KRW';
    case 'zh':
      return 'CNY';
    case 'zh-TW':
      return 'TWD';
    case 'ja':
      return 'JPY';
    case 'es':
      return null;
    default:
      return null;
  }
}
