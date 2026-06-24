/**
 * Booking status state machine for the admin orders PUT (W3.2 / B-3).
 *
 * The route previously accepted any `body.status` string, so illegal moves
 * (completed→pending, cancelled→confirmed) and arbitrary values ("hacked")
 * were written straight to the row. These helpers gate the transition.
 *
 * `no_show` is intentionally NOT admin-settable here — it is reached only via
 * the settlement action (which captures the penalty). `pending`/`confirmed` are
 * non-terminal; `completed`/`cancelled`/`no_show` are terminal.
 */
export const ADMIN_SETTABLE_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'] as const;
export type AdminSettableStatus = (typeof ADMIN_SETTABLE_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['confirmed', 'completed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function isValidAdminStatus(status: string): status is AdminSettableStatus {
  return (ADMIN_SETTABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Whether an admin may move a booking from `current` to `next`. Same-status is
 * allowed (idempotent no-op). Assumes `next` is already a valid admin status.
 */
export function isAllowedStatusTransition(current: string, next: string): boolean {
  if (current === next) return true;
  return (ALLOWED_TRANSITIONS[current] ?? []).includes(next);
}
