'use client';

import { useEffect, useRef } from 'react';
import { useI18n, type Locale } from '@/lib/i18n';
import { useCurrency } from '@/lib/currency';
import { defaultCurrencyForLocale, intlLocaleForUiLocale } from '@/lib/locale-currency';

/**
 * When the UI language changes (header switcher, locale home, etc.), align display currency
 * with that locale. Spanish is excluded by design. First paint keeps stored currency.
 * Number formatting locale always follows UI language for price strings.
 */
export function LocaleCurrencySync() {
  const { locale } = useI18n();
  const { setCurrency, setDisplayNumberLocale } = useCurrency();
  const prevLocaleRef = useRef<Locale | null>(null);

  useEffect(() => {
    setDisplayNumberLocale(intlLocaleForUiLocale(locale));
  }, [locale, setDisplayNumberLocale]);

  useEffect(() => {
    const prev = prevLocaleRef.current;
    prevLocaleRef.current = locale;
    if (prev === null) return;
    if (prev === locale) return;
    if (locale === 'es') return;
    const code = defaultCurrencyForLocale(locale);
    if (code) setCurrency(code);
  }, [locale, setCurrency]);

  return null;
}
