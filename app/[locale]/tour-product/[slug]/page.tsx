import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  TourProductPageBody,
  assertRegisteredConsumerSlug,
  buildTourProductMetadata,
  tourProductDbLocaleFromUrlLocale,
} from "@/app/tour-product/[slug]/tourProductPageBody";

type RouteParams = { locale: string; slug: string };

/**
 * Localized tour-product detail — a REAL route so each (locale, slug) page is
 * its own ISR cache entry (T1). Previously middleware rewrote
 * `/ko/tour-product/x` to `/tour-product/x?locale=ko` and the bare URL also
 * varied by the NEXT_LOCALE cookie, which made the page uncacheable
 * (per-request SSR, CDN MISS on every hit in the 2026-07-04 baseline).
 * Middleware now passes locale-prefixed tour-product paths through to this
 * route and 307s bare-path visitors with a non-en NEXT_LOCALE cookie here.
 *
 * Pages fill on demand (empty generateStaticParams) and revalidate hourly;
 * admin saves revalidate all locale variants of the slug immediately.
 */
export const revalidate = 3600;

export function generateStaticParams(): RouteParams[] {
  // On-demand ISR fill: localized variants are a fraction of traffic (EN is
  // canonical), so don't pay 5 locales × ~30 slugs of Supabase-backed renders
  // at build time. First visit renders + caches; admin saves revalidate.
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const dbLocale = tourProductDbLocaleFromUrlLocale(locale);
  if (!dbLocale) return {};
  assertRegisteredConsumerSlug(slug);
  return buildTourProductMetadata(slug, dbLocale);
}

export default async function LocalizedTourProductPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale, slug } = await params;
  if (locale === "en") {
    // English is canonical at the bare path — never index /en/tour-product/*.
    redirect(`/tour-product/${slug}`);
  }
  const dbLocale = tourProductDbLocaleFromUrlLocale(locale);
  if (!dbLocale) {
    notFound();
  }
  assertRegisteredConsumerSlug(slug);
  return <TourProductPageBody slug={slug} locale={dbLocale} />;
}
