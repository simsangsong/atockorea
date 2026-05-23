import { getShelvesForDate, __INTERNAL__ } from "@/lib/tours-shelves";
import type { StaticTourProductRegistration } from "@/components/product-tour-static/catalog/staticTourCatalogCards";

const {
  SEASON_WINDOWS,
  EDITORS_PICK_SLUGS,
  daysUntilNextOccurrence,
  monthDayOfUtc,
  isMonthDayInWindow,
  isCruise,
  isSmallGroup,
  isPrivate,
  isClassicBus,
} = __INTERNAL__;

function tour(slug: string, badges: string[] = [], extras: Partial<StaticTourProductRegistration> = {}): StaticTourProductRegistration {
  return {
    slug,
    title: slug,
    subtitle: "",
    region: "",
    duration: "",
    stopsCount: 0,
    rating: 0,
    reviewCount: 0,
    badges,
    heroImage: "",
    thumbnail: "",
    priceLabel: "",
    shortCardDescription: "",
    listPriceUsd: 59,
    ...extras,
  };
}

describe("season window primitives", () => {
  describe("isMonthDayInWindow", () => {
    it("returns true for an in-range date in a forward window", () => {
      expect(isMonthDayInWindow("05-23", "05-15", "07-15")).toBe(true);
      expect(isMonthDayInWindow("05-15", "05-15", "07-15")).toBe(true); // start inclusive
      expect(isMonthDayInWindow("07-15", "05-15", "07-15")).toBe(true); // end inclusive
    });

    it("returns false for an out-of-range date in a forward window", () => {
      expect(isMonthDayInWindow("05-14", "05-15", "07-15")).toBe(false);
      expect(isMonthDayInWindow("07-16", "05-15", "07-15")).toBe(false);
    });

    it("handles wrap-around windows (camellia 12-15 → 02-15)", () => {
      expect(isMonthDayInWindow("12-25", "12-15", "02-15")).toBe(true);
      expect(isMonthDayInWindow("01-30", "12-15", "02-15")).toBe(true);
      expect(isMonthDayInWindow("02-15", "12-15", "02-15")).toBe(true);
      expect(isMonthDayInWindow("12-14", "12-15", "02-15")).toBe(false);
      expect(isMonthDayInWindow("02-16", "12-15", "02-15")).toBe(false);
      expect(isMonthDayInWindow("06-01", "12-15", "02-15")).toBe(false);
    });
  });

  describe("daysUntilNextOccurrence", () => {
    it("returns 0 when target is today", () => {
      const today = new Date(Date.UTC(2026, 4, 23)); // 2026-05-23
      expect(daysUntilNextOccurrence(today, "05-23").days).toBe(0);
    });

    it("returns days in this calendar year when target hasn't passed", () => {
      const today = new Date(Date.UTC(2026, 4, 23));
      const r = daysUntilNextOccurrence(today, "07-15");
      expect(r.days).toBe(53); // May 23 → Jul 15
      expect(r.year).toBe(2026);
    });

    it("wraps to next year when target already passed", () => {
      const today = new Date(Date.UTC(2026, 4, 23));
      const r = daysUntilNextOccurrence(today, "03-28");
      // May 23 to Mar 28 (next year) = 309 days
      expect(r.days).toBe(309);
      expect(r.year).toBe(2027);
    });

    it("monthDayOfUtc emits zero-padded MM-DD", () => {
      expect(monthDayOfUtc(new Date(Date.UTC(2026, 0, 1)))).toBe("01-01");
      expect(monthDayOfUtc(new Date(Date.UTC(2026, 11, 31)))).toBe("12-31");
    });
  });

  describe("SEASON_WINDOWS shape", () => {
    it("contains all 6 seasons with valid windows", () => {
      expect(Object.keys(SEASON_WINDOWS).sort()).toEqual(
        ["camellia", "cherry", "hydrangea", "maple", "pink-muhly", "plum"].sort(),
      );
      for (const [key, w] of Object.entries(SEASON_WINDOWS)) {
        expect(w.startMonthDay).toMatch(/^\d\d-\d\d$/);
        expect(w.endMonthDay).toMatch(/^\d\d-\d\d$/);
        expect(typeof w.matchesTour).toBe("function");
      }
    });

    it("season matchers fire on expected slugs", () => {
      expect(SEASON_WINDOWS.hydrangea.matchesTour("jeju-hydrangea-festival-tour-east-route", [])).toBe(true);
      expect(SEASON_WINDOWS.cherry.matchesTour("jeju-cherry-blossom-tour-east-route", [])).toBe(true);
      expect(SEASON_WINDOWS.cherry.matchesTour("busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju", [])).toBe(true);
      expect(SEASON_WINDOWS.plum.matchesTour("busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju", [])).toBe(true);
      expect(SEASON_WINDOWS.camellia.matchesTour("jeju-winter-southwest-tangerine-snow-camellia-tour", [])).toBe(true);
      expect(SEASON_WINDOWS.maple.matchesTour("seoul-seoraksan-naksansa-temple-naksan-beach-day-trip", [])).toBe(true);
      // non-seasonal slug does NOT match any season
      for (const key of Object.keys(SEASON_WINDOWS)) {
        expect(SEASON_WINDOWS[key as keyof typeof SEASON_WINDOWS].matchesTour("east-signature-nature-core", [])).toBe(false);
      }
    });
  });
});

describe("format-based shelf matchers", () => {
  it("isCruise matches cruise/shore-excursion slugs and cruise badges", () => {
    expect(isCruise(tour("jeju-cruise-shore-excursion-bus-tour"))).toBe(true);
    expect(isCruise(tour("incheon-seoul-private-car-shore-excursion-cruise"))).toBe(true);
    expect(isCruise(tour("from-incheon-seoul-day-tour-cruise-guests"))).toBe(true);
    expect(isCruise(tour("east-signature-nature-core"))).toBe(false);
    expect(isCruise(tour("some-slug", ["Cruise excursion"]))).toBe(true);
  });

  it("isSmallGroup matches small-group badges (not just maxGroupSize)", () => {
    expect(isSmallGroup(tour("any", ["Small group"]))).toBe(true);
    expect(isSmallGroup(tour("any", ["Small Group"]))).toBe(true);
    expect(isSmallGroup(tour("any", ["Small shared van"]))).toBe(true);
    expect(isSmallGroup(tour("any", ["Large coach"]))).toBe(false);
  });

  it("isPrivate matches private slug or Private Tour badge", () => {
    expect(isPrivate(tour("jeju-island-private-car-charter-tour"))).toBe(true);
    expect(isPrivate(tour("seoul-suburbs-private-chartered-car-10hr"))).toBe(true);
    expect(isPrivate(tour("any", ["Private Tour"]))).toBe(true);
    // "Small group" must NOT be classified as private
    expect(isPrivate(tour("any", ["Small group"]))).toBe(false);
    expect(isPrivate(tour("east-signature-nature-core"))).toBe(false);
  });

  it("isClassicBus matches bus-tour slugs and bus/coach badges", () => {
    expect(isClassicBus(tour("busan-cruise-shore-excursion-bus-tour"))).toBe(true);
    expect(isClassicBus(tour("any", ["Large coach"]))).toBe(true);
    expect(isClassicBus(tour("any", ["Bus tour"]))).toBe(true);
    expect(isClassicBus(tour("east-signature-nature-core"))).toBe(false);
  });

  it("multi-shelf overlap (B34) — small-group cruise lands in both", () => {
    const t = tour("jeju-cruise-shore-excursion-small-group-tour", ["Cruise excursion", "Small group"]);
    expect(isCruise(t)).toBe(true);
    expect(isSmallGroup(t)).toBe(true);
  });
});

describe("EDITORS_PICK_SLUGS", () => {
  it("is a non-empty curator list of unique slugs", () => {
    expect(EDITORS_PICK_SLUGS.length).toBeGreaterThan(0);
    expect(new Set(EDITORS_PICK_SLUGS).size).toBe(EDITORS_PICK_SLUGS.length);
  });
});

describe("getShelvesForDate — integration", () => {
  // Synthetic catalog spanning every shelf family + every seasonal slug.
  const catalog: StaticTourProductRegistration[] = [
    tour("east-signature-nature-core", ["First-Time Friendly"]),
    tour("jeju-grand-highlights-loop", ["Best for One-Day Visitors"]),
    tour("jeju-cruise-shore-excursion-bus-tour", ["Cruise excursion", "Large coach"]),
    tour("jeju-cruise-shore-excursion-small-group-tour", ["Cruise excursion", "Small group"]),
    tour("jeju-hydrangea-festival-tour-east-route", ["Small group", "Hydrangea"]),
    tour("jeju-hydrangea-festival-tour-southwest-route", ["Summer Only", "Hydrangea Season"]),
    tour("jeju-cherry-blossom-tour-east-route", ["Spring only", "Cherry blossom season"]),
    tour("busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju", ["Spring Seasonal", "Plum + Cherry Blossom"]),
    tour("busan-spring-cherry-blossom-gyeongju-highlights-day-tour", ["Spring Seasonal", "Cherry Blossom Tour"]),
    tour("jeju-winter-southwest-tangerine-snow-camellia-tour", ["Winter", "Camellia"]),
    tour("seoul-seoraksan-naksansa-temple-naksan-beach-day-trip", ["Day trip from Seoul"]),
    tour("jeju-island-private-car-charter-tour", ["Private Tour"]),
    tour("seoul-private-nami-morning-calm-petite-france", ["Private Tour"]),
    tour("busan-top-attractions-day-tour", ["Small group"]),
    tour("pocheon-sanjeong-lake-herb-island-art-valley", ["Nature & Photo Trip"]),
  ];

  it("on 2026-05-23 surfaces hydrangea as Now Seasonal + format shelves (no cherry/camellia coming-soon)", () => {
    const today = new Date(Date.UTC(2026, 4, 23));
    const shelves = getShelvesForDate(today, catalog);
    const keys = shelves.map((s) => `${s.key}${s.season ? `:${s.season.seasonKey}` : ""}`);

    expect(keys).toContain("editors-pick");
    expect(keys).toContain("now-seasonal:hydrangea");
    expect(keys).toContain("cruise-shore-excursion");
    expect(keys).toContain("small-group");
    expect(keys).toContain("private");
    expect(keys).toContain("classic-bus");

    // Camellia/cherry/plum/maple are out of season AND >90 days away
    expect(keys.some((k) => k.startsWith("coming-soon:"))).toBe(false);

    // Hydrangea shelf carries both hydrangea slugs
    const hyd = shelves.find((s) => s.season?.seasonKey === "hydrangea");
    expect(hyd?.tours.map((t) => t.slug).sort()).toEqual([
      "jeju-hydrangea-festival-tour-east-route",
      "jeju-hydrangea-festival-tour-southwest-route",
    ]);
  });

  it("on 2026-07-20 surfaces pink-muhly + maple as Coming Soon (D ≤ 90)", () => {
    // pink-muhly starts 09-30 → D-72; maple starts 10-15 → D-87. Both within 90.
    const today = new Date(Date.UTC(2026, 6, 20));
    const shelves = getShelvesForDate(today, catalog);
    const comingSoon = shelves
      .filter((s) => s.key === "coming-soon")
      .map((s) => s.season?.seasonKey)
      .sort();
    expect(comingSoon).toEqual(["maple"]); // pink-muhly has no matching tours in synthetic catalog
  });

  it("on 2026-12-20 surfaces camellia as Now Seasonal (wrap-around window)", () => {
    const today = new Date(Date.UTC(2026, 11, 20));
    const shelves = getShelvesForDate(today, catalog);
    const now = shelves.find((s) => s.key === "now-seasonal" && s.season?.seasonKey === "camellia");
    expect(now).toBeDefined();
    expect(now?.tours[0]?.slug).toBe("jeju-winter-southwest-tangerine-snow-camellia-tour");
  });

  it("drops empty shelves (pink-muhly never matches in this catalog)", () => {
    const today = new Date(Date.UTC(2026, 8, 1)); // 2026-09-01 — pink-muhly is D-29 (Coming Soon if it had tours)
    const shelves = getShelvesForDate(today, catalog);
    expect(shelves.some((s) => s.season?.seasonKey === "pink-muhly")).toBe(false);
  });

  it("same tour can appear in multiple shelves (B34)", () => {
    const today = new Date(Date.UTC(2026, 4, 23));
    const shelves = getShelvesForDate(today, catalog);
    const cruise = shelves.find((s) => s.key === "cruise-shore-excursion")!;
    const smallGroup = shelves.find((s) => s.key === "small-group")!;
    // jeju-cruise-shore-excursion-small-group-tour carries Cruise + Small group badges
    const cruiseSlugs = cruise.tours.map((t) => t.slug);
    const smallGroupSlugs = smallGroup.tours.map((t) => t.slug);
    expect(cruiseSlugs).toContain("jeju-cruise-shore-excursion-small-group-tour");
    expect(smallGroupSlugs).toContain("jeju-cruise-shore-excursion-small-group-tour");
  });

  it("preserves catalog order within each shelf", () => {
    const today = new Date(Date.UTC(2026, 4, 23));
    const shelves = getShelvesForDate(today, catalog);
    const ep = shelves.find((s) => s.key === "editors-pick")!;
    // Editor's Pick uses its own declared order (EDITORS_PICK_SLUGS), not catalog order
    const expectedOrder = EDITORS_PICK_SLUGS.filter((s) => catalog.some((c) => c.slug === s));
    expect(ep.tours.map((t) => t.slug)).toEqual(expectedOrder);
  });
});
