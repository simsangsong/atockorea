/**
 * 결제상태 표시 라벨 (Payment status labels) — LIB-6.
 *
 * Bilingual KO/EN labels for the customer-facing transactional emails. Extracted
 * to a side-effect-free module so it can be unit tested without pulling in the
 * Resend client that `lib/email.ts` instantiates at import time.
 *
 * Regression guard: the `authorized` label MUST keep its full bilingual
 * explanation of the card-on-file / auto-charge-at-10:00-KST flow. A stray
 * `PAYMENT_STATUS_LABELS.authorized = 'Card registered'` override (introduced
 * in PR #134) previously clobbered it down to a bare English string, dropping
 * the Korean copy and the charge-timing explanation customers rely on.
 */
export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: '결제대기 (Payment Pending)',
  authorized:
    '카드 등록 완료 — 투어 당일 한국시간 오전 10시 자동 청구 (Card on file — automatically charged at 10:00 AM KST on tour day)',
  paid: '결제 완료 (Payment Completed)',
  failed: '결제실패 (Payment Failed)',
  refunded: '환불됨 (Refunded)',
};

/**
 * Resolve a payment status to its display label. Unknown / undefined statuses
 * fall back to the `pending` label (the safe default for an unconfirmed
 * payment), matching the prior inline behavior.
 */
export function paymentStatusLabel(status?: string | null): string {
  if (status && Object.prototype.hasOwnProperty.call(PAYMENT_STATUS_LABELS, status)) {
    return PAYMENT_STATUS_LABELS[status as PaymentStatus];
  }
  return PAYMENT_STATUS_LABELS.pending;
}
