'use client';

import { usePathname } from 'next/navigation';

/**
 * `usePathname()` with the locale URL prefix stripped.
 *
 * Why: the middleware serves locale-prefixed pages (`/ko/mypage`) by
 * REWRITING to the bare route (`/mypage?locale=ko`), so the server-rendered
 * HTML is produced with `pathname === '/mypage'` while the hydrating client
 * sees the browser URL `'/ko/mypage'`. Any render that branches on the raw
 * pathname (nav active states, "back to my page" header, bottom-nav tab
 * highlight) therefore mismatches → React #418 → the WHOLE page falls back
 * to a client re-render on every localized visit (measured on /ko/mypage,
 * 2026-07-05). Branch on this normalized value instead so server and client
 * agree; keep the RAW `usePathname()` for URL building / redirects, where
 * the locale prefix must be preserved.
 *
 * The prefix list mirrors `SUPPORTED_LOCALES` in middleware.ts (en is never
 * a prefix — bare paths are canonical EN).
 */
const LOCALE_PREFIX_RE = /^\/(?:ko|ja|es|zh-CN|zh-TW)(?=\/|$)/;

export function stripLocalePrefix(pathname: string | null | undefined): string {
  const stripped = (pathname || '/').replace(LOCALE_PREFIX_RE, '');
  return stripped === '' ? '/' : stripped;
}

export function usePathnameWithoutLocale(): string {
  return stripLocalePrefix(usePathname());
}
