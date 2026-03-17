import { z } from "zod";

export const BookingTimelineSchema = z.object({
  now: z.string(),
  tourStartAt: z.string(),
  refundDeadlineAt: z.string(),
  balanceOpensAt: z.string(),
  balanceDueAt: z.string(),
  autoCharge: z.literal(false),
});

export const MyTourViewModelSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum([
    "deposit_paid",
    "awaiting_balance",
    "balance_due",
    "confirmed",
    "cancelled",
    "refunded",
    "deadline_missed",
  ]),
  nextStepLabel: z.string().nullable(),
  primaryActionLabel: z.string().nullable(),
  primaryActionHref: z.string().nullable(),
  countdownTarget: z.string().nullable().optional(),
  pickupAreaLabel: z.string(),
  matchQuality: z.enum(["great", "good", "slight"]).optional(),
  remainingBalance: z.number().nullable().optional(),
  timeline: BookingTimelineSchema,
});

export const MyTourResponseSchema = z.object({
  tour: MyTourViewModelSchema,
  paymentHistory: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["deposit", "balance", "refund"]),
      amount: z.number(),
      paidAt: z.string(),
      status: z.enum(["paid", "pending", "failed", "refunded"]),
    })
  ),
});
