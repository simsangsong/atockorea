'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext, ReactNode } from 'react';
import { getCopy } from '@/lib/copy-messages';
import type { Copy } from '@/src/design/copy';
// Do not static-import supabase here: it triggers server bundle of @supabase/supabase-js
// and causes "Cannot find module './vendor-chunks/@supabase.js'". Use dynamic import in client-only code.

// §D A4.1 — 사이트 10로케일의 정본은 `lib/locale.ts` 하나다. 여기서 다시
// 나열하면 로케일이 늘어나는 날 한쪽만 고쳐지고, 그 사실은 고친 사람도 모른다.
// (이 파일은 'use client'라 별도로 존재하지만, **목록까지** 복제할 이유는 없다.)
import { locales, defaultLocale, type Locale } from '@/lib/locale';

export { locales, defaultLocale };
export type { Locale };

const localeNames: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
  zh: '中文 (简体)',
  'zh-TW': '中文 (繁體)',
  es: 'Español',
  ja: '日本語',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  ru: 'Русский',
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
  fr: () => import('@/messages/fr.json'),
  de: () => import('@/messages/de.json'),
  it: () => import('@/messages/it.json'),
  ru: () => import('@/messages/ru.json'),
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
      document.body.classList.remove(
        'lang-en', 'lang-ko', 'lang-zh', 'lang-zh-TW', 'lang-es', 'lang-ja',
        'lang-fr', 'lang-de', 'lang-it', 'lang-ru'
      );
      // Add current locale class
      document.body.classList.add(`lang-${locale}`);
    }
  }, [locale]);

  useEffect(() => {
    // Server-side: keep the default; the client effect below picks the real one.
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // 1) Saved explicit preference wins — instant, no network and no supabase chunk.
    try {
      const savedLocale = localStorage.getItem('locale') as Locale | null;
      if (savedLocale && locales.includes(savedLocale)) {
        if (!userOverrideRef.current) setLocaleState(savedLocale);
        setLoading(false);
        return;
      }
    } catch {
      // localStorage unavailable — fall through to browser detection.
    }

    // 2) New visitor: derive the locale from the browser language SYNCHRONOUSLY so
    //    first paint is already localized. Previously this was gated behind loading
    //    the supabase-js chunk + getSession() just to detect language, delaying the
    //    correct locale for every first-time visitor.
    const detectBrowserLocale = (): Locale => {
      const full = navigator.language.toLowerCase();
      const code = full.split('-')[0];
      if (full.startsWith('zh-tw') || full.startsWith('zh-hant')) return 'zh-TW';
      if (code === 'ko') return 'ko';
      if (code === 'zh') return 'zh';
      if (code === 'es') return 'es';
      if (code === 'ja') return 'ja';
      if (code === 'fr') return 'fr';
      if (code === 'de') return 'de';
      if (code === 'it') return 'it';
      if (code === 'ru') return 'ru';
      return defaultLocale;
    };
    if (!userOverrideRef.current) setLocaleState(detectBrowserLocale());
    setLoading(false);

    // 3) Logged-in users: enrich from their saved profile preference in the
    //    background. Never blocks first paint, bounded by a 2s timeout, and yields
    //    to an explicit user choice made in the meantime (userOverrideRef).
    let cancelled = false;
    const withTimeout = <T,>(p: PromiseLike<T>, ms: number): Promise<T | null> =>
      Promise.race([
        Promise.resolve(p),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
      ]);
    (async () => {
      try {
        const { supabase } = await import('./supabase');
        if (cancelled || userOverrideRef.current || !supabase) return;
        const sessionRes = await withTimeout(supabase.auth.getSession(), 2000);
        const session = sessionRes?.data?.session;
        if (cancelled || userOverrideRef.current || !session) return;
        const profileRes = await withTimeout(
          supabase
            .from('user_profiles')
            .select('language_preference')
            .eq('id', session.user.id)
            .single(),
          2000
        );
        if (cancelled || userOverrideRef.current) return;
        const pref = profileRes?.data?.language_preference as Locale | undefined;
        if (pref && locales.includes(pref)) {
          setLocaleState(pref);
          try {
            localStorage.setItem('locale', pref);
          } catch {
            /* ignore */
          }
        }
      } catch {
        // Supabase unavailable/unconfigured — browser locale already applied.
      }
    })();

    return () => {
      cancelled = true;
    };
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
