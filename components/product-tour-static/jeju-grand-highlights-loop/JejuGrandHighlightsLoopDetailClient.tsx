"use client";

import type { EastSignatureNatureCoreDetailViewModel } from "../east-signature-nature-core/eastSignatureNatureCoreDetailViewModel";
import type { TourProductCheckoutContext } from "@/lib/tour-product/eastSignatureCheckoutContext";
import { TourProductDetailClient } from "@/components/product-tour-static/_shared/TourProductDetailClient";
import { jejuGrandHighlightsLoopDetailViewModel as staticVm } from "./jejuGrandHighlightsViewModelFromJson";

export type JejuGrandHighlightsLoopDetailClientProps = {
  viewModel?: EastSignatureNatureCoreDetailViewModel;
  checkout?: TourProductCheckoutContext | null;
  tourProductSlug: string;
};

/**
 * Thin adapter — preserved so the dedicated `app/tour-product/jeju-grand-highlights-loop/page.tsx`
 * keeps working without touching its callers. New slugs should route through
 * `app/tour-product/[slug]/page.tsx` + `TourProductDetailClient` directly.
 */
export function JejuGrandHighlightsLoopDetailClient({
  viewModel,
  checkout,
  tourProductSlug,
}: JejuGrandHighlightsLoopDetailClientProps) {
  return (
    <TourProductDetailClient
      viewModel={viewModel ?? staticVm}
      checkout={checkout}
      tourProductSlug={tourProductSlug}
    />
  );
}
