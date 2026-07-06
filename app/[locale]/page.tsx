import { notFound } from 'next/navigation';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { HomeMainBody } from '@/components/home/HomeMainBody';
import { LocaleHomeClient } from '@/components/LocaleHomeClient';
import { FEATURED_PRODUCT_SLUGS } from '@/components/home/v2/sections';
import { createServerClient } from '@/lib/supabase';
import { loadTourProductCardMediaBySlug } from '@/lib/tour-product/resolveTourProductCardMedia.server';
import type { TourProductCardMediaMap } from '@/lib/tour-product/cardMediaTypes';

const SUPPORTED_LOCALE_ROUTES = ['ko', 'zh-CN', 'zh-TW', 'ja', 'es'] as const;

/** URL locale segment -> i18n Locale (zh-CN -> zh, zh-TW stays zh-TW) */
function toI18nLocale(segment: string): 'ko' | 'zh' | 'zh-TW' | 'ja' | 'es' {
  if (segment === 'zh-CN') return 'zh';
  if (segment === 'zh-TW') return 'zh-TW';
  return segment as 'ko' | 'zh' | 'ja' | 'es';
}

/**
 * Localized home (`/ko` `/ja` `/zh-CN` `/zh-TW` `/es`).
 *
 * ISR, mirroring `app/page.tsx` (the English `/`). Previously this page had no
 * `revalidate`/`generateStaticParams`, so every non-English visitor got an
 * uncached per-request SSR render (`X-Vercel-Cache: MISS`, `no-store`) — the
 * same uncached-dynamic problem T1 fixed for `/tours/list`. Since the Korean
 * cookie 307-redirects `/` → `/ko`, this was the actual home most Korean users
 * hit, and none of the `/`-only home optimizations reached it.
 *
 * The page is now prerendered per locale + revalidated hourly and served from
 * the CDN edge. i18n stays client-side (LocaleHomeClient sets the locale on
 * hydration) exactly as before — the prerendered HTML carries the English
 * default and flips to the locale on hydration, unchanged from the old dynamic
 * render, just cached now. Most-Loved rail thumbnails are server-seeded per
 * locale (same as `/`) so the rail doesn't flash the build-time static image.
 */
export const revalidate = 600;

export function generateStaticParams(): { locale: string }[] {
  return SUPPORTED_LOCALE_ROUTES.map((locale) => ({ locale }));
}

async function loadFeaturedMediaBySlug(locale: string): Promise<TourProductCardMediaMap> {
  try {
    const supabase = createServerClient();
    return await loadTourProductCardMediaBySlug(
      supabase,
      Array.from(new Set(FEATURED_PRODUCT_SLUGS)),
      locale,
    );
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[/[locale]] featured media prefetch failed:', (e as Error)?.message);
    }
    return {};
  }
}

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!(SUPPORTED_LOCALE_ROUTES as readonly string[]).includes(locale)) notFound();

  const i18nLocale = toI18nLocale(locale);
  const featuredMediaBySlug = await loadFeaturedMediaBySlug(i18nLocale);

  return (
    <LocaleHomeClient locale={i18nLocale}>
      <SitePageShell>
        <main className="bg-transparent">
          <HomeMainBody featuredMediaBySlug={featuredMediaBySlug} />
        </main>
      </SitePageShell>
    </LocaleHomeClient>
  );
}
