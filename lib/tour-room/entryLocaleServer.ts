import { headers } from 'next/headers';
import { resolveEntryLocale } from '@/lib/tour-room/entryLocale';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

/**
 * N6 — the request-side half, kept apart from the pure resolver so the client
 * bundle never pulls `next/headers` in. (That exact leak has bitten this repo
 * before: a tour-product helper imported `next/headers` and broke the client
 * build, which is why the client-safe split is a habit here.)
 *
 * Every tour-mode route is `force-dynamic`, so this is free.
 */
export async function entryLocaleFromRequest(): Promise<RoomLocale> {
  const requestHeaders = await headers();
  return resolveEntryLocale({
    cookieHeader: requestHeaders.get('cookie'),
    acceptLanguage: requestHeaders.get('accept-language'),
  });
}
