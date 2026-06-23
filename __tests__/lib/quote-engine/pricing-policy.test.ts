import {
  quote,
  baseForTierHours,
  tierForLocale,
  jejuZone,
  regionSurcharge,
  normalizeRegion,
  dmzPrice,
  isPeakSeason,
  evaluateConstraints,
  classifyJejuHotelZone,
  type PriceInput,
} from "@/lib/quote-engine/pricing-policy";

/** Build a private-tour input with sane defaults overridden per-test. */
function input(overrides: Partial<PriceInput> = {}): PriceInput {
  return {
    track: "private",
    region: "busan",
    guideLanguageTier: "english",
    durationHours: 8,
    pax: 2,
    ...overrides,
  };
}

describe("base price tables (pricing_update_instructions §1)", () => {
  it("English base table, 1-6 pax", () => {
    expect(baseForTierHours("english", 4)).toBe(220000);
    expect(baseForTierHours("english", 5)).toBe(250000);
    expect(baseForTierHours("english", 6)).toBe(280000);
    expect(baseForTierHours("english", 7)).toBe(310000);
    expect(baseForTierHours("english", 8)).toBe(340000);
    expect(baseForTierHours("english", 9)).toBe(370000);
    expect(baseForTierHours("english", 10)).toBe(410000);
    expect(baseForTierHours("english", 11)).toBe(450000);
    expect(baseForTierHours("english", 12)).toBe(490000);
  });

  it("Chinese base table, 1-6 pax", () => {
    expect(baseForTierHours("chinese", 4)).toBe(170000);
    expect(baseForTierHours("chinese", 8)).toBe(250000);
    expect(baseForTierHours("chinese", 9)).toBe(270000);
    expect(baseForTierHours("chinese", 12)).toBe(360000);
  });

  it("beyond 12h extrapolates at +40k (En) / +30k (Cn) per hour", () => {
    expect(baseForTierHours("english", 13)).toBe(490000 + 40000);
    expect(baseForTierHours("english", 14)).toBe(490000 + 80000);
    expect(baseForTierHours("chinese", 13)).toBe(360000 + 30000);
  });

  it("clamps to the 4h minimum", () => {
    expect(baseForTierHours("english", 2)).toBe(220000);
    expect(baseForTierHours("english", 0)).toBe(220000);
  });

  it("Smart Guide = Chinese + ₩20,000 per bucket (§4)", () => {
    expect(baseForTierHours("smart_guide", 8)).toBe(250000 + 20000);
    expect(baseForTierHours("smart_guide", 4)).toBe(170000 + 20000);
    expect(baseForTierHours("smart_guide", 13)).toBe(360000 + 30000 + 20000);
  });
});

describe("locale → guide-language tier (D13)", () => {
  it("english tier for en/ja/es", () => {
    expect(tierForLocale("en")).toBe("english");
    expect(tierForLocale("ja")).toBe("english");
    expect(tierForLocale("es")).toBe("english");
  });
  it("chinese tier for zh/zh-TW/ko", () => {
    expect(tierForLocale("zh")).toBe("chinese");
    expect(tierForLocale("zh-TW")).toBe("chinese");
    expect(tierForLocale("ko")).toBe("chinese");
  });
  it("defaults to english", () => {
    expect(tierForLocale("de")).toBe("english");
    expect(tierForLocale(null)).toBe("english");
  });
});

describe("full quote — group + region surcharges (§1, §3, §7)", () => {
  it("English 8h / 2pax / Busan city = ₩340,000", () => {
    const r = quote(input({ region: "busan", durationHours: 8, pax: 2 }));
    expect(r.autoQuotable).toBe(true);
    expect(r.total).toBe(340000);
    expect(r.vehicle).toBe("sedan");
  });

  it("Chinese 6h / 8pax / Gyeongju = 210k + van 50k + 50k = ₩310,000", () => {
    const r = quote(
      input({
        guideLanguageTier: "chinese",
        durationHours: 6,
        pax: 8,
        poiRegions: ["busan", "gyeongju"],
      })
    );
    expect(r.total).toBe(310000);
    expect(r.vehicle).toBe("van");
    expect(r.lines.find((l) => l.code === "region")?.amount).toBe(50000);
    expect(r.lines.find((l) => l.code === "pax_tier")?.amount).toBe(50000);
  });

  it("7-9 pax adds the ₩50,000 van surcharge", () => {
    const r = quote(input({ pax: 7 }));
    expect(r.total).toBe(340000 + 50000);
  });

  it("region surcharge takes the max sub-region touched", () => {
    const r = quote(input({ region: "seoul", poiRegions: ["seoul", "gyeonggi", "gangwon"] }));
    // gangwon (50k) wins over gyeonggi (30k)
    expect(r.lines.find((l) => l.code === "region")?.amount).toBe(50000);
  });
});

describe("Solati 10-13 pax constraint (§2)", () => {
  it("10pax / 5h is NOT auto-quotable (Solati min 6h)", () => {
    const r = quote(input({ pax: 10, durationHours: 5 }));
    expect(r.autoQuotable).toBe(false);
    expect(r.violations.some((v) => v.startsWith("vehicle_min_hours"))).toBe(true);
  });

  it("10pax / 6h adds the ₩150,000 Solati surcharge", () => {
    const r = quote(input({ pax: 10, durationHours: 6 }));
    expect(r.autoQuotable).toBe(true);
    expect(r.vehicle).toBe("solati");
    expect(r.lines.find((l) => l.code === "pax_tier")?.amount).toBe(150000);
    expect(r.total).toBe(280000 + 150000);
  });

  it("peak season raises the Solati surcharge to ₩200,000", () => {
    const r = quote(input({ pax: 12, durationHours: 6, requestedDate: "2026-08-01" }));
    expect(r.peakSeason).toBe(true);
    expect(r.lines.find((l) => l.code === "pax_tier")?.amount).toBe(200000);
  });

  it("peak season does NOT change non-Solati tiers", () => {
    const r = quote(input({ pax: 2, durationHours: 8, requestedDate: "2026-08-01" }));
    expect(r.total).toBe(340000);
  });

  it("14+ pax routes to manual (out of scope)", () => {
    const r = quote(input({ pax: 14 }));
    expect(r.autoQuotable).toBe(false);
    expect(r.violations.some((v) => v.startsWith("pax_over_max"))).toBe(true);
  });
});

describe("Jeju zones + cross-region + pickup (§6, §7)", () => {
  it("classifies known POIs", () => {
    expect(jejuZone(33.46, 126.94)).toBe("east"); // Seongsan
    expect(jejuZone(33.39, 126.24)).toBe("west"); // Hyeopjae
    expect(jejuZone(33.25, 126.56)).toBe("south"); // Seogwipo
    expect(jejuZone(33.51, 126.49)).toBe("city"); // Jeju city
  });

  it("Jeju English 6h East+South mix with downtown pickup = 280k + 60k = ₩340,000", () => {
    const r = quote(
      input({
        region: "jeju",
        durationHours: 6,
        pax: 2,
        jejuPoiZones: ["east", "south"],
        jejuPickupZone: "city",
      })
    );
    expect(r.total).toBe(340000);
    expect(r.lines.find((l) => l.code === "jeju_east_mix")?.amount).toBe(60000);
    expect(r.lines.find((l) => l.code === "jeju_pickup")).toBeUndefined();
  });

  it("East + City only incurs no East-mix surcharge", () => {
    const r = quote(input({ region: "jeju", jejuPoiZones: ["east", "city"] }));
    expect(r.lines.find((l) => l.code === "jeju_east_mix")).toBeUndefined();
  });

  it("West + South combine free (no East-mix)", () => {
    const r = quote(input({ region: "jeju", jejuPoiZones: ["west", "south"] }));
    expect(r.lines.find((l) => l.code === "jeju_east_mix")).toBeUndefined();
  });

  it("cross-side: west hotel + east tour adds pickup 60k + cross-side 40k", () => {
    const r = quote(
      input({ region: "jeju", durationHours: 6, pax: 2, jejuPoiZones: ["east"], jejuPickupZone: "out_west" })
    );
    expect(r.lines.find((l) => l.code === "jeju_pickup")?.amount).toBe(60000);
    expect(r.lines.find((l) => l.code === "jeju_cross_side")?.amount).toBe(40000);
    expect(r.lines.find((l) => l.code === "jeju_east_mix")).toBeUndefined(); // east-only ≠ mix
    expect(r.total).toBe(280000 + 100000);
  });

  it("Jeju distance surcharges are capped at ₩100,000", () => {
    // east-mix 60k + pickup 60k + cross-side 40k = 160k → capped to 100k
    const r = quote(
      input({ region: "jeju", durationHours: 6, pax: 2, jejuPoiZones: ["east", "west"], jejuPickupZone: "out_west" })
    );
    expect(r.lines.find((l) => l.code === "jeju_distance_capped")?.amount).toBe(100000);
    expect(r.lines.find((l) => l.code === "jeju_pickup")).toBeUndefined();
    expect(r.lines.find((l) => l.code === "jeju_east_mix")).toBeUndefined();
    expect(r.total).toBe(280000 + 100000);
  });

  it("city (downtown) pickup adds no surcharge", () => {
    const r = quote(input({ region: "jeju", jejuPoiZones: ["west"], jejuPickupZone: "city" }));
    expect(r.lines.find((l) => l.code === "jeju_pickup")).toBeUndefined();
    expect(r.lines.find((l) => l.code === "jeju_cross_side")).toBeUndefined();
  });
});

describe("classifyJejuHotelZone (D.2 auto-detect)", () => {
  it("maps hotel coordinates to pickup zones", () => {
    expect(classifyJejuHotelZone(33.5, 126.52)).toBe("city"); // Jeju City downtown
    expect(classifyJejuHotelZone(33.51, 126.49)).toBe("city"); // airport-area downtown box
    expect(classifyJejuHotelZone(33.25, 126.56)).toBe("out_south"); // Seogwipo
    expect(classifyJejuHotelZone(33.41, 126.27)).toBe("out_west"); // Hallim
    expect(classifyJejuHotelZone(33.46, 126.94)).toBe("out_east"); // Seongsan
    expect(classifyJejuHotelZone(33.46, 126.33)).toBe("out_west"); // Aewol
    expect(classifyJejuHotelZone(NaN, NaN)).toBe("city"); // bad input → safe default
  });
});

describe("cruise shore-excursion surcharges", () => {
  it("cruise track adds a flat ₩40,000", () => {
    const r = quote(input({ track: "cruise", region: "busan", durationHours: 8, pax: 2 }));
    expect(r.total).toBe(340000 + 40000);
    expect(r.lines.find((l) => l.code === "cruise_excursion")?.amount).toBe(40000);
  });

  it("Gangjeong port adds ₩70,000 on top of the cruise add", () => {
    const r = quote(
      input({ track: "cruise", region: "jeju", durationHours: 6, pax: 2, cruisePort: "gangjeong" })
    );
    // base 280k + cruise 40k + gangjeong 70k
    expect(r.total).toBe(280000 + 40000 + 70000);
    expect(r.lines.find((l) => l.code === "gangjeong_port")?.amount).toBe(70000);
  });

  it("non-Gangjeong Jeju cruise gets only the ₩40,000 cruise add", () => {
    const r = quote(
      input({ track: "cruise", region: "jeju", durationHours: 6, pax: 2, cruisePort: "jeju_port" })
    );
    expect(r.total).toBe(280000 + 40000);
    expect(r.lines.find((l) => l.code === "gangjeong_port")).toBeUndefined();
  });

  it("cruise ignores the hotel pickup-zone surcharge (pickup is the port)", () => {
    const r = quote(
      input({ track: "cruise", region: "jeju", durationHours: 6, jejuPickupZone: "out_east" })
    );
    expect(r.lines.find((l) => l.code === "jeju_pickup")).toBeUndefined();
  });

  it("private/land tours never get the cruise add", () => {
    const r = quote(input({ track: "private", region: "busan" }));
    expect(r.lines.find((l) => l.code === "cruise_excursion")).toBeUndefined();
  });
});

describe("region tag normalization", () => {
  it("strips verbose region strings to the province slug", () => {
    expect(normalizeRegion("Gyeonggi — Pogok-eup, Cheoin-gu, Yongin-si")).toBe("gyeonggi");
    expect(normalizeRegion("Jeju East — Jocheon-eup")).toBe("jeju");
    expect(normalizeRegion("gangwon")).toBe("gangwon");
  });
  it("maps surcharges through normalization", () => {
    expect(regionSurcharge(["Gyeonggi — Pogok-eup"])).toBe(30000);
    expect(regionSurcharge(["Jeju East — Jocheon-eup"])).toBe(0);
  });
});

describe("DMZ fixed pricing (§8)", () => {
  it("matches the published table", () => {
    expect(dmzPrice(1)).toBe(630000);
    expect(dmzPrice(3)).toBe(630000);
    expect(dmzPrice(4)).toBe(710000);
    expect(dmzPrice(7)).toBe(830000);
    expect(dmzPrice(13)).toBe(1100000);
    expect(dmzPrice(14)).toBe(1730000);
  });
  it("15-28 pax uses 1,730,000 + (pax-14)×70,000", () => {
    expect(dmzPrice(15)).toBe(1800000);
    expect(dmzPrice(28)).toBe(1730000 + 14 * 70000);
  });
  it(">28 pax has no auto price", () => {
    expect(dmzPrice(29)).toBeNull();
  });
  it("quote() returns a fixed DMZ total ignoring language/duration/region", () => {
    const r = quote(input({ track: "dmz", pax: 7, durationHours: 12, region: "seoul" }));
    expect(r.total).toBe(830000);
    expect(r.lines).toHaveLength(1);
    expect(r.autoQuotable).toBe(true);
  });
  it("DMZ >28 pax routes to manual", () => {
    const r = quote(input({ track: "dmz", pax: 30 }));
    expect(r.autoQuotable).toBe(false);
  });
});

describe("peak season detection", () => {
  it("flags configured ranges", () => {
    expect(isPeakSeason("2026-08-01")).toBe(true); // summer
    expect(isPeakSeason("2026-04-01")).toBe(true); // cherry blossom
    expect(isPeakSeason("2026-09-15")).toBe(false);
    expect(isPeakSeason(null)).toBe(false);
  });
});

describe("evaluateConstraints", () => {
  it("auto-quotable for an ordinary private tour", () => {
    expect(evaluateConstraints(input()).autoQuotable).toBe(true);
  });
  it("blocks Solati under 6h and 14+ pax", () => {
    expect(evaluateConstraints(input({ pax: 11, durationHours: 4 })).autoQuotable).toBe(false);
    expect(evaluateConstraints(input({ pax: 20 })).autoQuotable).toBe(false);
  });
});
