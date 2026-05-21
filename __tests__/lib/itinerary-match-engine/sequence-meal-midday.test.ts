import { placeMealsMidday, isMealStop } from "@/lib/itinerary-match-engine/sequence";
import type { ScorablePoiRow } from "@/lib/itinerary-match-engine/score-poi";

function poi(poi_key: string, category: string): ScorablePoiRow {
  return {
    poi_key,
    name_en: poi_key,
    category,
    lat: 37.5,
    lng: 127.0,
    default_stay_minutes: 60,
  } as ScorablePoiRow;
}

describe("isMealStop", () => {
  it("flags lunch/meal categories + names", () => {
    expect(isMealStop(poi("gwangjang", "MARKET & STREETFOOD LUNCH"))).toBe(true);
    expect(isMealStop(poi("x", "Lunch at Gwangjang Market"))).toBe(true);
    expect(isMealStop(poi("y", "점심 식사"))).toBe(true);
  });
  it("does not flag sights", () => {
    expect(isMealStop(poi("namsan", "ICONIC TOWER (VIEWPOINT)"))).toBe(false);
    expect(isMealStop(poi("bukchon", "HANOK RESIDENTIAL DISTRICT"))).toBe(false);
  });
});

describe("placeMealsMidday", () => {
  it("moves a first-slot lunch into the middle of the day", () => {
    const ordered = [
      poi("lunch", "streetfood lunch"),
      poi("a", "tower"),
      poi("b", "palace"),
      poi("c", "hanok"),
      poi("d", "market"),
    ];
    const keys = placeMealsMidday(ordered).map((p) => p.poi_key);
    expect(keys[0]).not.toBe("lunch");
    const idx = keys.indexOf("lunch");
    expect(idx).toBeGreaterThan(0);
    expect(idx).toBeLessThan(keys.length - 1);
    // non-meal stops keep their drive-optimized relative order
    expect(keys.filter((k) => k !== "lunch")).toEqual(["a", "b", "c", "d"]);
  });

  it("also pulls a last-slot lunch off the end", () => {
    const ordered = [poi("a", "tower"), poi("b", "palace"), poi("c", "hanok"), poi("lunch", "lunch")];
    const keys = placeMealsMidday(ordered).map((p) => p.poi_key);
    expect(keys[keys.length - 1]).not.toBe("lunch");
  });

  it("no-ops for <3 stops or a meal-free day", () => {
    const two = [poi("lunch", "lunch"), poi("a", "tower")];
    expect(placeMealsMidday(two).map((p) => p.poi_key)).toEqual(["lunch", "a"]);
    const noMeal = [poi("a", "tower"), poi("b", "palace"), poi("c", "hanok")];
    expect(placeMealsMidday(noMeal).map((p) => p.poi_key)).toEqual(["a", "b", "c"]);
  });
});
