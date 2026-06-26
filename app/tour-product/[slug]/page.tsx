import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { buildTourProductViewModelFromFullPageJson } from "@/components/product-tour-static/_shared/buildTourProductViewModelFromJson";
import { coerceSeedDateYmd, coerceSeedLanguage } from "@/components/product-tour-static/_shared/bookingSeedParams";
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
import { resolveTourProductDbLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import { isTourSlugBlockedFromConsumerSurfaces } from "@/lib/tour-consumer-visibility";

type RouteParams = { slug: string };
type RouteSearchParams = {
  locale?: string | string[];
  party?: string | string[];
  // Deep-link seeding (AI agents / shared links): pre-fill the booking card.
  date?: string | string[];
  guests?: string | string[];
  language?: string | string[];
  lang?: string | string[];
};

/**
 * U9 carry-through — parse the upstream `?party=` group size (home stepper →
 * /tours/list → detail) into a guest count for the booking cards. Returns
 * undefined for missing/invalid input so the cards keep their default.
 */
function parsePartyParam(raw: string | string[] | undefined): number | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

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
  // `?party=` (legacy carry-through) and `?guests=` (agent deep-link) both seed
  // the group size; `?date=` and `?language=` pre-fill the booking card so a URL
  // an AI agent constructs lands the traveller ready to confirm.
  const initialGuests = parsePartyParam(sp.party ?? sp.guests);
  const seedDateYmd = coerceSeedDateYmd(sp.date);
  const seedLanguage = coerceSeedLanguage(sp.language ?? sp.lang);

  // B3: the checkout context depends only on `slug`, so kick it off now and let it
  // run concurrently with the (multi-step, DB round-trip) viewModel resolution
  // below instead of awaiting it sequentially afterward. Errors degrade to null,
  // matching the prior try/catch behavior.
  const checkoutPromise = getTourProductCheckoutContext(slug).catch((e) => {
    console.error("[RegisteredTourProductPage] checkout context unavailable", slug, e);
    return null;
  });

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
      console.error("[RegisteredTourProductPage] Supabase client unavailable, using JSON bundle", slug, e);
    }
  }

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

  const checkout = await checkoutPromise;

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
        initialGuests={initialGuests}
        seedDateYmd={seedDateYmd}
        seedLanguage={seedLanguage}
      />
    </>
  );
}
