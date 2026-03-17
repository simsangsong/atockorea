export interface BookingTimeline {
  now: string;
  tourStartAt: string;
  refundDeadlineAt: string;
  balanceOpensAt: string;
  balanceDueAt: string;
  autoCharge: false;
}

export type BookingStatus =
  | "pending"
  | "deposit_paid"
  | "awaiting_balance"
  | "balance_due"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "refunded"
  | "deadline_missed";

export interface MyTourViewModel {
  id: string;
  title: string;
  status: BookingStatus;
  nextStepLabel: string | null;
  primaryActionLabel: string | null;
  primaryActionHref: string | null;
  countdownTarget?: string | null;
  pickupAreaLabel: string;
  matchQuality?: "great" | "good" | "slight";
  remainingBalance?: number | null;
  timeline: BookingTimeline;
}

/** My tour API response. Consume via booking-adapter only. */
export interface MyTourResponse {
  tour: MyTourViewModel;
  paymentHistory: Array<{
    id: string;
    type: "deposit" | "balance" | "refund";
    amount: number;
    paidAt: string;
    status: "paid" | "pending" | "failed" | "refunded";
  }>;
}
