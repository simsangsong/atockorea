import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractBookingCredentials,
  hasBothCredentials,
  isBookingWriteRequest,
  verifyAndFetchBooking,
  mapBookingRowToSafeView,
  buildVerifiedBookingContext,
} from "@/lib/chatbot/bookingLookup";

const REF = "A2C-11EFCC97";
const EMAIL = "traveler@example.com";

const bookingRow = {
  booking_reference: REF,
  contact_email: EMAIL,
  tour_id: "tour-uuid-1",
  tour_date: "2026-07-03",
  tour_time: "09:00:00",
  number_of_guests: 4,
  status: "confirmed",
  payment_status: "paid",
  settlement_status: "pending",
  final_price: 320,
  total_price: 320,
  currency: "USD",
  refund_eligible: true,
  refund_processed: false,
  refund_amount: null,
  cancelled_at: null,
  cancellation_reason: null,
  special_requests: "Vegetarian lunch",
  // Sensitive columns that must NEVER reach the view/context, included here to
  // prove they are dropped even if a query ever selected them.
  stripe_customer_id: "cus_SENSITIVE",
  payment_intent_id: "pi_SENSITIVE",
  user_id: "user-SENSITIVE",
  contact_phone: "+82-10-0000-0000",
};

function mockSb(row: Record<string, unknown> | null, tourTitle: string | null): SupabaseClient {
  return {
    from(table: string) {
      if (table === "bookings") {
        return {
          select: () => ({
            eq: (_col: string, ref: string) => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: row && ref === row.booking_reference ? row : null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "tours") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: tourTitle ? { title: tourTitle } : null, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

describe("extractBookingCredentials", () => {
  it("pulls reference and email from free text", () => {
    const c = extractBookingCredentials(`내 예약 ${REF}, 이메일 ${EMAIL} 입니다`);
    expect(c).toEqual({ reference: REF, email: EMAIL });
    expect(hasBothCredentials(c)).toBe(true);
  });

  it("uppercases the reference and lowercases the email", () => {
    const c = extractBookingCredentials(`a2c-11efcc97 TRAVELER@Example.COM`);
    expect(c.reference).toBe(REF);
    expect(c.email).toBe(EMAIL);
  });

  it("returns nulls for missing pieces", () => {
    expect(hasBothCredentials(extractBookingCredentials("just the email a@b.com"))).toBe(false);
    expect(hasBothCredentials(extractBookingCredentials(`only ref ${REF}`))).toBe(false);
  });
});

describe("isBookingWriteRequest", () => {
  it.each([
    "cancel my booking",
    "I want to reschedule my tour",
    "please refund my reservation",
    "예약 취소해 주세요",
    "투어 날짜 변경하고 싶어요",
    "予約をキャンセルしたい",
    "我想取消我的预订",
    "quiero cancelar mi reserva",
  ])("flags write request: %s", (text) => {
    expect(isBookingWriteRequest(text)).toBe(true);
  });

  it.each([
    "is my refund processed?",
    "환불 됐어?",
    "내 픽업 시간 언제야?",
    "what time is my tour?",
    "予約状況を確認したい",
  ])("does NOT flag a status question: %s", (text) => {
    expect(isBookingWriteRequest(text)).toBe(false);
  });
});

describe("verifyAndFetchBooking", () => {
  it("returns a safe view when reference + email match", async () => {
    const view = await verifyAndFetchBooking(mockSb(bookingRow, "Jeju Private Day Tour"), {
      reference: REF,
      email: EMAIL,
    });
    expect(view).not.toBeNull();
    expect(view!.tourName).toBe("Jeju Private Day Tour");
    expect(view!.tourTime).toBe("09:00");
    expect(view!.status).toBe("confirmed");
    expect(view!.refund).toEqual({ eligible: true, processed: false, amount: null });
  });

  it("matches case-insensitively on reference and email", async () => {
    const view = await verifyAndFetchBooking(mockSb(bookingRow, "Tour"), {
      reference: "a2c-11efcc97",
      email: "Traveler@Example.com",
    });
    expect(view).not.toBeNull();
  });

  it("returns null on email mismatch", async () => {
    const view = await verifyAndFetchBooking(mockSb(bookingRow, "Tour"), {
      reference: REF,
      email: "someone-else@example.com",
    });
    expect(view).toBeNull();
  });

  it("returns null when the reference is not found", async () => {
    const view = await verifyAndFetchBooking(mockSb(bookingRow, "Tour"), {
      reference: "A2C-DEADBEEF",
      email: EMAIL,
    });
    expect(view).toBeNull();
  });

  it("returns null for a malformed reference without querying", async () => {
    const sb = {
      from() {
        throw new Error("should not query");
      },
    } as unknown as SupabaseClient;
    const view = await verifyAndFetchBooking(sb, { reference: "NOT-A-REF", email: EMAIL });
    expect(view).toBeNull();
  });
});

describe("PII whitelist", () => {
  it("the safe view never carries sensitive columns", () => {
    const view = mapBookingRowToSafeView(bookingRow, "Tour");
    const json = JSON.stringify(view);
    for (const secret of ["cus_SENSITIVE", "pi_SENSITIVE", "user-SENSITIVE", "+82-10-0000-0000"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("the model context block never carries sensitive columns", () => {
    const ctx = buildVerifiedBookingContext(mapBookingRowToSafeView(bookingRow, "Tour"));
    for (const secret of ["cus_SENSITIVE", "pi_SENSITIVE", "user-SENSITIVE", "+82-10-0000-0000"]) {
      expect(ctx).not.toContain(secret);
    }
    // ...but it DOES carry the facts we want the model to answer from.
    expect(ctx).toContain("Booking status: confirmed");
    expect(ctx).toContain("Refund: eligible=yes, processed=no");
  });
});
