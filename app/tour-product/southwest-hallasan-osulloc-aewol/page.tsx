import type { Metadata } from "next";
import { southwestHallasanOsullocAewolStaticProduct } from "@/components/product-tour-static/catalog/staticTourProductRegistry";
import { SouthwestHallasanOsullocAewolDetailClient } from "@/components/product-tour-static/southwest-hallasan-osulloc-aewol/SouthwestHallasanOsullocAewolDetailClient";
import { createAnonServerClient } from "@/lib/supabase";
import { loadTourProductViewModelBySlugFromSupabase } from "@/lib/tour-product/loadTourProductPage";
import { resolveTourProductDbLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

const SLUG = "southwest-hallasan-osulloc-aewol" as const;

/** JSON seo 블록과 동일한 카피 (정적 메타) */
const META_DESCRIPTION =
  "A balanced Southwest Jeju day with Hallasan Eoseungsaengak, Daepo Jusangjeolli Cliff, Cheonjeyeon Falls, O’Sulloc Tea Museum, and a relaxed finish at Aewol Cafe Street.";

export const metadata: Metadata = {
  title: `${southwestHallasanOsullocAewolStaticProduct.title} | AtoC Korea`,
  description: META_DESCRIPTION,
};

export default async function SouthwestHallasanOsullocAewolProductPage() {
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
      console.error("[SouthwestHallasanOsullocAewolProductPage] Supabase load failed, using static bundle", e);
    }
  }

  return <SouthwestHallasanOsullocAewolDetailClient viewModel={viewModel} checkout={null} />;
}
