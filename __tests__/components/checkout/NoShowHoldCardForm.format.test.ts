import { formatHoldAmount, resolveAmount } from "@/components/checkout/NoShowHoldCardForm";

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

describe("resolveAmount — Phase 10.2.1 audit fixes #1 + #11", () => {
  it("explicit currency + amountMinor wins (preferred shape)", () => {
    expect(resolveAmount({ currency: "krw", amountMinor: 340000 })).toEqual({
      currency: "krw",
      amountMinor: 340000,
    });
    expect(resolveAmount({ currency: "usd", amountMinor: 34000 })).toEqual({
      currency: "usd",
      amountMinor: 34000,
    });
  });

  it("audit fix #1 — explicit currency='krw' WITHOUT amountMinor honors KRW (was silently $0 USD before)", () => {
    expect(resolveAmount({ currency: "krw" })).toEqual({
      currency: "krw",
      amountMinor: 0,
    });
  });

  it("audit fix #11 — mixed (currency='krw' + amountUsdCents=X) honors the explicit KRW signal, ignores the USD-cents alias", () => {
    expect(resolveAmount({ currency: "krw", amountUsdCents: 34000 })).toEqual({
      currency: "krw",
      amountMinor: 0,
    });
  });

  it("legacy alias: amountUsdCents only → USD", () => {
    expect(resolveAmount({ amountUsdCents: 34000 })).toEqual({
      currency: "usd",
      amountMinor: 34000,
    });
  });

  it("legacy alias: currency='usd' + amountUsdCents falls back to the alias", () => {
    expect(resolveAmount({ currency: "usd", amountUsdCents: 12500 })).toEqual({
      currency: "usd",
      amountMinor: 12500,
    });
  });

  it("nothing provided → USD/0 last-resort default", () => {
    expect(resolveAmount({})).toEqual({ currency: "usd", amountMinor: 0 });
  });
});
