'use client';

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from './supabase';

export type Locale = 'en' | 'ko' | 'zh' | 'zh-TW' | 'es' | 'ja';

export const locales: Locale[] = ['en', 'ko', 'zh', 'zh-TW', 'es', 'ja'];
export const defaultLocale: Locale = 'en';

const localeNames: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
  zh: '中文 (简体)',
  'zh-TW': '中文 (繁體)',
  es: 'Español',
  ja: '日本語',
};

// Import translations directly (Next.js handles JSON imports)
import enMessages from '@/messages/en.json';
import koMessages from '@/messages/ko.json';
import zhMessages from '@/messages/zh.json';

// Import new language files - Next.js should handle these
// If import fails, we'll use fallback in the messages object
let zhTWMessages: any = zhMessages;
let esMessages: any = enMessages;
let jaMessages: any = enMessages;

try {
  // @ts-ignore - Dynamic import for files with hyphens
  zhTWMessages = require('@/messages/zh-TW.json');
} catch (e) {
  console.warn('Could not load zh-TW.json, using zh.json as fallback');
}

try {
  esMessages = require('@/messages/es.json');
} catch (e) {
  console.warn('Could not load es.json, using en.json as fallback');
}

try {
  jaMessages = require('@/messages/ja.json');
} catch (e) {
  console.warn('Could not load ja.json, using en.json as fallback');
}

const messages: Record<Locale, any> = {
  en: enMessages,
  ko: koMessages,
  zh: zhMessages,
  'zh-TW': zhTWMessages,
  es: esMessages,
  ja: jaMessages,
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  localeNames: typeof localeNames;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load saved locale from localStorage or user settings
    const loadLocale = async () => {
      try {
        // Try to get from localStorage first
        const savedLocale = localStorage.getItem('locale') as Locale;
        if (savedLocale && locales.includes(savedLocale)) {
          setLocaleState(savedLocale);
          setLoading(false);
          return;
        }

        // Try to get from user settings if logged in
        const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
        if (session) {
          const { data: profile } = await supabase
            ?.from('user_profiles')
            .select('language_preference')
            .eq('id', session.user.id)
            .single() || { data: null };

          if (profile?.language_preference && locales.includes(profile.language_preference as Locale)) {
            const userLocale = profile.language_preference as Locale;
            setLocaleState(userLocale);
            localStorage.setItem('locale', userLocale);
            setLoading(false);
            return;
          }
        }

        // Use browser language
        const browserLang = navigator.language;
        const langCode = browserLang.split('-')[0];
        const fullLang = browserLang.toLowerCase();
        
        // Check for specific locales
        if (fullLang.startsWith('zh-tw') || fullLang.startsWith('zh-hant')) {
          setLocaleState('zh-TW');
        } else if (langCode === 'ko') {
          setLocaleState('ko');
        } else if (langCode === 'zh') {
          setLocaleState('zh');
        } else if (langCode === 'es') {
          setLocaleState('es');
        } else if (langCode === 'ja') {
          setLocaleState('ja');
        } else {
          setLocaleState(defaultLocale);
        }
      } catch (error) {
        console.error('Error loading locale:', error);
        setLocaleState(defaultLocale);
      } finally {
        setLoading(false);
      }
    };

    loadLocale();
  }, []);

  const setLocale = async (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);

    // Update user settings if logged in
    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      if (session) {
        await supabase
          ?.from('user_profiles')
          .update({ language_preference: newLocale })
          .eq('id', session.user.id);
      }
    } catch (error) {
      console.error('Error updating user language preference:', error);
    }
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = messages[locale];

    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        // Fallback to English
        let fallbackValue: any = messages.en;
        for (const fk of keys) {
          fallbackValue = fallbackValue?.[fk];
        }
        value = fallbackValue || key;
        break;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    // Replace parameters
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey]?.toString() || match;
      });
    }

    return value;
  };

  if (loading) {
    return <React.Fragment>{children}</React.Fragment>;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, localeNames }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

export function useTranslations(namespace?: string) {
  const { t } = useI18n();
  
  return (key: string, params?: Record<string, string | number>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    return t(fullKey, params);
  };
}
