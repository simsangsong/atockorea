import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { buildTourProductViewModelFromFullPageJson } from "@/components/product-tour-static/_shared/buildTourProductViewModelFromJson";
import {
  getStaticTourProductFullPageJson,
  isStaticTourProductBundleRegistered,
} from "@/components/product-tour-static/_shared/tourProductBundleRegistry";
import { listStaticTourProducts } from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import { TourProductDetailClient } from "@/components/product-tour-static/_shared/TourProductDetailClient";
import { tourProductJsonLdScripts } from "@/lib/seo/tourProductJsonLd";
import { createAnonServerClient } from "@/lib/supabase";
import { getTourProductCheckoutContext } from "@/lib/tour-product/eastSignatureCheckoutContext";
import { loadTourProductViewModelBySlugFromSupabase } from "@/lib/tour-product/loadTourProductPage";
import { resolveTourProductDbLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import { isTourSlugBlockedFromConsumerSurfaces } from "@/lib/tour-consumer-visibility";

type RouteParams = { slug: string };
type RouteSearchParams = { locale?: string | string[] };

/**
 * Always re-render on each request — admin saves to `tour_product_pages` must
 * surface immediately on the live page without manual cache invalidation. The
 * page is small enough that SSR every time is fine, and CDN-level caching
 * (Vercel) still kicks in for unauthenticated visitors.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Generic small-group tour detail — East template layout.
 *
 * Specific slugs that need custom logic (east-signature-nature-core,
 * jeju-grand-highlights-loop) keep their own `app/tour-product/<slug>/page.tsx`.
 * Next.js App Router matches static segments before dynamic `[slug]`, so this
 * file only serves newly-registered slugs (Southwest, future products).
 */

async function resolveRegisteredSlug(params: Promise<RouteParams>): Promise<string> {
  const { slug } = await params;
  if (typeof slug !== "string" || slug.length === 0) {
    notFound();
  }
  if (!isStaticTourProductBundleRegistered(slug)) {
    notFound();
  }
  // Retired / consumer-blocked products 404 instead of serving a stale detail page.
  if (isTourSlugBlockedFromConsumerSurfaces(slug)) {
    notFound();
  }
  return slug;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams?: Promise<RouteSearchParams>;
}): Promise<Metadata> {
  const slug = await resolveRegisteredSlug(params);
  const sp = (await searchParams) ?? {};
  const locale = await resolveTourProductDbLocale(sp.locale);
  const doc = getStaticTourProductFullPageJson(slug, locale);
  const seo = (doc?.seo ?? null) as { pageTitle?: string; metaDescription?: string } | null;
  return {
    title: seo?.pageTitle,
    description: seo?.metaDescription,
  };
}

export default async function RegisteredTourProductPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams?: Promise<RouteSearchParams>;
}) {
  const slug = await resolveRegisteredSlug(params);
  const sp = (await searchParams) ?? {};
  const locale = await resolveTourProductDbLocale(sp.locale);

  // Resolution order: Supabase locale → static JSON locale → Supabase EN fallback.
  // Falling through to the static JSON for the requested locale before trying
  // Supabase EN keeps the localized bundle from being silently replaced by EN
  // content when only the EN row exists in the DB (currently the common case).
  let viewModel: Awaited<ReturnType<typeof loadTourProductViewModelBySlugFromSupabase>> = null;
  const forceStatic = process.env.TOUR_PRODUCT_FORCE_STATIC_BUNDLE === "1";
  const supabaseClient =
    process.env.TOUR_PRODUCT_USE_SUPABASE === "1" && !forceStatic ? createAnonServerClient() : null;

  if (supabaseClient) {
    try {
      viewModel = await loadTourProductViewModelBySlugFromSupabase(supabaseClient, slug, locale);
    } catch (e) {
      console.error("[RegisteredTourProductPage] Supabase load failed, using JSON bundle", slug, e);
    }
  }

  if (!viewModel) {
    const doc = getStaticTourProductFullPageJson(slug, locale);
    if (doc) {
      viewModel = buildTourProductViewModelFromFullPageJson(doc, locale);
    }
  }

  if (!viewModel && supabaseClient && locale !== "en") {
    try {
      viewModel = await loadTourProductViewModelBySlugFromSupabase(supabaseClient, slug, "en");
    } catch (e) {
      console.error("[RegisteredTourProductPage] Supabase EN fallback failed", slug, e);
    }
  }

  if (!viewModel) {
    notFound();
  }

  // Overlay static-JSON-only extension fields onto the (possibly Supabase-loaded)
  // viewmodel. These are pass-through opt-in flags the Supabase tour row does
  // not carry (e.g. `liveStatusSection: "haenyeo"` on the Jeju east tour).
  try {
    const staticDoc = getStaticTourProductFullPageJson(slug, locale);
    if (staticDoc) {
      const extensions: Array<keyof typeof staticDoc> = ["liveStatusSection", "pricingTiers", "price"];
      for (const k of extensions) {
        const v = (staticDoc as Record<string, unknown>)[k as string];
        if (v !== undefined && (viewModel as Record<string, unknown>)[k as string] === undefined) {
          (viewModel as Record<string, unknown>)[k as string] = v;
        }
      }
    }
  } catch {
    // best-effort overlay; ignore errors
  }

  let checkout: Awaited<ReturnType<typeof getTourProductCheckoutContext>> = null;
  try {
    checkout = await getTourProductCheckoutContext(slug);
  } catch (e) {
    console.error("[RegisteredTourProductPage] checkout context unavailable", slug, e);
  }

  const jsonLdScripts = tourProductJsonLdScripts(viewModel, slug);

  // Recommendations: pick up to 6 other tours for this locale, prioritizing same region.
  // Drop entries without a parseable price so off-season / unpriced products don't
  // render as "$0" cards (mirrors the homepage featured-grid filter).
  const allCatalog = listStaticTourProducts(locale);
  const currentRegion = allCatalog.find((p) => p.slug === slug)?.region ?? "";
  const otherTours = allCatalog.filter((p) => p.slug !== slug && p.listPriceUsd > 0);
  const sameRegion = otherTours.filter((p) => p.region === currentRegion);
  const otherRegions = otherTours.filter((p) => p.region !== currentRegion);
  const recommendations = [...sameRegion, ...otherRegions].slice(0, 6);

  return (
    <>
      {jsonLdScripts.map((json, idx) => (
        <script
          key={`tour-product-jsonld-${idx}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: json }}
        />
      ))}
      <TourProductDetailClient
        viewModel={viewModel}
        checkout={checkout}
        tourProductSlug={slug}
        recommendations={recommendations}
        locale={locale}
      />
    </>
  );
}
