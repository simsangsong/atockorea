import {
  PAYMENT_STATUS_LABELS,
  paymentStatusLabel,
} from '@/lib/email/payment-status-label';

describe('paymentStatusLabel (LIB-6)', () => {
  it('keeps the full bilingual authorized label (regression: stray "Card registered" override)', () => {
    const label = paymentStatusLabel('authorized');
    // Korean copy must survive...
    expect(label).toContain('카드 등록 완료');
    expect(label).toContain('투어 당일 한국시간 오전 10시 자동 청구');
    // ...alongside the English explanation of the auto-charge timing.
    expect(label).toContain('automatically charged at 10:00 AM KST on tour day');
    // The clobbered value must not reappear.
    expect(label).not.toBe('Card registered');
  });

  it('returns the matching label for every known status', () => {
    expect(paymentStatusLabel('pending')).toBe('결제대기 (Payment Pending)');
    expect(paymentStatusLabel('paid')).toBe('결제 완료 (Payment Completed)');
    expect(paymentStatusLabel('failed')).toBe('결제실패 (Payment Failed)');
    expect(paymentStatusLabel('refunded')).toBe('환불됨 (Refunded)');
  });

  it('falls back to the pending label for unknown / empty / nullish input', () => {
    expect(paymentStatusLabel(undefined)).toBe(PAYMENT_STATUS_LABELS.pending);
    expect(paymentStatusLabel(null)).toBe(PAYMENT_STATUS_LABELS.pending);
    expect(paymentStatusLabel('')).toBe(PAYMENT_STATUS_LABELS.pending);
    expect(paymentStatusLabel('bogus')).toBe(PAYMENT_STATUS_LABELS.pending);
  });

  it('does not resolve inherited Object prototype keys as statuses', () => {
    // Guards the hasOwnProperty check — 'toString'/'constructor' exist on the
    // prototype but are not valid statuses.
    expect(paymentStatusLabel('toString')).toBe(PAYMENT_STATUS_LABELS.pending);
    expect(paymentStatusLabel('constructor')).toBe(PAYMENT_STATUS_LABELS.pending);
  });
});
