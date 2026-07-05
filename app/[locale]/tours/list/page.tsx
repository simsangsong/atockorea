import { notFound, redirect } from "next/navigation";

import {
  ToursListPageBody,
  toursListDbLocaleFromUrlLocale,
} from "@/app/tours/list/toursListPageBody";

type RouteParams = { locale: string };

/**
 * Localized catalogue page — a REAL route so each locale is its own ISR cache
 * entry (same T1 pattern as `app/[locale]/tour-product/[slug]`). Previously
 * middleware rewrote `/ko/tours/list` to `/tours/list?locale=ko` and the bare
 * URL also varied by the NEXT_LOCALE cookie, which made the page uncacheable.
 * Middleware now passes locale-prefixed `/tours/list` through to this route
 * and 307s bare-path visitors with a non-en NEXT_LOCALE cookie here.
 *
 * Pages fill on demand (empty generateStaticParams) and revalidate hourly;
 * admin thumbnail saves revalidate all locale variants immediately.
 */
export const revalidate = 3600;

export function generateStaticParams(): RouteParams[] {
  // On-demand ISR fill — localized variants are a fraction of traffic.
  return [];
}

export default async function LocalizedToursListPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale } = await params;
  if (locale === "en") {
    // English is canonical at the bare path — never index /en/tours/list.
    redirect("/tours/list");
  }
  const dbLocale = toursListDbLocaleFromUrlLocale(locale);
  if (!dbLocale) {
    notFound();
  }
  return <ToursListPageBody locale={dbLocale} />;
}
