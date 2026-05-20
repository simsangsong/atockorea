'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext, ReactNode } from 'react';
import { getCopy } from '@/lib/copy-messages';
import type { Copy } from '@/src/design/copy';
// Do not static-import supabase here: it triggers server bundle of @supabase/supabase-js
// and causes "Cannot find module './vendor-chunks/@supabase.js'". Use dynamic import in client-only code.

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

/**
 * Locale messages — code-split for bundle diet (2026-05-20).
 *
 * Previously all 6 locale JSON files (~865KB total) were static-imported into
 * every page bundle. Now ONLY English (~152KB) is bundled synchronously — it's
 * required for SSR (the provider always renders `defaultLocale` server-side) and
 * as the universal fallback. The other 5 locales are lazy-loaded via dynamic
 * import the first time their locale becomes active, so a visitor only ever
 * downloads English + (at most) their own language, never the other four.
 *
 * `t()` reads from this mutable map and falls back to English for any locale
 * whose chunk hasn't resolved yet (a brief, graceful fallback during the async
 * load — the same en→locale transition that already happened on hydration).
 */
import enMessages from '@/messages/en.json';

const messages: Partial<Record<Locale, any>> = { en: enMessages };

const localeLoaders: Record<Exclude<Locale, 'en'>, () => Promise<{ default: any }>> = {
  ko: () => import('@/messages/ko.json'),
  zh: () => import('@/messages/zh.json'),
  // @ts-ignore — hyphenated filename resolves fine at runtime
  'zh-TW': () => import('@/messages/zh-TW.json'),
  es: () => import('@/messages/es.json'),
  ja: () => import('@/messages/ja.json'),
};

const localeLoadPromises: Partial<Record<Locale, Promise<void>>> = {};

/** Ensure a locale's messages are loaded. Resolves immediately if already present. */
function ensureLocaleMessages(loc: Locale): Promise<void> {
  if (messages[loc]) return Promise.resolve();
  if (localeLoadPromises[loc]) return localeLoadPromises[loc]!;
  const loader = localeLoaders[loc as Exclude<Locale, 'en'>];
  if (!loader) return Promise.resolve();
  const p = loader()
    .then((mod) => {
      messages[loc] = (mod as any).default ?? mod;
    })
    .catch(() => {
      // Network/parse failure — keep English fallback (graceful, no crash).
      console.warn(`[i18n] failed to load ${loc} messages — using English fallback`);
    });
  localeLoadPromises[loc] = p;
  return p;
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  localeNames: typeof localeNames;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  // Initialize with default locale immediately to avoid SSR issues
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [loading, setLoading] = useState(false); // Start with false for immediate context provision
  // Tracks explicit user-initiated locale changes. Once true, the initial loadLocale()
  // async chain (localStorage → supabase profile → navigator.language fallback) must
  // NOT override the user's choice. Without this guard, a click made before the chain
  // completes was being silently reverted — the "first ~5 clicks ignored" bug.
  const userOverrideRef = useRef(false);
  // Bumped when a lazily-loaded locale chunk resolves, forcing a re-render so
  // `t()` picks up the now-populated messages (until then it falls back to en).
  const [, setMsgVersion] = useState(0);

  // Lazy-load the active locale's messages (code-split). en is always present.
  useEffect(() => {
    if (locale === 'en' || messages[locale]) return;
    let alive = true;
    void ensureLocaleMessages(locale).then(() => {
      if (alive) setMsgVersion((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, [locale]);

  useEffect(() => {
    // Update HTML lang attribute and body class based on locale
    if (typeof window !== 'undefined') {
      document.documentElement.lang = locale;
      document.body.setAttribute('lang', locale);
      // Remove old locale classes
      document.body.classList.remove('lang-en', 'lang-ko', 'lang-zh', 'lang-zh-TW', 'lang-es', 'lang-ja');
      // Add current locale class
      document.body.classList.add(`lang-${locale}`);
    }
  }, [locale]);

  useEffect(() => {
    // Load saved locale from localStorage or user settings
    const loadLocale = async () => {
      try {
        // Check if we're on the client side
        if (typeof window === 'undefined') {
          setLocaleState(defaultLocale);
          setLoading(false);
          return;
        }

        // Try to get from localStorage first
        const savedLocale = localStorage.getItem('locale') as Locale;
        if (savedLocale && locales.includes(savedLocale)) {
          if (!userOverrideRef.current) setLocaleState(savedLocale);
          setLoading(false);
          return;
        }

        // Try to get from user settings if logged in (dynamic import to avoid server bundle)
        try {
          const { supabase } = await import('./supabase');
          if (userOverrideRef.current) { setLoading(false); return; }
          if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            if (userOverrideRef.current) { setLoading(false); return; }
            if (session) {
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('language_preference')
                .eq('id', session.user.id)
                .single();
              if (userOverrideRef.current) { setLoading(false); return; }

              if (profile?.language_preference && locales.includes(profile.language_preference as Locale)) {
                const userLocale = profile.language_preference as Locale;
                setLocaleState(userLocale);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('locale', userLocale);
                }
                setLoading(false);
                return;
              }
            }
          }
        } catch (_) {
          // Supabase not available or not configured; continue with localStorage/browser locale
        }

        // Use browser language (only on client side)
        if (typeof window === 'undefined') {
          setLocaleState(defaultLocale);
          setLoading(false);
          return;
        }
        if (userOverrideRef.current) { setLoading(false); return; }

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

    // Only load locale on client side
    if (typeof window !== 'undefined') {
      loadLocale();
    } else {
      // Server-side: use default locale immediately
      setLoading(false);
    }
  }, []);

  // Stable reference: prevents downstream useEffect deps (e.g. LocaleHomeClient) from
  // re-firing on every provider render and clobbering the user's choice mid-click.
  const setLocale = useCallback(async (newLocale: Locale) => {
    userOverrideRef.current = true;
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale);
    }

    // Update user settings if logged in (dynamic import to avoid server bundle)
    try {
      const { supabase } = await import('./supabase');
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase
            .from('user_profiles')
            .update({ language_preference: newLocale })
            .eq('id', session.user.id);
        }
      }
    } catch (error) {
      console.error('Error updating user language preference:', error);
    }
  }, []);

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
      const paramRegex = /\{(\w+)\}/g;
      return value.replace(paramRegex, (match, paramKey) => {
        return params[paramKey]?.toString() || match;
      });
    }

    return value;
  };

  // Always provide context, even during loading
  const contextValue: I18nContextType = {
    locale,
    setLocale,
    t,
    localeNames,
  };

  return React.createElement(
    I18nContext.Provider,
    { value: contextValue },
    children
  );
}

// Default fallback context for when I18nProvider is not available
const defaultContext: I18nContextType = {
  locale: defaultLocale,
  setLocale: async () => {
    // No-op fallback
  },
  t: (key: string, params?: Record<string, string | number>) => {
    const keys = key.split('.');
    let value: any = messages[defaultLocale];
    
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
      const paramRegex = /\{(\w+)\}/g;
      return value.replace(paramRegex, (match, paramKey) => {
        return params[paramKey]?.toString() || match;
      });
    }
    
    return value;
  },
  localeNames,
};

export function useI18n() {
  const context = useContext(I18nContext);
  // Always return a context - use fallback if provider is not available
  // This prevents errors during SSR and static generation
  return context || defaultContext;
}

/** Locale-aware marketing / product copy (replaces static `COPY` in client components). */
export function useCopy(): Copy {
  const { locale } = useI18n();
  return useMemo(() => getCopy(locale), [locale]);
}

export function useTranslations(namespace?: string) {
  // Safe translation function that works in both client and server contexts
  const getTranslation = (key: string, params?: Record<string, string | number>): string => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const keys = fullKey.split('.');
    let value: any = messages[defaultLocale];
    
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
    
    if (params) {
      const paramRegex = /\{(\w+)\}/g;
      return value.replace(paramRegex, (match, paramKey) => {
        return params[paramKey]?.toString() || match;
      });
    }
    
    return value;
  };
  
  // Try to get context, but provide fallback for SSR
  const context = useContext(I18nContext);
  
  // If context is available, use it; otherwise use fallback
  const t = context?.t || getTranslation;
  
  return (key: string, params?: Record<string, string | number>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    if (context) {
      return context.t(fullKey, params);
    }
    // getTranslation() already prefixes `namespace`; pass the short key only.
    return getTranslation(key, params);
  };
}
