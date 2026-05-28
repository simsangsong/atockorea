import { formatHoldAmount } from "@/components/checkout/NoShowHoldCardForm";

describe("formatHoldAmount — Phase 10 D9 currency-aware", () => {
  it("USD treats amountMinor as cents and prints with $", () => {
    expect(formatHoldAmount("usd", 34000)).toBe("$340");
  });

  it("USD with a small amount also formats correctly", () => {
    expect(formatHoldAmount("usd", 12500)).toBe("$125");
  });

  it("KRW treats amountMinor as whole won and prints with ₩", () => {
    // ko-KR locale uses ₩ + non-breaking thin space; assert via includes() to
    // tolerate Intl variations across Node versions.
    const out = formatHoldAmount("krw", 340000);
    expect(out).toContain("340,000");
    expect(out).toContain("₩");
  });

  it("KRW does not divide by 100", () => {
    const out = formatHoldAmount("krw", 1730000); // DMZ 14-pax
    expect(out).toContain("1,730,000");
  });
});
