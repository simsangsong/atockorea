import type { Metadata } from "next";
import { eastSignatureNatureCoreStaticProduct } from "@/components/product-tour-static/catalog/staticTourProductRegistry";
import { EastSignatureNatureCoreDetailClient } from "@/components/product-tour-static/east-signature-nature-core/EastSignatureNatureCoreDetailClient";
import { eastSignatureNatureCoreProduct } from "@/components/product-tour-static/east-signature-nature-core/staticProductData";
import { createAnonServerClient } from "@/lib/supabase";
import { getEastSignatureCheckoutContext } from "@/lib/tour-product/eastSignatureCheckoutContext";
import { loadEastSignatureTourProductViewModelFromSupabase } from "@/lib/tour-product/loadTourProductPage";
import { resolveTourProductDbLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

export const metadata: Metadata = {
  title: `${eastSignatureNatureCoreStaticProduct.title} | AtoC Korea`,
  description: eastSignatureNatureCoreProduct.description,
};

export default async function EastSignatureNatureCoreProductPage() {
  let viewModel = undefined;
  if (process.env.TOUR_PRODUCT_USE_SUPABASE === "1") {
    try {
      const supabase = createAnonServerClient();
      const locale = await resolveTourProductDbLocale();
      let fromDb = await loadEastSignatureTourProductViewModelFromSupabase(supabase, locale);
      if (!fromDb && locale !== "en") {
        fromDb = await loadEastSignatureTourProductViewModelFromSupabase(supabase, "en");
      }
      if (fromDb) viewModel = fromDb;
    } catch (e) {
      console.error("[EastSignatureNatureCoreProductPage] Supabase load failed, using static bundle", e);
    }
  }

  let checkout: Awaited<ReturnType<typeof getEastSignatureCheckoutContext>> = null;
  try {
    checkout = await getEastSignatureCheckoutContext();
  } catch (e) {
    console.error("[EastSignatureNatureCoreProductPage] checkout context unavailable", e);
  }

  return <EastSignatureNatureCoreDetailClient viewModel={viewModel} checkout={checkout} />;
}
