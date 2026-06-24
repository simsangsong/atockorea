/**
 * Amount (in the PaymentIntent's smallest currency unit) to pass as Stripe's
 * `amount_to_capture` when settling a booking's authorization hold.
 *
 * Returns `undefined` to mean "omit `amount_to_capture`" → Stripe captures the
 * full authorized amount. That is the correct behaviour for tour-completed
 * captures and for any case where we lack a currency-matched no-show fee
 * snapshot.
 *
 * For a no-show we want to charge only the no-show fee, never the full hold
 * (B-1: previously `capture()` was called with no amount, so Stripe defaulted to
 * capturing the entire authorization). The fee snapshot `no_show_fee_usd_cents`
 * is denominated in USD cents and is only populated for USD holds, so it can
 * only be applied when the hold's currency is USD; KRW holds have no separate
 * fee snapshot and fall back to a full capture. The amount is clamped to the
 * authorized amount so we never attempt to capture more than was held.
 *
 * Today the fee snapshot equals the full hold for USD bookings, so this is a
 * no-op for existing data — but it makes the capture amount explicit and bounded
 * so introducing a partial no-show fee later cannot silently over-charge.
 */
export function noShowCaptureAmount(params: {
  reason: string;
  holdCurrency: string;
  noShowFeeUsdCents: number | null | undefined;
  authorizedAmountMinor: number;
}): number | undefined {
  const { reason, holdCurrency, noShowFeeUsdCents, authorizedAmountMinor } = params;
  if (reason !== 'no_show') return undefined;
  if ((holdCurrency || '').toLowerCase() !== 'usd') return undefined;
  const fee = Number(noShowFeeUsdCents);
  if (!Number.isInteger(fee) || fee <= 0) return undefined;
  if (!Number.isFinite(authorizedAmountMinor) || authorizedAmountMinor <= 0) return undefined;
  return Math.min(fee, authorizedAmountMinor);
}
