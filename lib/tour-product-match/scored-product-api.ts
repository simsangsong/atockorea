import type { ScoredProduct } from "@/lib/tour-product-match/types";

/** Max non-excluded rows returned in API (payload size). */
export const MATCHED_PRODUCTS_API_CAP = 5;

/** Max rows in `ranked` returned in API (includes excluded). */
export const RANKED_API_CAP = 10;

const SLIM_BREAKDOWN_KEYS = new Set([
  "typeGate",
  "typeScore",
  "fitScore",
  "indoorWeatherScore",
  "keywordBoost",
  "indoor_ratio_norm",
  "weather_sensitivity_norm",
]);

/** Drop verbose keys like `soft_pre_confidence` from default JSON responses. */
export function slimScoredProductForApi(r: ScoredProduct): ScoredProduct {
  const b = r.breakdown;
  if (b.excluded === 1) {
    return { ...r, breakdown: { excluded: 1 } };
  }
  const slim: Record<string, number> = {};
  for (const k of SLIM_BREAKDOWN_KEYS) {
    const v = b[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      slim[k] = v;
    }
  }
  return { ...r, breakdown: slim };
}

export function capMatchedProductsForApi(matched: ScoredProduct[]): ScoredProduct[] {
  return matched.slice(0, MATCHED_PRODUCTS_API_CAP).map(slimScoredProductForApi);
}

export function capRankedForApi(ranked: ScoredProduct[]): ScoredProduct[] {
  return ranked.slice(0, RANKED_API_CAP).map(slimScoredProductForApi);
}
