import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPPORTED_LOCALES = ['en', 'ko', 'zh-CN', 'ja', 'es'] as const;

const PUBLIC_FILE = /\.(.*)$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes, Next.js internals, and static files
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Detect if the path starts with a supported locale subpath
  const matchedLocale = SUPPORTED_LOCALES.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (!matchedLocale) {
    return NextResponse.next();
  }

  // Strip the locale prefix from the pathname
  const pathWithoutLocale = pathname.replace(`/${matchedLocale}`, '') || '/';

  const url = request.nextUrl.clone();
  url.pathname = pathWithoutLocale;
  // Optionally expose the locale to the app via query param
  url.searchParams.set('locale', matchedLocale);

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};

