import { sanitizeDraft, localizedRegion } from "@/lib/chatbot/quoteFlow";
import { isBookingWriteRequest } from "@/lib/chatbot/bookingLookup";
import { replyLooksMisrouted } from "@/lib/chatbot/queryIntent";

describe("quote-06: fractional party floors (never over-quotes)", () => {
  it("floors rather than rounds up", () => {
    expect(sanitizeDraft({ party: 4.5 }).party).toBe(4);
    expect(sanitizeDraft({ party: 6.9 }).party).toBe(6);
    expect(sanitizeDraft({ party: 3 }).party).toBe(3);
  });
  it("drops sub-1 fractions so the slot is re-prompted", () => {
    expect(sanitizeDraft({ party: 0.5 }).party).toBeNull();
  });
});

describe("i18n-06: region names are localized", () => {
  it("localizes jeju/busan/seoul per locale", () => {
    expect(localizedRegion("jeju", "ko")).toBe("제주");
    expect(localizedRegion("jeju", "ja")).toBe("済州");
    expect(localizedRegion("seoul", "zh-TW")).toBe("首爾");
    expect(localizedRegion("busan", "es")).toBe("Busan");
    expect(localizedRegion("jeju", "en")).toBe("Jeju");
  });
});

describe("booking-02: capability-framed change requests are writes", () => {
  it("detects 'can you cancel my booking'", () => {
    expect(isBookingWriteRequest("Can you cancel my booking?")).toBe(true);
    expect(isBookingWriteRequest("could I change my reservation")).toBe(true);
  });
  it("still treats a status question as a read", () => {
    expect(isBookingWriteRequest("did you cancel my booking yet?")).toBe(false);
  });
});

describe("rag-01: correct POI answer mentioning a tour is not misrouted", () => {
  it("keeps a POI answer that merely mentions a tour (no product link)", () => {
    const reply =
      "Seongsan Ilchulbong opens at 07:00 and admission is 5,000 won. It is included in our Jeju East day tour and the sunrise tour.";
    expect(replyLooksMisrouted("poi", reply)).toBe(false);
  });
  it("still flags an answer that pushes products and ignores the question", () => {
    const reply =
      "Check out our Jeju day tour /tour-product/jeju-grand-highlights-loop and the Busan day tour /tour-product/busan-top-attractions-day-tour!";
    expect(replyLooksMisrouted("poi", reply)).toBe(true);
  });
});
