'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Globe } from 'lucide-react';
import { useI18n, Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const localeShortLabels: Record<Locale, string> = {
  en: 'EN',
  ko: 'KR',
  zh: '简中',
  'zh-TW': '繁中',
  es: 'ES',
  ja: 'JP',
};

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
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  es: 'es',
  ja: 'ja',
};

/**
 * Mobile-only floating language pill, anchored above MobileBottomNav.
 * Hidden on routes without BottomNav (e.g., tour-product layout passes
 * showBottomNav={false} to SitePageShell, which also drops this component),
 * and self-hides when the StickyHomeCta would compete for the same fold —
 * detected via the same `[data-home-hero]` + `[data-home-final-cta]`
 * sentinels StickyHomeCta uses, so the two never co-exist visually.
 */
export default function FloatingLanguageToggle() {
  const { locale, setLocale, localeNames } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [stickyCtaShown, setStickyCtaShown] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const locales: Locale[] = ['en', 'ko', 'zh', 'zh-TW', 'es', 'ja'];

  // Click-outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Match StickyHomeCta's gating (heroOut && !footerIn) so the two never overlap.
  // Pages without `[data-home-hero]` won't trigger heroOut → pill stays visible.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hero = document.querySelector('[data-home-hero]');
    const footer = document.querySelector('[data-home-final-cta]');
    if (!hero) {
      setStickyCtaShown(false);
      return;
    }
    let heroOut = false;
    let footerIn = false;
    const recompute = () => setStickyCtaShown(heroOut && !footerIn);

    const heroObs = new IntersectionObserver(
      ([entry]) => {
        heroOut = entry.boundingClientRect.bottom < 0;
        recompute();
      },
      { threshold: [0, 0.1, 0.25, 0.5, 1] },
    );
    heroObs.observe(hero);

    const footerObs = footer
      ? new IntersectionObserver(
          ([entry]) => {
            footerIn = entry.isIntersecting;
            recompute();
          },
          { threshold: 0.2 },
        )
      : null;
    if (footer && footerObs) footerObs.observe(footer);

    return () => {
      heroObs.disconnect();
      footerObs?.disconnect();
    };
  }, [pathname]);

  const navigateWithLocale = (newLocale: Locale) => {
    if (!pathname) return;
    const targetRouteLocale = localeToRouteLocale[newLocale];
    if (!targetRouteLocale) return;

    const isSecure = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const cookieParts = [
      `NEXT_LOCALE=${targetRouteLocale}`,
      'path=/',
      'max-age=31536000',
      'SameSite=Lax',
      ...(isSecure ? ['Secure'] : []),
    ];
    document.cookie = cookieParts.join('; ');

    const pathOnly = pathname.split('?')[0];
    const pathSegments = pathOnly.split('/').filter(Boolean);
    const withoutLocalePrefix =
      pathSegments[0] && routeLocales.includes(pathSegments[0] as RouteLocale)
        ? '/' + pathSegments.slice(1).join('/')
        : pathOnly;
    if (/^\/tour-product\/[^/]+\/?$/.test(withoutLocalePrefix)) {
      setTimeout(() => router.refresh(), 0);
      return;
    }

    const segments = pathname.split('/').filter(Boolean);
    const currentHasLocalePrefix =
      segments.length > 0 && routeLocales.includes(segments[0] as RouteLocale);
    const restSegments = currentHasLocalePrefix ? segments.slice(1) : segments;

    let nextPath: string;
    if (targetRouteLocale === 'en') {
      nextPath = '/' + restSegments.join('/');
    } else {
      nextPath =
        '/' + targetRouteLocale + (restSegments.length ? '/' + restSegments.join('/') : '');
    }

    const pathToOpen = nextPath || '/';
    const separator = pathToOpen.includes('?') ? '&' : '?';
    if (targetRouteLocale === 'en') {
      setTimeout(() => router.push(`${pathToOpen}${separator}locale=en`), 0);
      return;
    }

    const search = searchParams?.toString();
    if (search) nextPath += `?${search}`;
    setTimeout(() => router.push(nextPath || '/'), 0);
  };

  const handleSelect = (loc: Locale) => {
    setLocale(loc);
    navigateWithLocale(loc);
    setIsOpen(false);
  };

  // Hide entirely when StickyHomeCta competes for the bottom fold.
  // `md:hidden` keeps desktop unaffected (header switcher already reachable).
  const hidden = stickyCtaShown;

  return (
    <div
      ref={wrapRef}
      className={cn(
        'fixed right-4 z-40 md:hidden',
        'bottom-[calc(env(safe-area-inset-bottom,0px)+80px)]',
        'transition-opacity duration-200',
        hidden ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
      aria-hidden={hidden ? 'true' : undefined}
    >
      {isOpen && (
        <div
          role="menu"
          aria-label="Select language"
          className="absolute bottom-full right-0 mb-2 w-44 rounded-2xl border border-gray-200 bg-white/98 py-1.5 shadow-[0_18px_40px_-10px_rgba(15,23,42,0.18),0_4px_10px_-4px_rgba(15,23,42,0.08)] backdrop-blur-md"
        >
          {locales.map((loc) => (
            <button
              key={loc}
              type="button"
              role="menuitem"
              onClick={() => handleSelect(loc)}
              className={cn(
                'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium transition-colors',
                locale === loc
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-800 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <span className="text-[15px] leading-none">{localeFlags[loc]}</span>
              <span className="flex-1">{localeNames[loc]}</span>
              {locale === loc && (
                <svg className="h-3.5 w-3.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
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
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Change language"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          'flex h-11 min-w-[3.25rem] items-center justify-center gap-1.5 rounded-full',
          // Solid slate-900 (≥95% alpha) so the pill never disappears against
          // dark hero photos or the Process dark section. Same visual language
          // as StickyHomeCta so the bottom-fold stays cohesive.
          'bg-slate-900/95 px-3 text-[12px] font-semibold text-white',
          'ring-1 ring-white/12 backdrop-blur-md',
          'shadow-[0_14px_32px_-10px_rgba(15,23,42,0.55),0_3px_6px_-2px_rgba(15,23,42,0.22)]',
          'transition-transform duration-150 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/55 focus-visible:ring-offset-1',
        )}
      >
        <Globe aria-hidden className="h-4 w-4 text-white/95" />
        <span className="tracking-wide">{localeShortLabels[locale]}</span>
      </button>
    </div>
  );
}
