import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sanitizeDraft,
  missingQuoteSlots,
  quoteSlotPrompt,
  buildQuoteReply,
  createQuoteBooking,
  quoteEmailPrompt,
  quoteFlowStageFromReply,
  isQuoteFlowFollowUp,
  type QuoteDraft,
} from "@/lib/chatbot/quoteFlow";

function mockSb(id = "bk-1"): SupabaseClient {
  return {
    from: () => ({
      insert: () => ({
        select: () => ({ single: async () => ({ data: { id }, error: null }) }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const base: QuoteDraft = {
  region: null,
  track: null,
  requestedDate: null,
  party: null,
  durationHours: null,
  language: null,
  jejuPickupZone: null,
  poiIntent: null,
  contactName: null,
  contactEmail: null,
  readyToBook: false,
  dateIssue: null,
};

describe("sanitizeDraft", () => {
  it("keeps valid values and drops invalid ones", () => {
    const d = sanitizeDraft({
      region: "JEJU",
      track: "private",
      requestedDate: "2026-07-03",
      party: "4",
      durationHours: 8,
      language: "ko",
      jejuPickupZone: "out_east",
      contactEmail: "A@B.com",
      readyToBook: true,
    });
    expect(d.region).toBe("jeju");
    expect(d.party).toBe(4);
    expect(d.jejuPickupZone).toBe("out_east");
    expect(d.contactEmail).toBe("a@b.com");
    expect(d.readyToBook).toBe(true);
  });

  it("rejects out-of-domain enums / malformed values", () => {
    const d = sanitizeDraft({
      region: "tokyo",
      track: "bus",
      requestedDate: "July 3",
      party: 0,
      jejuPickupZone: "outer", // old enum, no longer valid
      contactEmail: "not-an-email",
    });
    expect(d.region).toBeNull();
    expect(d.track).toBeNull();
    expect(d.requestedDate).toBeNull();
    expect(d.party).toBeNull();
    expect(d.jejuPickupZone).toBeNull();
    expect(d.contactEmail).toBeNull();
  });
});

// W2.6 (C-18): past / far-future dates are rejected as missing with a reason.
describe("sanitizeDraft date validation", () => {
  const TODAY = "2026-07-04";

  it("accepts today and future dates within 2 years", () => {
    expect(sanitizeDraft({ requestedDate: "2026-07-04" }, TODAY).requestedDate).toBe("2026-07-04");
    expect(sanitizeDraft({ requestedDate: "2027-10-01" }, TODAY).requestedDate).toBe("2027-10-01");
  });

  it("rejects past dates as missing with dateIssue=past", () => {
    const d = sanitizeDraft({ requestedDate: "2020-01-01" }, TODAY);
    expect(d.requestedDate).toBeNull();
    expect(d.dateIssue).toBe("past");
    expect(missingQuoteSlots(d)).toContain("date");
  });

  it("rejects >2y-out dates with dateIssue=far_future", () => {
    const d = sanitizeDraft({ requestedDate: "2029-01-01" }, TODAY);
    expect(d.requestedDate).toBeNull();
    expect(d.dateIssue).toBe("far_future");
  });

  it("keeps any well-formed date when todayISO is not provided (legacy)", () => {
    expect(sanitizeDraft({ requestedDate: "2020-01-01" }).requestedDate).toBe("2020-01-01");
  });
});

describe("quoteSlotPrompt date-issue note", () => {
  it("prepends the past-date explanation", () => {
    const ko = quoteSlotPrompt(["date"], "ko", "past");
    expect(ko).toContain("이미 지난 날짜");
    expect(ko).toContain("날짜");
    const en = quoteSlotPrompt(["date"], "en", "past");
    expect(en).toContain("already passed");
  });

  it("prepends the far-future explanation", () => {
    expect(quoteSlotPrompt(["date"], "en", "far_future")).toContain("2 years");
  });

  it("stays unchanged without an issue", () => {
    expect(quoteSlotPrompt(["date"], "en")).not.toContain("already passed");
  });
});

// W2.0 (C-9): quote-flow stickiness across turns.
describe("quoteFlowStageFromReply", () => {
  it("recognizes each server template in ko/en", () => {
    expect(quoteFlowStageFromReply(quoteSlotPrompt(["date"], "ko"))).toBe("slots");
    expect(quoteFlowStageFromReply(quoteSlotPrompt(["region"], "en"))).toBe("slots");
    const confirm = buildQuoteReply(
      { ...base, region: "jeju", requestedDate: "2026-10-10", party: 4, durationHours: 8, language: "ko", jejuPickupZone: "city" },
      "ko",
    );
    expect(quoteFlowStageFromReply(confirm.reply)).toBe("confirm");
    expect(quoteFlowStageFromReply(quoteEmailPrompt("en"))).toBe("email");
    expect(quoteFlowStageFromReply(quoteEmailPrompt("ja"))).toBe("email");
  });

  it("returns null for ordinary replies", () => {
    expect(quoteFlowStageFromReply("The refund policy allows free cancellation up to 24h before.")).toBeNull();
    expect(quoteFlowStageFromReply("")).toBeNull();
  });
});

describe("isQuoteFlowFollowUp", () => {
  const confirmReply = buildQuoteReply(
    { ...base, region: "busan", requestedDate: "2026-10-10", party: 4, durationHours: 8, language: "ko" },
    "ko",
  ).reply;
  const emailReply = quoteEmailPrompt("ko");
  const slotReply = quoteSlotPrompt(["date", "party"], "ko");

  it("keeps the C-9 breaker turns in the flow", () => {
    // The exact production failure: affirmation + email in one natural turn.
    expect(
      isQuoteFlowFollowUp({
        latestUserMessage: "네 진행해주세요. 이메일은 guest@example.com 입니다",
        priorAssistantReply: confirmReply,
        detectedIntent: "company", // "이메일" keyword misroutes to company
      }),
    ).toBe(true);
    // Bare affirmation after the quote.
    expect(
      isQuoteFlowFollowUp({
        latestUserMessage: "네 진행해주세요",
        priorAssistantReply: confirmReply,
        detectedIntent: "unknown",
      }),
    ).toBe(true);
    // Email alone in response to the email prompt.
    expect(
      isQuoteFlowFollowUp({
        latestUserMessage: "guest@example.com",
        priorAssistantReply: emailReply,
        detectedIntent: "unknown",
      }),
    ).toBe(true);
    // Short slot answers ("제주요", "4명 8시간이요").
    expect(
      isQuoteFlowFollowUp({
        latestUserMessage: "10월 3일에 4명이요",
        priorAssistantReply: slotReply,
        detectedIntent: "unknown",
      }),
    ).toBe(true);
    expect(
      isQuoteFlowFollowUp({
        latestUserMessage: "yes please go ahead",
        priorAssistantReply: confirmReply,
        detectedIntent: "unknown",
      }),
    ).toBe(true);
  });

  it("routes out on support / booking-specific / decline / topic change", () => {
    expect(
      isQuoteFlowFollowUp({
        latestUserMessage: "상담원 연결해주세요",
        priorAssistantReply: confirmReply,
        detectedIntent: "support",
      }),
    ).toBe(false);
    expect(
      isQuoteFlowFollowUp({
        latestUserMessage: "아니요 괜찮아요",
        priorAssistantReply: confirmReply,
        detectedIntent: "unknown",
      }),
    ).toBe(false);
    // A real question mid-flow with a confidently different intent exits.
    expect(
      isQuoteFlowFollowUp({
        latestUserMessage: "환불 정책이 어떻게 되나요?",
        priorAssistantReply: confirmReply,
        detectedIntent: "policy",
      }),
    ).toBe(false);
    // No quote-flow context at all → never sticky.
    expect(
      isQuoteFlowFollowUp({
        latestUserMessage: "네 진행해주세요",
        priorAssistantReply: "일반 답변입니다.",
        detectedIntent: "unknown",
      }),
    ).toBe(false);
  });
});

describe("missingQuoteSlots", () => {
  it("flags the four core slots when empty", () => {
    expect(missingQuoteSlots(base).sort()).toEqual(["date", "duration", "party", "region"].sort());
  });

  it("requires a Jeju pickup zone for land Jeju tours", () => {
    const d = { ...base, region: "jeju" as const, requestedDate: "2026-07-03", party: 4, durationHours: 8 };
    expect(missingQuoteSlots(d)).toEqual(["pickup"]);
  });

  it("does not require pickup for cruise or non-Jeju", () => {
    const cruise = { ...base, region: "jeju" as const, track: "cruise" as const, requestedDate: "2026-07-03", party: 4, durationHours: 8 };
    expect(missingQuoteSlots(cruise)).toEqual([]);
    const busan = { ...base, region: "busan" as const, requestedDate: "2026-07-03", party: 4, durationHours: 8 };
    expect(missingQuoteSlots(busan)).toEqual([]);
  });
});

describe("quoteSlotPrompt", () => {
  it("localizes and lists only the missing slots", () => {
    const ko = quoteSlotPrompt(["party", "date"], "ko");
    expect(ko).toContain("인원수");
    expect(ko).toContain("날짜");
    const en = quoteSlotPrompt(["region"], "en");
    expect(en.toLowerCase()).toContain("destination");
  });
});

describe("buildQuoteReply", () => {
  it("prices a complete Jeju private draft and offers checkout", () => {
    const d: QuoteDraft = { ...base, region: "jeju", track: "private", requestedDate: "2026-07-03", party: 4, durationHours: 8, language: "ko", jejuPickupZone: "city" };
    const r = buildQuoteReply(d, "ko");
    expect(r.autoQuotable).toBe(true);
    expect(r.totalKrw).toBeGreaterThan(0);
    expect(r.reply).toContain("₩");
  });

  it("hands off (not auto-quotable) for oversized groups", () => {
    const d: QuoteDraft = { ...base, region: "busan", track: "private", requestedDate: "2026-07-03", party: 20, durationHours: 8, language: "en" };
    const r = buildQuoteReply(d, "en");
    expect(r.autoQuotable).toBe(false);
    expect(r.reply.toLowerCase()).toContain("coordinator");
  });
});

describe("createQuoteBooking", () => {
  const ready: QuoteDraft = { ...base, region: "jeju", track: "private", requestedDate: "2026-07-03", party: 4, durationHours: 8, language: "ko", jejuPickupZone: "city", contactEmail: "a@b.com", readyToBook: true };

  it("creates a booking and returns the checkout path", async () => {
    const r = await createQuoteBooking(mockSb("bk-42"), ready, "ko");
    expect(r).toEqual({ ok: true, bookingId: "bk-42", checkoutPath: "/itinerary-builder/checkout?bookingId=bk-42" });
  });

  it("returns out_of_scope for oversized groups (no insert)", async () => {
    const r = await createQuoteBooking(mockSb(), { ...ready, party: 20 }, "ko");
    expect(r).toEqual({ ok: false, error: "out_of_scope" });
  });

  it("respects the PRICING_AUTOQUOTE_ENABLED kill-switch", async () => {
    const prev = process.env.PRICING_AUTOQUOTE_ENABLED;
    process.env.PRICING_AUTOQUOTE_ENABLED = "false";
    const r = await createQuoteBooking(mockSb(), ready, "ko");
    process.env.PRICING_AUTOQUOTE_ENABLED = prev;
    expect(r).toEqual({ ok: false, error: "disabled" });
  });
});
