import type { Metadata } from "next";

import { STATIC_TOUR_PRODUCT_BUNDLE_SLUG_LIST } from "@/components/product-tour-static/_shared/tourProductBundleSlugs";
import { isTourSlugBlockedFromConsumerSurfaces } from "@/lib/tour-consumer-visibility";
import {
  TourProductPageBody,
  assertRegisteredConsumerSlug,
  buildTourProductMetadata,
} from "./tourProductPageBody";

type RouteParams = { slug: string };

/**
 * T1 — ISR instead of per-request SSR. The 2026-07-04 baseline measured every
 * detail request as a CDN MISS with 1.8~3.2s of streaming SSR before the
 * document finished; a cached hit serves in ~100ms. Admin freshness is
 * preserved by `revalidatePath` calls in
 * `app/api/admin/tour-product-pages/[slug]/route.ts` on every save, with this
 * TTL as the backstop. This route is the canonical ENGLISH page; localized
 * variants live at `app/[locale]/tour-product/[slug]` (real routes, no longer
 * cookie-driven content on this URL — cookies would defeat the shared cache).
 */
export const revalidate = 3600;

/**
 * Generic small-group tour detail — East template layout.
 *
 * Next.js App Router matches static segments before dynamic `[slug]`, so any
 * slug-specific `app/tour-product/<slug>/page.tsx` would still win over this
 * file if reintroduced.
 */

export function generateStaticParams(): RouteParams[] {
  // Blocked slugs are excluded so the build doesn't prerender 404s; they still
  // 404 on demand via assertRegisteredConsumerSlug.
  return STATIC_TOUR_PRODUCT_BUNDLE_SLUG_LIST.filter(
    (slug) => !isTourSlugBlockedFromConsumerSurfaces(slug),
  ).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  assertRegisteredConsumerSlug(slug);
  return buildTourProductMetadata(slug, "en");
}

export default async function RegisteredTourProductPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  assertRegisteredConsumerSlug(slug);
  return <TourProductPageBody slug={slug} locale="en" />;
}
