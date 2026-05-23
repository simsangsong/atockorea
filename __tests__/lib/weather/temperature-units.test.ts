import {
  cToF,
  formatLiveTemp,
  convertStaticTempString,
} from "@/lib/weather/temperature-units";

describe("cToF", () => {
  it("rounds standard reference points", () => {
    expect(cToF(0)).toBe(32);
    expect(cToF(100)).toBe(212);
    expect(cToF(-40)).toBe(-40);
  });

  it("rounds half-degrees away from zero (standard Math.round)", () => {
    // 19°C → 66.2°F → 66
    expect(cToF(19)).toBe(66);
    // 20°C → 68°F exact
    expect(cToF(20)).toBe(68);
  });

  it("handles sub-zero Celsius", () => {
    // -10°C → 14°F
    expect(cToF(-10)).toBe(14);
  });
});

describe("formatLiveTemp", () => {
  it("returns em-dash for missing or non-finite values", () => {
    expect(formatLiveTemp(null, "C")).toBe("—");
    expect(formatLiveTemp(undefined, "C")).toBe("—");
    expect(formatLiveTemp(NaN, "F")).toBe("—");
    expect(formatLiveTemp(Infinity, "C")).toBe("—");
  });

  it("formats Celsius without conversion", () => {
    expect(formatLiveTemp(19, "C")).toBe("19°");
    expect(formatLiveTemp(-3, "C")).toBe("-3°");
  });

  it("converts to Fahrenheit when unit is F", () => {
    expect(formatLiveTemp(19, "F")).toBe("66°");
    expect(formatLiveTemp(0, "F")).toBe("32°");
  });
});

describe("convertStaticTempString", () => {
  it("returns em-dash for missing input", () => {
    expect(convertStaticTempString(undefined, "C")).toBe("—");
    expect(convertStaticTempString(null, "F")).toBe("—");
    expect(convertStaticTempString("", "C")).toBe("—");
  });

  it("returns the input unchanged when unit is C", () => {
    expect(convertStaticTempString("19°", "C")).toBe("19°");
    expect(convertStaticTempString("20°/19", "C")).toBe("20°/19");
    expect(convertStaticTempString("-5°", "C")).toBe("-5°");
  });

  it("converts every numeric run inside a string when unit is F", () => {
    expect(convertStaticTempString("19°", "F")).toBe("66°");
    // "20°/19" → "20°" max, "19" min — both converted
    expect(convertStaticTempString("20°/19", "F")).toBe("68°/66");
    // "20°/19°" with both degree signs
    expect(convertStaticTempString("20°/19°", "F")).toBe("68°/66°");
  });

  it("preserves leading negative signs in the substitution", () => {
    expect(convertStaticTempString("-5°", "F")).toBe("23°");
    expect(convertStaticTempString("0°/-5°", "F")).toBe("32°/23°");
  });
});
