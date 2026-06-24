import { resolveRefundAmount, toStripeRefundReason } from '@/lib/payments/refund';

describe('resolveRefundAmount', () => {
  it('refunds the full captured amount by default', () => {
    const r = resolveRefundAmount({ capturedMinor: 10000 });
    expect(r).toEqual({ ok: true, amountMinor: 10000, isFullRefund: true, remainingAfterMinor: 0 });
  });

  it('refunds the full REMAINING amount by default after a prior partial', () => {
    const r = resolveRefundAmount({ capturedMinor: 10000, alreadyRefundedMinor: 4000 });
    expect(r).toEqual({ ok: true, amountMinor: 6000, isFullRefund: true, remainingAfterMinor: 0 });
  });

  it('honours an explicit partial amount and reports it is not a full refund', () => {
    const r = resolveRefundAmount({ capturedMinor: 10000, requestedMinor: 2500 });
    expect(r).toEqual({ ok: true, amountMinor: 2500, isFullRefund: false, remainingAfterMinor: 7500 });
  });

  it('marks isFullRefund when an explicit amount clears the remaining balance', () => {
    const r = resolveRefundAmount({ capturedMinor: 10000, alreadyRefundedMinor: 7000, requestedMinor: 3000 });
    expect(r).toEqual({ ok: true, amountMinor: 3000, isFullRefund: true, remainingAfterMinor: 0 });
  });

  it('rejects refunding when nothing was captured', () => {
    expect(resolveRefundAmount({ capturedMinor: 0 })).toEqual({ ok: false, error: 'nothing_captured' });
  });

  it('rejects when already fully refunded (double-refund guard)', () => {
    expect(resolveRefundAmount({ capturedMinor: 10000, alreadyRefundedMinor: 10000 })).toEqual({
      ok: false,
      error: 'already_fully_refunded',
    });
  });

  it('rejects a non-positive explicit amount', () => {
    expect(resolveRefundAmount({ capturedMinor: 10000, requestedMinor: 0 })).toEqual({
      ok: false,
      error: 'amount_must_be_positive',
    });
    expect(resolveRefundAmount({ capturedMinor: 10000, requestedMinor: -5 })).toEqual({
      ok: false,
      error: 'amount_must_be_positive',
    });
  });

  it('rejects an explicit amount that exceeds the remaining balance', () => {
    expect(resolveRefundAmount({ capturedMinor: 10000, alreadyRefundedMinor: 6000, requestedMinor: 5000 })).toEqual(
      { ok: false, error: 'exceeds_remaining' },
    );
    expect(resolveRefundAmount({ capturedMinor: 10000, requestedMinor: 10001 })).toEqual({
      ok: false,
      error: 'exceeds_remaining',
    });
  });

  it('truncates fractional minor units defensively', () => {
    const r = resolveRefundAmount({ capturedMinor: 10000.9, requestedMinor: 2500.7 });
    expect(r).toEqual({ ok: true, amountMinor: 2500, isFullRefund: false, remainingAfterMinor: 7500 });
  });
});

describe('toStripeRefundReason', () => {
  it('passes through Stripe-accepted reasons', () => {
    expect(toStripeRefundReason('duplicate')).toBe('duplicate');
    expect(toStripeRefundReason('fraudulent')).toBe('fraudulent');
    expect(toStripeRefundReason('requested_by_customer')).toBe('requested_by_customer');
  });

  it('drops arbitrary/empty reasons (kept in metadata instead)', () => {
    expect(toStripeRefundReason('customer_changed_mind')).toBeUndefined();
    expect(toStripeRefundReason('')).toBeUndefined();
    expect(toStripeRefundReason(null)).toBeUndefined();
    expect(toStripeRefundReason(undefined)).toBeUndefined();
  });
});
