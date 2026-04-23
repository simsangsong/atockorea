import type { ProductTypeIntent } from "@/lib/tour-product-match/score-tour-products";
import type { ResolvedProductTypeIntentSnapshot, ScoredProduct, TourMatchNoMatchReason } from "@/lib/tour-product-match/types";

export type TourMatchOutcomeMeta = {
  matchOutcome: "matched" | "no_match";
  noMatchReason: TourMatchNoMatchReason | null;
  fallbackAvailable: boolean;
};

/** Maps parser / resolver output into API snapshot shape. */
export function snapshotFromProductTypeIntent(pt: ProductTypeIntent): ResolvedProductTypeIntentSnapshot {
  return {
    desired_product_type: pt.desired,
    product_type_intent_strength: pt.strength,
  };
}

/**
 * When every row is hard-excluded, classify why (for API + UX).
 *
 * - `no_exact_type_match`: entire catalog mismatched hard product-type
 *   (e.g. private-only vs small_group SKUs). Private/custom fallbacks apply.
 * - `no_step_free_products`: traveler required a strict no-stairs / step-free
 *   experience and no catalog SKU is tagged step-free. No fallback today.
 * - `all_products_excluded`: generic bucket for mixed hard-exclude reasons.
 */
export function computeTourMatchOutcomeMeta(
  ranked: ScoredProduct[],
  matchedProducts: ScoredProduct[],
): TourMatchOutcomeMeta {
  if (matchedProducts.length > 0) {
    return { matchOutcome: "matched", noMatchReason: null, fallbackAvailable: false };
  }

  const reasons = ranked.map((r) => r.excludeReason);

  const allTypeLocked =
    reasons.length > 0 &&
    reasons.every((x) => x === "product_type_private_only" || x === "product_type_mismatch");

  if (allTypeLocked) {
    return { matchOutcome: "no_match", noMatchReason: "no_exact_type_match", fallbackAvailable: true };
  }

  const allStepFreeLocked =
    reasons.length > 0 && reasons.every((x) => x === "strict_no_stairs_request");

  if (allStepFreeLocked) {
    return {
      matchOutcome: "no_match",
      noMatchReason: "no_step_free_products",
      fallbackAvailable: false,
    };
  }

  return { matchOutcome: "no_match", noMatchReason: "all_products_excluded", fallbackAvailable: false };
}
