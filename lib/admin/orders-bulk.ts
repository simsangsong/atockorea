/**
 * U-7 bulk order status change (pure logic). Bulk is intentionally limited to
 * the two side-effect-free forward transitions (confirmed / completed) — cancel
 * is excluded because it emails the customer + restores inventory per row, and
 * no_show is settlement-only. Per-row transitions are still gated by the B-3
 * state machine so illegal moves are skipped, not written.
 */
import { isValidAdminStatus, isAllowedStatusTransition } from './booking-status-transition';

export const BULK_ORDER_STATUSES = ['confirmed', 'completed'] as const;
export type BulkOrderStatus = (typeof BULK_ORDER_STATUSES)[number];

export function isBulkOrderStatus(status: string): status is BulkOrderStatus {
  return (BULK_ORDER_STATUSES as readonly string[]).includes(status);
}

/** Bound a single bulk request. */
export const MAX_BULK_ORDER_IDS = 200;

/** Pure: normalize a bulk booking-id list — non-empty strings, deduped, capped. */
export function parseBulkOrderIds(input: unknown): { ids: string[]; error?: string } {
  if (!Array.isArray(input)) return { ids: [], error: 'ids_must_be_array' };

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const value of input) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    ids.push(trimmed);
  }

  if (ids.length === 0) return { ids: [], error: 'no_valid_ids' };
  if (ids.length > MAX_BULK_ORDER_IDS) return { ids: [], error: 'too_many_ids' };
  return { ids };
}

/**
 * Pure: split fetched rows into the ids whose transition to `target` is allowed
 * vs the ones skipped (illegal transition / unknown target). Same-status is an
 * allowed idempotent no-op per the state machine.
 */
export function partitionBulkTransitions(
  rows: { id: string; status: string }[],
  target: string,
): { valid: string[]; skipped: { id: string; status: string }[] } {
  const valid: string[] = [];
  const skipped: { id: string; status: string }[] = [];
  const targetOk = isValidAdminStatus(target);
  for (const row of rows) {
    if (targetOk && isAllowedStatusTransition(row.status, target)) valid.push(row.id);
    else skipped.push({ id: row.id, status: row.status });
  }
  return { valid, skipped };
}
