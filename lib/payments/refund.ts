// Pure refund-amount resolution for the admin refund route (W5.7 / W-10).
// Keeps the money math (partial vs full, double-refund guard) out of the route
// so it can be golden-tested. All amounts are in MINOR units (e.g. cents) to
// match Stripe; the route converts to major units only for the numeric DB
// column.

export type RefundAmountError =
  | 'nothing_captured' // no captured charge exists to refund
  | 'already_fully_refunded' // the captured amount is already fully refunded
  | 'amount_must_be_positive' // explicit amount <= 0
  | 'exceeds_remaining'; // explicit amount > captured - alreadyRefunded

export type RefundAmountResult =
  | { ok: true; amountMinor: number; isFullRefund: boolean; remainingAfterMinor: number }
  | { ok: false; error: RefundAmountError };

/**
 * Decide how much to refund.
 *
 * @param capturedMinor       amount actually captured (charge.amount_captured)
 * @param alreadyRefundedMinor amount already refunded so far (charge.amount_refunded)
 * @param requestedMinor      admin-specified partial amount; omitted/null → refund the full remaining
 *
 * `isFullRefund` is true when, after this refund, the entire captured amount is
 * refunded (so callers can set payment_status='refunded' vs 'partially_refunded').
 */
export function resolveRefundAmount(opts: {
  capturedMinor: number;
  alreadyRefundedMinor?: number;
  requestedMinor?: number | null;
}): RefundAmountResult {
  const captured = Math.trunc(opts.capturedMinor);
  const already = Math.trunc(opts.alreadyRefundedMinor ?? 0);

  if (captured <= 0) return { ok: false, error: 'nothing_captured' };

  const remaining = captured - already;
  if (remaining <= 0) return { ok: false, error: 'already_fully_refunded' };

  let amount: number;
  if (opts.requestedMinor == null) {
    amount = remaining; // default: refund everything still refundable
  } else {
    const requested = Math.trunc(opts.requestedMinor);
    if (requested <= 0) return { ok: false, error: 'amount_must_be_positive' };
    if (requested > remaining) return { ok: false, error: 'exceeds_remaining' };
    amount = requested;
  }

  const remainingAfter = remaining - amount;
  return {
    ok: true,
    amountMinor: amount,
    isFullRefund: already + amount >= captured,
    remainingAfterMinor: remainingAfter,
  };
}

const STRIPE_REFUND_REASONS = new Set(['duplicate', 'fraudulent', 'requested_by_customer']);

/** Narrow an arbitrary admin reason to a Stripe-accepted refund reason, else undefined. */
export function toStripeRefundReason(
  reason: string | null | undefined,
): 'duplicate' | 'fraudulent' | 'requested_by_customer' | undefined {
  return reason && STRIPE_REFUND_REASONS.has(reason)
    ? (reason as 'duplicate' | 'fraudulent' | 'requested_by_customer')
    : undefined;
}
