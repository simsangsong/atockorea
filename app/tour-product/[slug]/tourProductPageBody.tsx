import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactDOM from "react-dom";

import { buildTourProductViewModelFromFullPageJson } from "@/components/product-tour-static/_shared/buildTourProductViewModelFromJson";
import {
  getStaticTourProductFullPageJson,
  isStaticTourProductBundleRegistered,
} from "@/components/product-tour-static/_shared/tourProductBundleRegistry";
import {
  listStaticTourProducts,
  type StaticTourProductRegistration,
} from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import { pickTourRecommendations } from "@/lib/recommendations/tourSimilarity";
import { TourProductDetailClient } from "@/components/product-tour-static/_shared/TourProductDetailClient";
import { tourProductJsonLdScripts } from "@/lib/seo/tourProductJsonLd";
import { createAnonServerClient } from "@/lib/supabase";
import { getTourProductCheckoutContext } from "@/lib/tour-product/eastSignatureCheckoutContext";
import { loadTourProductViewModelBySlugFromSupabase } from "@/lib/tour-product/loadTourProductPage";
import { loadTourExternalReviews } from "@/lib/tour-product/externalReviews";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import { isTourSlugBlockedFromConsumerSurfaces } from "@/lib/tour-consumer-visibility";

/**
 * Shared server body for the tour-product detail page, rendered by BOTH
 * routes so each stays a cacheable ISR entry (T1):
 *
 *   - `app/tour-product/[slug]`            → locale "en" (canonical)
 *   - `app/[locale]/tour-product/[slug]`   → the URL-segment locale
 *
 * The locale is a ROUTE input, never `cookies()` / `searchParams` — reading
 * either would opt the page back into per-request dynamic rendering, which is
 * exactly what T1 removes (baseline: every request was a CDN MISS + 1.8~3.2s
 * of streaming SSR). Booking-card deep-link seeds (`?date=&guests=…`) moved
 * client-side into TourProductDetailClient for the same reason.
 */

/** URL prefixes served by `app/[locale]/tour-product/[slug]` (en lives at the bare path). */
export const TOUR_PRODUCT_URL_LOCALES = ["ko", "ja", "es", "zh-CN", "zh-TW"] as const;

/** `NEXT_LOCALE` / URL locale → `tour_product_pages.locale` (zh-CN rows are stored as "zh"). */
export function tourProductDbLocaleFromUrlLocale(urlLocale: string): TourProductPageLocale | null {
  if (urlLocale === "zh-CN") return "zh";
  if ((TOUR_PRODUCT_URL_LOCALES as readonly string[]).includes(urlLocale)) {
    return urlLocale as TourProductPageLocale;
  }
  return null;
}

export function assertRegisteredConsumerSlug(slug: string): void {
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
}

export function buildTourProductMetadata(slug: string, locale: TourProductPageLocale): Metadata {
  const doc = getStaticTourProductFullPageJson(slug, locale);
  const seo = (doc?.seo ?? null) as { pageTitle?: string; metaDescription?: string } | null;
  return {
    title: seo?.pageTitle,
    description: seo?.metaDescription,
  };
}

export async function TourProductPageBody({
  slug,
  locale,
}: {
  slug: string;
  locale: TourProductPageLocale;
}) {
  // B3: the checkout context depends only on `slug`, so kick it off now and let it
  // run concurrently with the (multi-step, DB round-trip) viewModel resolution
  // below instead of awaiting it sequentially afterward. Errors degrade to null,
  // matching the prior try/catch behavior.
  const checkoutPromise = getTourProductCheckoutContext(slug).catch((e) => {
    console.error("[TourProductPageBody] checkout context unavailable", slug, e);
    return null;
  });

  // Third-party platform review aggregates depend only on `slug` — kick off the
  // (public-read) fetch concurrently with the view-model resolution. Errors
  // degrade to [] inside the loader, so the block simply renders nothing.
  const externalReviewsPromise = loadTourExternalReviews(slug);

  // Resolution order: Supabase locale → static JSON locale → Supabase EN fallback.
  // Falling through to the static JSON for the requested locale before trying
  // Supabase EN keeps the localized bundle from being silently replaced by EN
  // content when only the EN row exists in the DB (currently the common case).
  let viewModel: Awaited<ReturnType<typeof loadTourProductViewModelBySlugFromSupabase>> = null;
  const forceStatic = process.env.TOUR_PRODUCT_FORCE_STATIC_BUNDLE === "1";
  let supabaseClient: ReturnType<typeof createAnonServerClient> | null = null;
  if (!forceStatic) {
    try {
      supabaseClient = createAnonServerClient();
    } catch (e) {
      console.error("[TourProductPageBody] Supabase client unavailable, using JSON bundle", slug, e);
    }
  }

  if (supabaseClient) {
    try {
      viewModel = await loadTourProductViewModelBySlugFromSupabase(supabaseClient, slug, locale);
    } catch (e) {
      console.error("[TourProductPageBody] Supabase load failed, using JSON bundle", slug, e);
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
      console.error("[TourProductPageBody] Supabase EN fallback failed", slug, e);
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

  const checkout = await checkoutPromise;
  const externalReviews = await externalReviewsPromise;

  // C4: the hero renders as a CSS background (parallax slides), which the browser
  // can't discover until CSS parses — so it's a late LCP on the highest-traffic
  // page. Preload the first slide (hero.imageUrl) at high priority so the fetch
  // starts during HTML parse. Hint only; no layout/visual change.
  const heroImageUrl = viewModel.hero?.imageUrl?.trim();
  if (heroImageUrl) {
    ReactDOM.preload(heroImageUrl, { as: "image", fetchPriority: "high" });
  }

  const jsonLdScripts = tourProductJsonLdScripts(viewModel, slug);

  // Recommendations: rank all other tours by a similarity score (region token
  // overlap + badge overlap + duration tier + price band) with a popularity
  // tiebreak and a per-region diversity cap. Replaces the prior "same region
  // first, slice(0,6)" heuristic that always returned the same 6 cards.
  // Unpriced items are dropped so off-season products don't render as $0 cards.
  const allCatalog = listStaticTourProducts(locale);
  const anchor = allCatalog.find((p) => p.slug === slug);
  const recommendations: readonly StaticTourProductRegistration[] = anchor
    ? pickTourRecommendations(anchor, allCatalog, { k: 6 })
    : allCatalog.filter((p) => p.slug !== slug && p.listPriceUsd > 0).slice(0, 6);

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
        externalReviews={externalReviews}
      />
    </>
  );
}
