import { isSameKeySet } from "@/components/itinerary-builder/AIRecommendPanel";

describe("isSameKeySet — Phase 10.4 auto-run gate", () => {
  it("equal arrays return true", () => {
    expect(isSameKeySet(["a", "b", "c"], ["a", "b", "c"])).toBe(true);
  });

  it("different length returns false", () => {
    expect(isSameKeySet(["a", "b"], ["a", "b", "c"])).toBe(false);
  });

  it("different order returns false (cart sequence matters for re-recommend gate)", () => {
    expect(isSameKeySet(["a", "b", "c"], ["c", "b", "a"])).toBe(false);
  });

  it("both empty returns true", () => {
    expect(isSameKeySet([], [])).toBe(true);
  });

  it("one empty returns false", () => {
    expect(isSameKeySet(["a"], [])).toBe(false);
  });

  it("single-element match returns true", () => {
    expect(isSameKeySet(["only_one"], ["only_one"])).toBe(true);
  });
});
