import { TOUR_WEATHER_ANCHORS, localizedAreaLabel } from "@/lib/weather/tour-weather-anchor";

// L7 (deep-audit 2026-07-05): localizedAreaLabel used to handle only ko/en, so
// ja/zh/zh-TW forecasts inlined the English place name ("Jejuの天気…").
describe("localizedAreaLabel", () => {
  const anchors = Object.values(TOUR_WEATHER_ANCHORS);

  it("keeps ko / en labels as authored", () => {
    const jeju = anchors.find((a) => a.areaLabel === "Jeju Island")!;
    expect(localizedAreaLabel(jeju, "ko")).toBe(jeju.areaLabelKo);
    expect(localizedAreaLabel(jeju, "en")).toBe("Jeju Island");
    // Spanish keeps the roman spelling by convention.
    expect(localizedAreaLabel(jeju, "es")).toBe("Jeju Island");
  });

  it("translates place + direction tokens for CJK, preserving · separators", () => {
    const east = anchors.find((a) => a.areaLabel === "East Jeju · Seongsan");
    if (east) {
      expect(localizedAreaLabel(east, "ja")).toBe("東部済州 · 城山");
      expect(localizedAreaLabel(east, "zh")).toBe("东部济州 · 城山");
      expect(localizedAreaLabel(east, "zh-TW")).toBe("東部濟州 · 城山");
    }
  });

  it("never leaks a bare English place token into a CJK label", () => {
    const ENGLISH_TOKEN = /\b(Jeju|Seoul|Busan|Gyeongju|Suwon|Pocheon|Seongsan|Seoraksan|East|West|South|Southwest|Island|region)\b/;
    for (const a of anchors) {
      for (const loc of ["ja", "zh", "zh-TW"] as const) {
        expect({ area: a.areaLabel, loc, out: localizedAreaLabel(a, loc) }).toEqual({
          area: a.areaLabel,
          loc,
          out: expect.not.stringMatching(ENGLISH_TOKEN),
        });
      }
    }
  });

  it("falls back to the original word for an unknown token (e.g. DMZ)", () => {
    const dmz = anchors.find((a) => a.areaLabel.includes("DMZ"));
    if (dmz) expect(localizedAreaLabel(dmz, "ja")).toContain("DMZ");
  });
});
