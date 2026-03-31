'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useI18n, Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

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

export type LanguageSwitcherProps = {
  /** Match premium tour detail header — quieter control, no heavy shadow. */
  premiumTourDetail?: boolean;
};

export default function LanguageSwitcher({ premiumTourDetail = false }: LanguageSwitcherProps) {
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

    // 쿠키 먼저 설정 (모바일에서 직후 요청에 쿠키가 포함되도록)
    const isSecure = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const cookieParts = [
      `NEXT_LOCALE=${targetRouteLocale}`,
      'path=/',
      'max-age=31536000',
      'SameSite=Lax',
      ...(isSecure ? ['Secure'] : []),
    ];
    document.cookie = cookieParts.join('; ');

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

    // 영어로 전환 시 서버가 쿠키를 설정하도록 ?locale=en 사용 (모바일에서 클라이언트 쿠키 누락 방지)
    const pathToOpen = nextPath || '/';
    const separator = pathToOpen.includes('?') ? '&' : '?';
    if (targetRouteLocale === 'en') {
      const withLocaleParam = `${pathToOpen}${separator}locale=en`;
      setTimeout(() => router.push(withLocaleParam), 0);
      return;
    }

    const search = searchParams?.toString();
    if (search) {
      nextPath += `?${search}`;
    }

    // 모바일에서 쿠키가 다음 요청에 포함되도록 네비게이션을 한 틱 지연
    setTimeout(() => router.push(nextPath || '/'), 0);
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
        className={cn(
          'flex flex-shrink-0 items-center gap-0.5 rounded-[10px] text-xs font-medium transition-colors duration-200 focus:outline-none sm:gap-1 md:gap-1.5',
          premiumTourDetail
            ? 'border border-stone-200/75 bg-white/65 px-2 py-1.5 text-stone-700 hover:border-stone-300/90 hover:bg-white/95 md:px-2.5 md:py-2 lg:px-3 focus-visible:ring-2 focus-visible:ring-stone-400/25 focus-visible:ring-offset-1'
            : 'border border-gray-300 bg-white px-1 py-0.5 font-semibold text-gray-800 shadow-md hover:border-gray-400 hover:bg-gray-50 hover:shadow-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:px-1.5 sm:py-1 md:px-2 md:py-1.5 lg:px-3 lg:py-2'
        )}
      >
        <span className={cn('flex-shrink-0', premiumTourDetail ? 'text-[13px] sm:text-sm' : 'text-xs sm:text-sm')}>
          {localeFlags[locale]}
        </span>
        <span className="hidden md:inline whitespace-nowrap">{localeNames[locale]}</span>
        <span className="hidden sm:inline md:hidden whitespace-nowrap">{locale.toUpperCase()}</span>
        <svg
          className={cn(
            'flex-shrink-0 transition-transform duration-200',
            premiumTourDetail ? 'h-2.5 w-2.5 text-stone-500 sm:h-3 sm:w-3' : 'h-2.5 w-2.5 text-gray-500 sm:h-3 sm:w-3',
            isOpen && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 top-full z-50 mt-2 w-48 rounded-xl bg-white py-2 animate-in fade-in slide-in-from-top-2 duration-200',
            premiumTourDetail
              ? 'border border-stone-200/90 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.12),0_1px_0_rgba(255,255,255,0.9)_inset]'
              : 'border-2 border-gray-200 shadow-2xl'
          )}
        >
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => handleSelect(loc)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors duration-150',
                locale === loc
                  ? premiumTourDetail
                    ? 'border-l-[3px] border-l-stone-800 bg-stone-100/50 text-stone-900'
                    : 'border-l-4 border-blue-600 bg-blue-50 text-blue-700'
                  : 'text-gray-800 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <span className="text-base flex-shrink-0">{localeFlags[loc]}</span>
              <span className="flex-1 text-left font-medium">{localeNames[loc]}</span>
              {locale === loc && (
                <svg
                  className={cn('h-4 w-4 flex-shrink-0', premiumTourDetail ? 'text-stone-700' : 'text-blue-600')}
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
