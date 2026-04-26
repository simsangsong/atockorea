import type { Metadata } from "next";
import { JejuGrandHighlightsLoopDetailClient } from "@/components/product-tour-static/jeju-grand-highlights-loop/JejuGrandHighlightsLoopDetailClient";
import { getJejuGrandHighlightsLoopFullPageJson } from "@/components/product-tour-static/jeju-grand-highlights-loop/jejuGrandHighlightsLocaleBundles";
import { buildJejuGrandHighlightsLoopDetailViewModelFromJson } from "@/components/product-tour-static/jeju-grand-highlights-loop/jejuGrandHighlightsViewModelFromJson";
import { tourProductJsonLdScripts } from "@/lib/seo/tourProductJsonLd";
import { createAnonServerClient } from "@/lib/supabase";
import { getTourProductCheckoutContext } from "@/lib/tour-product/eastSignatureCheckoutContext";
import { loadTourProductViewModelBySlugFromSupabase } from "@/lib/tour-product/loadTourProductPage";
import { resolveTourProductDbLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

const SLUG = "jeju-grand-highlights-loop" as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveTourProductDbLocale();
  const doc = getJejuGrandHighlightsLoopFullPageJson(locale);
  const seo = doc.seo as { pageTitle: string; metaDescription: string };
  return {
    title: seo.pageTitle,
    description: seo.metaDescription,
  };
}

/**
 * 본문: 로케일별 정적 JSON 번들(기본). `NEXT_LOCALE` 쿠키와 동기.
 * `TOUR_PRODUCT_USE_SUPABASE=1` 이고 `TOUR_PRODUCT_JEJU_GRAND_FORCE_STATIC` 가 아니면, 완전한 DB 행이 있을 때만 덮어씀.
 */
export default async function JejuGrandHighlightsLoopProductPage() {
  const locale = await resolveTourProductDbLocale();

  let viewModel = undefined;
  const forceStatic = process.env.TOUR_PRODUCT_JEJU_GRAND_FORCE_STATIC === "1";
  if (process.env.TOUR_PRODUCT_USE_SUPABASE === "1" && !forceStatic) {
    try {
      const supabase = createAnonServerClient();
      let fromDb = await loadTourProductViewModelBySlugFromSupabase(supabase, SLUG, locale);
      if (!fromDb && locale !== "en") {
        fromDb = await loadTourProductViewModelBySlugFromSupabase(supabase, SLUG, "en");
      }
      if (fromDb) viewModel = fromDb;
    } catch (e) {
      console.error("[JejuGrandHighlightsLoopProductPage] Supabase load failed, using JSON bundle", e);
    }
  }

  const staticBundleVm = buildJejuGrandHighlightsLoopDetailViewModelFromJson(locale);

  let checkout: Awaited<ReturnType<typeof getTourProductCheckoutContext>> = null;
  try {
    checkout = await getTourProductCheckoutContext(SLUG);
  } catch (e) {
    console.error("[JejuGrandHighlightsLoopProductPage] checkout context unavailable", e);
  }

  const resolvedVm = viewModel ?? staticBundleVm;
  const jsonLdScripts = tourProductJsonLdScripts(resolvedVm, SLUG);

  return (
    <>
      {jsonLdScripts.map((json, idx) => (
        <script
          key={`tour-product-jsonld-${idx}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: json }}
        />
      ))}
      <JejuGrandHighlightsLoopDetailClient
        viewModel={resolvedVm}
        checkout={checkout}
        tourProductSlug={SLUG}
      />
    </>
  );
}
