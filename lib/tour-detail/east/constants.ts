/** Canonical list price in USD (matches `tours.price` when `price_currency = USD`). */
export const EAST_SIGNATURE_LIST_PRICE_USD = 58;

/** Marketing anchor when tour row missing (same as list USD). */
export const EAST_SIGNATURE_ANCHOR_USD = EAST_SIGNATURE_LIST_PRICE_USD;

/** When `CurrencyProvider` is absent — approximate spot only; live site uses `/api/currency/rate`. */
export const EAST_STICKY_FALLBACK_KRW_PER_USD = 1480;

/**
 * Legacy hook fallback KRW (~ list USD × rough spot). Live pages use DB + `tourListPricesToKrw`.
 */
export const EAST_SIGNATURE_DEFAULT_LIST_KRW = Math.round(
  EAST_SIGNATURE_LIST_PRICE_USD * EAST_STICKY_FALLBACK_KRW_PER_USD,
);
