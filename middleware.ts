import { NextRequest, NextResponse } from 'next/server';
import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';

const SUPPORTED_LOCALES = ['en', 'ko', 'zh-CN', 'zh-TW', 'ja', 'es'];
const DEFAULT_LOCALE = 'en';
const LOCALE_COOKIE = 'NEXT_LOCALE';

function getLocale(request: NextRequest): string {
  const negotiatorHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    negotiatorHeaders[key] = value;
  });

  const languages = new Negotiator({ headers: negotiatorHeaders }).languages();
  return match(languages, SUPPORTED_LOCALES, DEFAULT_LOCALE);
}

function getLocaleFromCookie(request: NextRequest): string | null {
  const value = request.cookies.get(LOCALE_COOKIE)?.value;
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

  // 2. 이미 지원 언어 접두사가 붙은 경로인지 확인
  const pathnameHasLocale = SUPPORTED_LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  // 3. 언어 접두사가 없을 때: 쿠키 우선, 없으면 Accept-Language 기반 자동 감지
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

  // 4. 이미 접두사가 있는 경우
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
  const pathWithoutLocale = pathname.replace(`/${matchedLocale}`, '') || '/';
  const url = request.nextUrl.clone();
  url.pathname = pathWithoutLocale;
  url.searchParams.set('locale', matchedLocale);

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
