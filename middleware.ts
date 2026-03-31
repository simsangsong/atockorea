import { NextRequest, NextResponse } from 'next/server';
import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';

const SUPPORTED_LOCALES = ['en', 'ko', 'zh-CN', 'zh-TW', 'ja', 'es'];
const DEFAULT_LOCALE = 'en';
const LOCALE_COOKIE = 'NEXT_LOCALE';

/** First path segment is not a tour slug (app routes + locales). */
const RESERVED_ROOT_SEGMENTS = new Set([
  'about',
  'admin',
  'auth',
  'busan',
  'cart',
  'checkout',
  'contact',
  'custom-join-tour',
  'dashboard',
  'dsa',
  'forgot-id',
  'forgot-password',
  'home-private',
  'itinerary',
  'jeju',
  'legal',
  'merchant',
  'my',
  'mypage',
  'refund-policy',
  'reset-password',
  'reviews',
  'search',
  'seoul',
  'signin',
  'signup',
  'support',
  'test',
  'test-admin',
  'tours',
  'tour',
]);

function singlePathSegment(pathname: string): string | null {
  if (!pathname || pathname === '/') return null;
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 1) return null;
  return parts[0];
}

/** Marketing links sometimes omit /tour — avoid matching app/[locale]/page.tsx as a fake "locale". */
function shouldTreatBareSegmentAsTourSlug(seg: string): boolean {
  if (!seg || RESERVED_ROOT_SEGMENTS.has(seg)) return false;
  if (SUPPORTED_LOCALES.includes(seg)) return false;
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/i.test(seg)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return true;
  return false;
}

/**
 * 전면 비공개(모든 UI → /home-private rewrite)는 **명시적으로 켤 때만**.
 * 기본은 공개 — Vercel에 SITE_HOME_PUBLIC 누락 시 라이브 도메인에서 홈·투어가 통째로 사라지는 문제를 막기 위함.
 *
 * 켜기: `SITE_GATED=true` 또는 `SITE_HOME_PRIVATE=true` (또는 `1`)
 * 레거시: `SITE_HOME_PUBLIC=true` 가 있으면 항상 공개(게이트 무시).
 */
function isSiteGated(): boolean {
  if (process.env.SITE_HOME_PUBLIC === 'true' || process.env.SITE_HOME_PUBLIC === '1') {
    return false;
  }
  if (process.env.SITE_GATED === 'true' || process.env.SITE_GATED === '1') {
    return true;
  }
  if (process.env.SITE_HOME_PRIVATE === 'true' || process.env.SITE_HOME_PRIVATE === '1') {
    return true;
  }
  return false;
}

function getLocale(request: NextRequest): string {
  try {
    const negotiatorHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      negotiatorHeaders[key] = value;
    });

    const languages = new Negotiator({ headers: negotiatorHeaders }).languages();
    if (!languages?.length) return DEFAULT_LOCALE;
    return match(languages, SUPPORTED_LOCALES, DEFAULT_LOCALE);
  } catch {
    // Invalid Accept-Language tokens can make intl-localematcher throw (RangeError).
    return DEFAULT_LOCALE;
  }
}

function getLocaleFromCookie(request: NextRequest): string | null {
  const cookies = request.cookies;
  if (!cookies || typeof cookies.get !== 'function') return null;
  const value = cookies.get(LOCALE_COOKIE)?.value;
  if (value && SUPPORTED_LOCALES.includes(value)) return value;
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. 잘못된 정적 경로 수정: /next/ → /_next/ (일부 환경에서 생성되는 오타 보정)
  if (pathname.startsWith('/next/')) {
    const url = request.nextUrl.clone();
    url.pathname = `/_next/${pathname.slice(6)}`;
    return NextResponse.rewrite(url);
  }

  // 1. 제외할 경로 (API, Next 내부, 정적 파일 등)
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 1b. 메인 비공개 전용 페이지 (rewrite 대상 — 루프 방지)
  if (pathname === '/home-private' || pathname.startsWith('/home-private/')) {
    return NextResponse.next();
  }

  // 1c. 비로컬: 투어·마이페이지 등 포함 전 경로 비공개(rewrite). URL 바는 유지.
  if (isSiteGated()) {
    const url = request.nextUrl.clone();
    url.pathname = '/home-private';
    return NextResponse.rewrite(url);
  }

  // 1d. /product-slug → /tour/product-slug (single segment; not a locale or app route)
  const bareSeg = singlePathSegment(pathname);
  if (bareSeg && shouldTreatBareSegmentAsTourSlug(bareSeg)) {
    const u = request.nextUrl.clone();
    u.pathname = `/tour/${bareSeg}`;
    return NextResponse.redirect(u, 307);
  }

  // 2. 쿼리 ?locale=en 등으로 명시적 선택 시 쿠키 설정 후 리다이렉트 (모바일에서 쿠키 누락 대비)
  const localeFromQuery = request.nextUrl.searchParams.get('locale');
  if (localeFromQuery && SUPPORTED_LOCALES.includes(localeFromQuery)) {
    const targetUrl = new URL(request.url);
    targetUrl.pathname = pathname === '/' ? '/' : pathname;
    targetUrl.searchParams.delete('locale');
    const res = NextResponse.redirect(targetUrl);
    res.cookies.set(LOCALE_COOKIE, localeFromQuery, { path: '/', maxAge: 31536000, sameSite: 'lax' });
    return res;
  }

  // 3. 이미 지원 언어 접두사가 붙은 경로인지 확인
  const pathnameHasLocale = SUPPORTED_LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  // 4. 언어 접두사가 없을 때: 쿠키 우선, 없으면 Accept-Language 기반 자동 감지
  if (!pathnameHasLocale) {
    const cookieLocale = getLocaleFromCookie(request);
    const locale = cookieLocale ?? getLocale(request);

    if (locale !== DEFAULT_LOCALE) {
      const newUrl = new URL(request.url);
      newUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
      return NextResponse.redirect(newUrl);
    }

    return NextResponse.next();
  }

  // 5. 이미 접두사가 있는 경우
  const matchedLocale = SUPPORTED_LOCALES.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (!matchedLocale) {
    return NextResponse.next();
  }

  // 4a. 경로가 정확히 /ko, /zh-CN 등이면 rewrite 하지 않고 app/[locale]/page.tsx 로 처리
  if (pathname === `/${matchedLocale}`) {
    return NextResponse.next();
  }

  // 4b. /ko/tours, /ko/tour/123 등: rewrite (locale 제거 후 내부 경로로 전달)
  let pathWithoutLocale = pathname.replace(`/${matchedLocale}`, '') || '/';
  const innerBare = singlePathSegment(pathWithoutLocale);
  if (innerBare && shouldTreatBareSegmentAsTourSlug(innerBare)) {
    pathWithoutLocale = `/tour/${innerBare}`;
  }
  const url = request.nextUrl.clone();
  url.pathname = pathWithoutLocale;
  url.searchParams.set('locale', matchedLocale);

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
