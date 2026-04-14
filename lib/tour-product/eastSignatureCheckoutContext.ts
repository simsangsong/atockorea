import { createAnonServerClient } from "@/lib/supabase";
import { getKrwPerUsd } from "@/lib/exchange/usdBasedRates.server";
import { tourListPricesToUsdSync } from "@/lib/tour-list-price-usd.server";

export type TourProductCheckoutContext = {
  tourId: string;
  /** List unit in USD (major units); UI uses CurrencyProvider to show other currencies. */
  unitPriceUsd: number;
  priceType: "person" | "group";
};

/**
 * /tour-product/east-signature-nature-core → 기존 /tour/[id]/checkout Stripe 플로우 연결용.
 * 1) Supabase `tours.slug = east-signature-nature-core` → list unit in USD
 * 2) 실패 시 env: TOUR_PRODUCT_EAST_SIGNATURE_TOUR_ID + TOUR_PRODUCT_EAST_SIGNATURE_UNIT_PRICE_USD (또는 기존 _KRW 호환)
 */
export async function getEastSignatureCheckoutContext(): Promise<TourProductCheckoutContext | null> {
  try {
    const supabase = createAnonServerClient();
    const { data, error } = await supabase
      .from("tours")
      .select("id, price, original_price, price_currency, price_type")
      .eq("slug", "east-signature-nature-core")
      .maybeSingle();

    if (!error && data?.id != null && data.price != null) {
      const krwPerUsd = await getKrwPerUsd();
      const { priceUsd } = tourListPricesToUsdSync(
        {
          price: data.price,
          original_price: data.original_price,
          price_currency: (data as { price_currency?: string }).price_currency,
        },
        krwPerUsd
      );
      return {
        tourId: data.id,
        unitPriceUsd: priceUsd,
        priceType: data.price_type === "group" ? "group" : "person",
      };
    }
  } catch {
    // missing Supabase env or RLS — try fallbacks below
  }

  const fallbackId = process.env.TOUR_PRODUCT_EAST_SIGNATURE_TOUR_ID?.trim();
  const fallbackUsd = process.env.TOUR_PRODUCT_EAST_SIGNATURE_UNIT_PRICE_USD?.trim();
  const fallbackKrwLegacy = process.env.TOUR_PRODUCT_EAST_SIGNATURE_UNIT_PRICE_KRW?.trim();
  if (fallbackId && fallbackUsd) {
    const unitPriceUsd = Number(fallbackUsd);
    if (Number.isFinite(unitPriceUsd) && unitPriceUsd > 0) {
      return { tourId: fallbackId, unitPriceUsd, priceType: "person" };
    }
  }
  if (fallbackId && fallbackKrwLegacy) {
    const krw = Number(fallbackKrwLegacy);
    if (Number.isFinite(krw) && krw > 0) {
      const krwPerUsd = await getKrwPerUsd();
      const unitPriceUsd = Math.round((krw / krwPerUsd) * 100) / 100;
      return { tourId: fallbackId, unitPriceUsd, priceType: "person" };
    }
  }

  return null;
}
