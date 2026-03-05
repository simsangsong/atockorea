'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useI18n, Locale } from '@/lib/i18n';

const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  ko: '🇰🇷',
  zh: '🇨🇳',
  'zh-TW': '🇹🇼',
  es: '🇪🇸',
  ja: '🇯🇵',
};

type RouteLocale = 'en' | 'zh-CN' | 'zh-TW' | 'ja' | 'es' | 'ko';

const routeLocales: RouteLocale[] = ['en', 'zh-CN', 'zh-TW', 'ja', 'es', 'ko'];

const localeToRouteLocale: Partial<Record<Locale, RouteLocale>> = {
  en: 'en',
  ko: 'ko',
  zh: 'zh-CN',     // 简体中文
  'zh-TW': 'zh-TW', // 繁體中文
  es: 'es',
  ja: 'ja',
};

export default function LanguageSwitcher() {
  const { locale, setLocale, localeNames } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const locales: Locale[] = ['en', 'ko', 'zh', 'zh-TW', 'es', 'ja'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const navigateWithLocale = (newLocale: Locale) => {
    if (!pathname) return;

    const targetRouteLocale = localeToRouteLocale[newLocale];
    if (!targetRouteLocale) return;

    // 영어 선택 시 미들웨어가 Accept-Language로 다시 /ko 리다이렉트하지 않도록 쿠키 설정
    document.cookie = `NEXT_LOCALE=${targetRouteLocale}; path=/; max-age=31536000; SameSite=Lax`;

    const segments = pathname.split('/').filter(Boolean);
    const currentHasLocalePrefix =
      segments.length > 0 && routeLocales.includes(segments[0] as RouteLocale);

    const restSegments = currentHasLocalePrefix ? segments.slice(1) : segments;

    let nextPath: string;
    if (targetRouteLocale === 'en') {
      nextPath = '/' + restSegments.join('/');
    } else {
      nextPath =
        '/' +
        targetRouteLocale +
        (restSegments.length ? '/' + restSegments.join('/') : '');
    }

    const search = searchParams?.toString();
    if (search) {
      nextPath += `?${search}`;
    }

    router.push(nextPath || '/');
  };

  const handleSelect = (newLocale: Locale) => {
    setLocale(newLocale);
    navigateWithLocale(newLocale);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-0.5 sm:gap-1 md:gap-1.5 px-1 sm:px-1.5 md:px-2 lg:px-3 py-0.5 sm:py-1 md:py-1.5 lg:py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-md hover:shadow-lg flex-shrink-0"
      >
        <span className="text-xs sm:text-sm flex-shrink-0">{localeFlags[locale]}</span>
        <span className="hidden md:inline whitespace-nowrap">{localeNames[locale]}</span>
        <span className="hidden sm:inline md:hidden whitespace-nowrap">{locale.toUpperCase()}</span>
        <svg
          className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border-2 border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => handleSelect(loc)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                locale === loc
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                  : 'text-gray-800 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-base flex-shrink-0">{localeFlags[loc]}</span>
              <span className="flex-1 text-left font-medium">{localeNames[loc]}</span>
              {locale === loc && (
                <svg
                  className="w-4 h-4 text-blue-600 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
