import { inferTourCatalogType, tagsForCatalogType } from "@/lib/tour-catalog-type-infer";

describe("inferTourCatalogType", () => {
  it("classifies known bus SKUs as bus even when legacy badges say small group", () => {
    const samples = [
      ["from-busan-gyeongju-ancient-capital-day-tour", ["Small group", "Calmer pace"]],
      ["from-incheon-seoul-day-tour-cruise-guests", ["Cruise excursion", "Small shared van"]],
      ["jeju-eastern-unesco-spots-day-tour", ["Small group", "Jeju"]],
      ["jeju-southern-top-unesco-spots-tour", ["소그룹", "제주 남부"]],
      ["jeju-west-south-full-day-authentic-tour", ["Small Group", "Jeju"]],
    ] as const;

    for (const [slug, badges] of samples) {
      const type = inferTourCatalogType({
        slug,
        title: slug,
        badges: [...badges],
        tag: "Small group · region",
      });
      expect(type).toBe("bus");
      expect(tagsForCatalogType([...badges], type)).not.toContain("Small group");
      expect(tagsForCatalogType([...badges], type)).not.toContain("Small Group");
      expect(tagsForCatalogType([...badges], type)).not.toContain("소그룹");
    }
  });
});
