/**
 * @todo Next.js 16+: `middleware` is deprecated in favor of `proxy` (see Next.js upgrade guide).
 * Keep behavior in sync when migrating; routing/locale matching must stay equivalent.
 */
import { NextRequest, NextResponse } from 'next/server';
import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';
import { matchesEastSignatureSlugSegment } from '@/src/lib/east-signature-nature-core-match';
import { CANONICAL_EAST_SIGNATURE_PRODUCT_PATH } from '@/lib/tour-consumer-visibility';

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
  'cookies',
  'dashboard',
  'dsa',
  'forgot-id',
  'forgot-password',
  'itinerary-builder',
  'jeju',
  'legal',
  'merchant',
  'my',
  'mypage',
  'privacy',
  'refund-policy',
  'reset-password',
  'reviews',
  'search',
  'seoul',
  'signin',
  'signup',
  'support',
  'terms',
  'test',
  'test-admin',
  'tours',
  'tour',
  'tour-preview',
  'tour-product',
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

const LOCALE_SET = new Set(SUPPORTED_LOCALES);

/** Duplicate flagship marketing URLs → canonical product (runs before site-private rewrite so redirects always win). */
function redirectEastSignatureLegacyMarketingPaths(request: NextRequest): NextResponse | null {
  const parts = request.nextUrl.pathname.split('/').filter(Boolean);

  const matchesDupPreviewSlug = (slug: string) =>
    slug === 'east-small-group-v2' ||
    slug === 'jeju-east-small-group-template-preview' ||
    slug === 'east-jeju-signature-small-group';

  if (parts[0] === 'tour-preview' && parts.length === 2 && matchesDupPreviewSlug(parts[1]!)) {
    const u = request.nextUrl.clone();
    u.pathname = CANONICAL_EAST_SIGNATURE_PRODUCT_PATH;
    u.search = '';
    return NextResponse.redirect(u, 308);
  }

  if (
    parts.length === 3 &&
    LOCALE_SET.has(parts[0]!) &&
    parts[1] === 'tour-preview' &&
    matchesDupPreviewSlug(parts[2]!)
  ) {
    const u = request.nextUrl.clone();
    u.pathname = `/${parts[0]}/tour-product/east-signature-nature-core`;
    u.search = '';
    return NextResponse.redirect(u, 308);
  }

  if (parts[0] === 'tour' && parts.length === 2 && parts[1] === 'jeju-east-small-group-template-preview') {
    const u = request.nextUrl.clone();
    u.pathname = CANONICAL_EAST_SIGNATURE_PRODUCT_PATH;
    u.search = '';
    return NextResponse.redirect(u, 308);
  }

  if (
    parts.length === 3 &&
    LOCALE_SET.has(parts[0]!) &&
    parts[1] === 'tour' &&
    parts[2] === 'jeju-east-small-group-template-preview'
  ) {
    const u = request.nextUrl.clone();
    u.pathname = `/${parts[0]}/tour-product/east-signature-nature-core`;
    u.search = '';
    return NextResponse.redirect(u, 308);
  }

  return null;
}

function decodeUrlPathSegment(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

/** Legacy duplicate East flagship checkout slugs → single Stripe-capable route. */
function redirectLegacyEastSignatureCheckoutPaths(request: NextRequest): NextResponse | null {
  const parts = request.nextUrl.pathname.split('/').filter(Boolean);

  const shouldRewriteSlug = (slugRaw: string) => {
    const s = decodeUrlPathSegment(slugRaw).trim().toLowerCase();
    if (s === 'east-signature-nature-core') return false;
    if (s === 'jeju-east-small-group-template-preview') return true;
    return matchesEastSignatureSlugSegment(s);
  };

  if (parts[0] === 'tour' && parts.length === 3 && parts[2] === 'checkout' && shouldRewriteSlug(parts[1]!)) {
    const u = request.nextUrl.clone();
    u.pathname = '/tour/east-signature-nature-core/checkout';
    return NextResponse.redirect(u, 308);
  }

  if (
    parts.length === 4 &&
    LOCALE_SET.has(parts[0]!) &&
    parts[1] === 'tour' &&
    parts[3] === 'checkout' &&
    shouldRewriteSlug(parts[2]!)
  ) {
    const u = request.nextUrl.clone();
    u.pathname = `/${parts[0]}/tour/east-signature-nature-core/checkout`;
    return NextResponse.redirect(u, 308);
  }

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

  // Admin is a locale-neutral operational area. Keep it out of /ko, /ja, etc.
  // Otherwise the admin layout can read the locale segment as part of the admin
  // path and generate URLs like /ko/admin/ko/admin/orders.
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length >= 2 && LOCALE_SET.has(parts[0]!) && parts[1] === 'admin') {
    const url = request.nextUrl.clone();
    url.pathname = `/${parts.slice(1).join('/')}`;
    return NextResponse.redirect(url, 307);
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return NextResponse.next();
  }

  const eastDupRedirect = redirectEastSignatureLegacyMarketingPaths(request);
  if (eastDupRedirect) return eastDupRedirect;

  const eastCheckoutRedirect = redirectLegacyEastSignatureCheckoutPaths(request);
  if (eastCheckoutRedirect) return eastCheckoutRedirect;

  // 1b. 정적 안내 페이지 + 플래그십 투어 상품 (locale 접두사 리다이렉트 대상에서 제외)
  const isFlagshipTourProductPath =
    pathname === CANONICAL_EAST_SIGNATURE_PRODUCT_PATH ||
    pathname.startsWith(`${CANONICAL_EAST_SIGNATURE_PRODUCT_PATH}/`) ||
    pathname === "/tour-product/jeju-grand-highlights-loop" ||
    pathname.startsWith("/tour-product/jeju-grand-highlights-loop/");
  if (isFlagshipTourProductPath) {
    return NextResponse.next();
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

    // `app/tour-product/[slug]` is only registered without a locale prefix. Consumer
    // links and `consumerTourDetailHref` use `/tour-product/<slug>`. Do not 302 to
    // `/ko/tour-product/...` here — that fights LanguageSwitcher and can loop redirects.
    if (/^\/tour-product\/[^/]+\/?$/.test(pathname)) {
      return NextResponse.next();
    }

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
