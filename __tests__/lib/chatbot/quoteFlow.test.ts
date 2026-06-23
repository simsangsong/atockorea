import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sanitizeDraft,
  missingQuoteSlots,
  quoteSlotPrompt,
  buildQuoteReply,
  createQuoteBooking,
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
