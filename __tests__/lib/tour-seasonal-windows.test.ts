import {
  getSeasonalOperatingWindow,
  isDateOutsideSeasonalWindow,
} from "@/lib/tour-seasonal-windows";

describe("tour-seasonal-windows", () => {
  describe("getSeasonalOperatingWindow", () => {
    it("returns the window for busan-plum cherry blossom", () => {
      const w = getSeasonalOperatingWindow(
        "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju",
      );
      expect(w).not.toBeNull();
      expect(w?.startMonthDay).toBe("02-25");
      expect(w?.endMonthDay).toBe("04-10");
    });

    it("returns the window for busan-spring cherry blossom", () => {
      const w = getSeasonalOperatingWindow(
        "busan-spring-cherry-blossom-gyeongju-highlights-day-tour",
      );
      expect(w?.startMonthDay).toBe("03-28");
      expect(w?.endMonthDay).toBe("04-10");
    });

    it("returns null for non-seasonal slugs", () => {
      expect(getSeasonalOperatingWindow("east-signature-nature-core")).toBeNull();
      expect(getSeasonalOperatingWindow("")).toBeNull();
      expect(getSeasonalOperatingWindow(null)).toBeNull();
      expect(getSeasonalOperatingWindow(undefined)).toBeNull();
    });
  });

  describe("isDateOutsideSeasonalWindow", () => {
    const plumSlug = "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju";
    const springSlug = "busan-spring-cherry-blossom-gyeongju-highlights-day-tour";

    it("returns false for dates inside the busan-plum window", () => {
      expect(isDateOutsideSeasonalWindow(plumSlug, "2027-02-25")).toBe(false); // start inclusive
      expect(isDateOutsideSeasonalWindow(plumSlug, "2027-03-15")).toBe(false);
      expect(isDateOutsideSeasonalWindow(plumSlug, "2027-04-10")).toBe(false); // end inclusive
    });

    it("returns true for dates outside the busan-plum window", () => {
      expect(isDateOutsideSeasonalWindow(plumSlug, "2027-02-24")).toBe(true); // 1 day before
      expect(isDateOutsideSeasonalWindow(plumSlug, "2027-04-11")).toBe(true); // 1 day after
      expect(isDateOutsideSeasonalWindow(plumSlug, "2026-05-23")).toBe(true); // today (May)
      expect(isDateOutsideSeasonalWindow(plumSlug, "2026-12-25")).toBe(true);
    });

    it("returns false only inside busan-spring's narrower window", () => {
      // 03-15 is OK for plum but BEFORE spring's 03-28 start
      expect(isDateOutsideSeasonalWindow(plumSlug, "2027-03-15")).toBe(false);
      expect(isDateOutsideSeasonalWindow(springSlug, "2027-03-15")).toBe(true);
      expect(isDateOutsideSeasonalWindow(springSlug, "2027-03-28")).toBe(false);
      expect(isDateOutsideSeasonalWindow(springSlug, "2027-04-10")).toBe(false);
    });

    it("returns false for non-seasonal slugs (any date passes)", () => {
      expect(isDateOutsideSeasonalWindow("east-signature-nature-core", "2026-05-23")).toBe(false);
      expect(isDateOutsideSeasonalWindow("east-signature-nature-core", "2027-01-01")).toBe(false);
    });

    it("returns false for malformed date strings", () => {
      // Defensive: rather than throwing, treat malformed input as "no opinion" and
      // let downstream availability logic decide. (API still validates `date`.)
      expect(isDateOutsideSeasonalWindow(plumSlug, "bad-date")).toBe(false);
      expect(isDateOutsideSeasonalWindow(plumSlug, "")).toBe(false);
    });
  });
});
