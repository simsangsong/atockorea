import { maskPiiForLog } from "@/lib/support/chat-logger";

describe("maskPiiForLog (W0.11 / C-32)", () => {
  it("masks emails keeping first char + domain", () => {
    expect(maskPiiForLog("my email is guest.name@example.com thanks")).toBe(
      "my email is g***@example.com thanks",
    );
  });

  it("masks A2C references keeping the last 4", () => {
    expect(maskPiiForLog("booking A2C-5CEB8F52 please")).toBe("booking A2C-****8F52 please");
  });

  it("masks phone numbers keeping the last 4", () => {
    expect(maskPiiForLog("call me at 010-1234-5678")).toBe("call me at ***-5678");
    expect(maskPiiForLog("+82 10 9876 5432")).toBe("***-5432");
  });

  it("leaves prices, dates, and times alone", () => {
    const text = "견적 ₩250,000 — 2026-07-04 14:00, 4명 8시간, $60 per person";
    expect(maskPiiForLog(text)).toBe(text);
  });

  it("leaves error markers and normal prose alone", () => {
    expect(maskPiiForLog("[error:quota]")).toBe("[error:quota]");
    expect(maskPiiForLog("Estimated quote: ₩250,000 for Busan")).toBe(
      "Estimated quote: ₩250,000 for Busan",
    );
  });
});
