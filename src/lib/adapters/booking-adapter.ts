import type { MyTourResponse } from "@/src/types/booking";
import { MyTourResponseSchema } from "../schemas/booking";

export function adaptMyTourResponse(raw: unknown): MyTourResponse {
  const parsed = MyTourResponseSchema.safeParse(raw);

  if (!parsed.success) {
    console.error("[adapter] my-tour parse failed", parsed.error.flatten());

    return {
      tour: {
        id: "fallback",
        title: "Booking",
        status: "awaiting_balance" as const,
        nextStepLabel: null,
        primaryActionLabel: null,
        primaryActionHref: null,
        pickupAreaLabel: "Unknown",
        timeline: {
          now: new Date().toISOString(),
          tourStartAt: new Date().toISOString(),
          refundDeadlineAt: new Date().toISOString(),
          balanceOpensAt: new Date().toISOString(),
          balanceDueAt: new Date().toISOString(),
          autoCharge: false as const,
        },
      },
      paymentHistory: [],
    };
  }

  return parsed.data;
}
