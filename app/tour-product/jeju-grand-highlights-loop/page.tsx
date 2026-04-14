import type { Metadata } from "next";
import { jejuGrandHighlightsLoopStaticProduct } from "@/components/product-tour-static/catalog/staticTourProductRegistry";
import { JejuGrandHighlightsLoopDetailClient } from "@/components/product-tour-static/jeju-grand-highlights-loop/JejuGrandHighlightsLoopDetailClient";
import { createAnonServerClient } from "@/lib/supabase";
import { loadTourProductViewModelBySlugFromSupabase } from "@/lib/tour-product/loadTourProductPage";
import { resolveTourProductDbLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

const SLUG = "jeju-grand-highlights-loop" as const;

const META_DESCRIPTION =
  "A fast-paced one-day Jeju loop for travelers who want the island's biggest highlights in a single day—Hallasan, Jusangjeolli, Jeongbang, and Seongsan Ilchulbong.";

export const metadata: Metadata = {
  title: `${jejuGrandHighlightsLoopStaticProduct.title} | AtoC Korea`,
  description: META_DESCRIPTION,
};

export default async function JejuGrandHighlightsLoopProductPage() {
  let viewModel = undefined;
  if (process.env.TOUR_PRODUCT_USE_SUPABASE === "1") {
    try {
      const supabase = createAnonServerClient();
      const locale = await resolveTourProductDbLocale();
      let fromDb = await loadTourProductViewModelBySlugFromSupabase(supabase, SLUG, locale);
      if (!fromDb && locale !== "en") {
        fromDb = await loadTourProductViewModelBySlugFromSupabase(supabase, SLUG, "en");
      }
      if (fromDb) viewModel = fromDb;
    } catch (e) {
      console.error("[JejuGrandHighlightsLoopProductPage] Supabase load failed, using static bundle", e);
    }
  }

  return <JejuGrandHighlightsLoopDetailClient viewModel={viewModel} checkout={null} />;
}
