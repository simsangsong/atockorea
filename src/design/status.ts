import { COPY } from "./copy";
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

export const joinStatusConfig = {
  waiting: {
    label: COPY.joinStatus.waiting,
    help: COPY.joinStatusHelp.waiting,
    tone: "warning",
  },
  balance_open: {
    label: COPY.joinStatus.balanceOpen,
    help: COPY.joinStatusHelp.balanceOpen,
    tone: "info",
  },
  confirmed: {
    label: COPY.joinStatus.confirmed,
    help: COPY.joinStatusHelp.confirmed,
    tone: "success",
  },
  missed_deadline: {
    label: COPY.joinStatus.missedDeadline,
    help: COPY.joinStatusHelp.missedDeadline,
    tone: "error",
  },
  private_only: {
    label: COPY.joinStatus.privateOnly,
    help: COPY.joinStatusHelp.privateOnly,
    tone: "neutral",
  },
  join_unavailable: {
    label: COPY.joinStatus.joinUnavailable,
    help: COPY.joinStatusHelp.joinUnavailable,
    tone: "neutral",
  },
} as const;

export const bookingStatusConfig = {
  pending: { label: COPY.myTour.status.pending, tone: "neutral" as const },
  deposit_paid: { label: COPY.myTour.status.depositPaid, tone: "info" as const },
  awaiting_balance: { label: COPY.myTour.status.awaitingBalance, tone: "warning" as const },
  balance_due: { label: COPY.myTour.status.balanceDue, tone: "warning" as const },
  confirmed: { label: COPY.myTour.status.confirmed, tone: "success" as const },
  completed: { label: COPY.myTour.status.completed, tone: "neutral" as const },
  cancelled: { label: COPY.myTour.status.cancelled, tone: "neutral" as const },
  refunded: { label: COPY.myTour.status.refunded, tone: "neutral" as const },
  deadline_missed: { label: COPY.myTour.status.deadlineMissed, tone: "error" as const },
} as const;
