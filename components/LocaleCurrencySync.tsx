'use client';

import { useEffect, useRef } from 'react';
import { useI18n, type Locale } from '@/lib/i18n';
import { useCurrency } from '@/lib/currency';
import { defaultCurrencyForLocale } from '@/lib/locale-currency';

/**
 * When the UI language changes (header switcher, locale home, etc.), align display currency
 * with that locale. Spanish is excluded by design. First paint keeps stored currency.
 */
export function LocaleCurrencySync() {
  const { locale } = useI18n();
  const { setCurrency } = useCurrency();
  const prevLocaleRef = useRef<Locale | null>(null);

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
