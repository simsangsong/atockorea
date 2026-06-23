import {
  sanitizeDraft,
  missingQuoteSlots,
  quoteSlotPrompt,
  buildQuoteReply,
  type QuoteDraft,
} from "@/lib/chatbot/quoteFlow";

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
