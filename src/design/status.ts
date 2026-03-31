import { getCopy } from "@/lib/copy-messages";
import type { Locale } from "@/lib/locale";
import type { BookingStatus } from "@/src/types/booking";

/**
 * Display-only mapping from raw API booking status to UI status.
 * Prefer neutral labels for ambiguous raw values (e.g. "pending" → "Pending", not "Deposit Paid").
 * Do not use for actionable logic (e.g. balance due, countdown).
 */
export const rawBookingStatusToDisplayStatus: Record<string, BookingStatus> = {
  pending: "pending",
  confirmed: "confirmed",
  cancelled: "cancelled",
  completed: "completed",
  refunded: "refunded",
};

export function getJoinStatusConfig(locale: Locale) {
  const c = getCopy(locale);
  return {
    waiting: {
      label: c.joinStatus.waiting,
      help: c.joinStatusHelp.waiting,
      tone: "warning",
    },
    balance_open: {
      label: c.joinStatus.balanceOpen,
      help: c.joinStatusHelp.balanceOpen,
      tone: "info",
    },
    confirmed: {
      label: c.joinStatus.confirmed,
      help: c.joinStatusHelp.confirmed,
      tone: "success",
    },
    missed_deadline: {
      label: c.joinStatus.missedDeadline,
      help: c.joinStatusHelp.missedDeadline,
      tone: "error",
    },
    private_only: {
      label: c.joinStatus.privateOnly,
      help: c.joinStatusHelp.privateOnly,
      tone: "neutral",
    },
    join_unavailable: {
      label: c.joinStatus.joinUnavailable,
      help: c.joinStatusHelp.joinUnavailable,
      tone: "neutral",
    },
  } as const;
}

export function getBookingStatusConfig(locale: Locale) {
  const c = getCopy(locale);
  return {
    pending: { label: c.myTour.status.pending, tone: "neutral" as const },
    deposit_paid: { label: c.myTour.status.paymentReceived, tone: "info" as const },
    awaiting_balance: { label: c.myTour.status.awaitingBalance, tone: "warning" as const },
    balance_due: { label: c.myTour.status.balanceDue, tone: "warning" as const },
    confirmed: { label: c.myTour.status.confirmed, tone: "success" as const },
    completed: { label: c.myTour.status.completed, tone: "neutral" as const },
    cancelled: { label: c.myTour.status.cancelled, tone: "neutral" as const },
    refunded: { label: c.myTour.status.refunded, tone: "neutral" as const },
    deadline_missed: { label: c.myTour.status.deadlineMissed, tone: "error" as const },
  } as const;
}
