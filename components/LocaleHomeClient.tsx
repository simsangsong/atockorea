'use client';

import { useEffect, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';

type LocaleHomeClientProps = {
  locale: 'ko' | 'zh' | 'zh-TW' | 'ja' | 'es';
  children: ReactNode;
};

export function LocaleHomeClient({ locale, children }: LocaleHomeClientProps) {
  const { setLocale } = useI18n();

  useEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);

  return <>{children}</>;
}
