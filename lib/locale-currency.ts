import type { Locale } from '@/lib/i18n';
import type { CurrencyCode } from '@/lib/currency';

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
