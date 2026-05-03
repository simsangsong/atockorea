import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { buildTourProductViewModelFromFullPageJson } from "@/components/product-tour-static/_shared/buildTourProductViewModelFromJson";
import {
  getStaticTourProductFullPageJson,
  isStaticTourProductBundleRegistered,
} from "@/components/product-tour-static/_shared/tourProductBundleRegistry";
import { listStaticTourProducts } from "@/components/product-tour-static/catalog/staticTourProductRegistry";
import { TourProductDetailClient } from "@/components/product-tour-static/_shared/TourProductDetailClient";
import { tourProductJsonLdScripts } from "@/lib/seo/tourProductJsonLd";
import { createAnonServerClient } from "@/lib/supabase";
import { getTourProductCheckoutContext } from "@/lib/tour-product/eastSignatureCheckoutContext";
import { loadTourProductViewModelBySlugFromSupabase } from "@/lib/tour-product/loadTourProductPage";
import { resolveTourProductDbLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

type RouteParams = { slug: string };

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
  return slug;
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const slug = await resolveRegisteredSlug(params);
  const locale = await resolveTourProductDbLocale();
  const doc = getStaticTourProductFullPageJson(slug, locale);
  const seo = (doc?.seo ?? null) as { pageTitle?: string; metaDescription?: string } | null;
  return {
    title: seo?.pageTitle,
    description: seo?.metaDescription,
  };
}

export default async function RegisteredTourProductPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const slug = await resolveRegisteredSlug(params);
  const locale = await resolveTourProductDbLocale();

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

  let checkout: Awaited<ReturnType<typeof getTourProductCheckoutContext>> = null;
  try {
    checkout = await getTourProductCheckoutContext(slug);
  } catch (e) {
    console.error("[RegisteredTourProductPage] checkout context unavailable", slug, e);
  }

  const jsonLdScripts = tourProductJsonLdScripts(viewModel, slug);

  // Recommendations: pick up to 6 other tours for this locale, prioritizing same region.
  const allCatalog = listStaticTourProducts(locale);
  const currentRegion = allCatalog.find((p) => p.slug === slug)?.region ?? "";
  const otherTours = allCatalog.filter((p) => p.slug !== slug);
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
      />
    </>
  );
}
