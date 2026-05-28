/**
 * Currency-aware money formatting for `bookings` rows (Phase 10.6 D16/D23).
 *
 * Tour-product bookings: USD (numeric dollars, two-decimal). Builder
 * bookings: KRW (integer won, zero-decimal). Single shared helper so every
 * admin + customer-facing surface renders the right symbol + precision.
 *
 * Used by:
 *   - app/admin/orders/page.tsx (list)
 *   - app/admin/orders/[id]/page.tsx (detail Hold Amount + Total)
 *   - app/admin/page.tsx (dashboard total revenue + recent bookings)
 *   - app/api/bookings/[id]/receipt/route.ts (customer-printable receipt)
 *   - any future surface that renders a booking total
 */

export type BookingCurrency = "usd" | "krw" | string | null | undefined;

/**
 * Format a `bookings.final_price` (or any whole-number `numeric` field) for
 * display, respecting the booking's `currency` column.
 *
 * Defaults to USD if the currency is missing/unknown so legacy callers
 * that forgot to read `bookings.currency` don't regress to a hard NaN —
 * the same default as the column's `DEFAULT 'usd'` in Postgres.
 */
export function formatBookingPrice(amount: number, currency: BookingCurrency): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  if (currency === "krw") {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
      maximumFractionDigits: 0,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Short symbol-only label for cramped surfaces (chips, badges, footers).
 */
export function currencySymbol(currency: BookingCurrency): string {
  return currency === "krw" ? "₩" : "$";
}

/**
 * Format the Stripe authorization-hold amount, given the booking's
 * `final_price` + `currency` (preferred) OR the legacy
 * `no_show_fee_usd_cents` snapshot (USD-only).
 *
 * Returns "—" if no usable amount is available. The `final_price` path
 * is the canonical one after Phase 10.2 — the `no_show_fee_usd_cents`
 * column is NULL for KRW bookings (per /api/stripe/checkout:231).
 */
export function formatHoldAmount(
  finalPrice: number | string | null | undefined,
  currency: BookingCurrency,
  fallbackUsdCents?: number | null | undefined,
): string {
  const n = finalPrice != null ? Number(finalPrice) : NaN;
  if (Number.isFinite(n) && n > 0) {
    return formatBookingPrice(n, currency);
  }
  if (typeof fallbackUsdCents === "number" && Number.isFinite(fallbackUsdCents) && fallbackUsdCents > 0) {
    return formatBookingPrice(fallbackUsdCents / 100, "usd");
  }
  return "—";
}
