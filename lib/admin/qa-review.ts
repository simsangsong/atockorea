/**
 * Shared Q&A review logic (single + bulk). Pure — no DB/IO — so it is unit
 * testable and used by both /api/admin/qa-pairs/[id] (single) and
 * /api/admin/qa-pairs (bulk, U-7).
 */

export const QA_REVIEW_ACTIONS = [
  "true",
  "false",
  "needs_edit",
  "approve",
  "reject",
  "reset",
] as const;

export type QaReviewAction = (typeof QA_REVIEW_ACTIONS)[number];

/** Action -> persisted review state. 'true'/'false' are legacy aliases. */
export const QA_REVIEW_STATUS_MAP: Record<
  QaReviewAction,
  { review_status: string; is_active: boolean }
> = {
  true: { review_status: "approved", is_active: true },
  false: { review_status: "rejected", is_active: false },
  needs_edit: { review_status: "needs_edit", is_active: false },
  approve: { review_status: "approved", is_active: true },
  reject: { review_status: "rejected", is_active: false },
  reset: { review_status: "draft", is_active: false },
};

export function resolveReviewStatus(action: QaReviewAction): {
  review_status: string;
  is_active: boolean;
} {
  return QA_REVIEW_STATUS_MAP[action];
}

/** Upper bound on a single bulk request (matches the list page's load limit). */
export const MAX_BULK_REVIEW_IDS = 100;

/**
 * Pure: normalize a bulk id list — finite positive integers, deduped, order
 * preserved. Returns an error code when the input is unusable or oversized so
 * the route can answer 400 instead of silently truncating.
 */
export function parseBulkIds(input: unknown): { ids: number[]; error?: string } {
  if (!Array.isArray(input)) return { ids: [], error: "ids_must_be_array" };

  const ids: number[] = [];
  const seen = new Set<number>();
  for (const value of input) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n <= 0) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    ids.push(n);
  }

  if (ids.length === 0) return { ids: [], error: "no_valid_ids" };
  if (ids.length > MAX_BULK_REVIEW_IDS) return { ids: [], error: "too_many_ids" };
  return { ids };
}
