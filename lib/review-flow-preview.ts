/**
 * Offline review wizard demo at `/reviews/preview`.
 * Enable locally with NEXT_PUBLIC_REVIEW_FLOW_PREVIEW=1 in `.env.local`.
 * Do not set in production unless you intentionally want a public mock URL.
 */
export function isReviewFlowPreviewEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_REVIEW_FLOW_PREVIEW?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}
