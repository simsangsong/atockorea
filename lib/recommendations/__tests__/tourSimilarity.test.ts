import {
  buildUserAffinityAnchor,
  pickTourRecommendations,
  scoreTourSimilarity,
  type TourSimilarityCandidate,
} from "../tourSimilarity";

const mk = (
  partial: Partial<TourSimilarityCandidate> & { slug: string },
): TourSimilarityCandidate => ({
  region: "",
  badges: [],
  duration: "",
  listPriceUsd: 50,
  rating: 4.5,
  reviewCount: 10,
  ...partial,
});

describe("scoreTourSimilarity", () => {
  it("returns -1 total for self", () => {
    const a = mk({ slug: "x", region: "Seoul", badges: ["Small Group"] });
    expect(scoreTourSimilarity(a, a).total).toBe(-1);
  });

  it("rewards region token overlap", () => {
    const anchor = mk({ slug: "a", region: "Seoul & Suburbs", listPriceUsd: 60 });
    const sameToken = mk({ slug: "b", region: "Seoul (from Incheon cruise terminal)", listPriceUsd: 60 });
    const otherToken = mk({ slug: "c", region: "Jeju East", listPriceUsd: 60 });
    expect(scoreTourSimilarity(anchor, sameToken).region).toBeGreaterThan(0);
    expect(scoreTourSimilarity(anchor, otherToken).region).toBe(0);
  });

  it("rewards badge overlap (case-insensitive)", () => {
    const anchor = mk({ slug: "a", badges: ["Small Group", "Private Charter"] });
    const overlap = mk({ slug: "b", badges: ["small group", "Lunch included"] });
    const none = mk({ slug: "c", badges: ["Large coach", "Cruise excursion"] });
    expect(scoreTourSimilarity(anchor, overlap).badge).toBeGreaterThan(0);
    expect(scoreTourSimilarity(anchor, none).badge).toBe(0);
  });

  it("rewards similar duration tiers", () => {
    const anchor = mk({ slug: "a", duration: "10 hours" });
    expect(scoreTourSimilarity(anchor, mk({ slug: "b", duration: "10 hours" })).duration).toBe(5);
    expect(scoreTourSimilarity(anchor, mk({ slug: "c", duration: "8 hours" })).duration).toBe(3);
    expect(scoreTourSimilarity(anchor, mk({ slug: "d", duration: "5 hours" })).duration).toBe(1);
    expect(scoreTourSimilarity(anchor, mk({ slug: "e", duration: "2 days" })).duration).toBe(0);
    // 1-day candidate parses to 8h via the day-fallback → tier 3.
    expect(scoreTourSimilarity(anchor, mk({ slug: "f", duration: "1 day" })).duration).toBe(3);
  });

  it("rewards price band proximity", () => {
    const anchor = mk({ slug: "a", listPriceUsd: 100 });
    expect(scoreTourSimilarity(anchor, mk({ slug: "b", listPriceUsd: 95 })).price).toBe(4);
    expect(scoreTourSimilarity(anchor, mk({ slug: "c", listPriceUsd: 70 })).price).toBe(2);
    expect(scoreTourSimilarity(anchor, mk({ slug: "d", listPriceUsd: 250 })).price).toBe(0);
  });
});

describe("pickTourRecommendations", () => {
  it("excludes self and items with no price", () => {
    const anchor = mk({ slug: "a", region: "Seoul", listPriceUsd: 60 });
    const candidates = [
      anchor,
      mk({ slug: "b", region: "Seoul", listPriceUsd: 0 }),
      mk({ slug: "c", region: "Seoul", listPriceUsd: 60 }),
    ];
    const picks = pickTourRecommendations(anchor, candidates, { k: 6 });
    expect(picks.map((p) => p.slug)).toEqual(["c"]);
  });

  it("orders by similarity score, breaking ties on popularity", () => {
    const anchor = mk({ slug: "a", region: "Seoul", badges: ["Small Group"], listPriceUsd: 60 });
    const candidates = [
      mk({ slug: "low", region: "Jeju", badges: ["Large coach"], listPriceUsd: 60, rating: 5, reviewCount: 1000 }),
      mk({ slug: "high", region: "Seoul", badges: ["Small Group"], listPriceUsd: 60, rating: 4.6, reviewCount: 5 }),
      mk({ slug: "mid", region: "Seoul", badges: ["Cruise excursion"], listPriceUsd: 60, rating: 4.7, reviewCount: 50 }),
    ];
    const picks = pickTourRecommendations(anchor, candidates, { k: 3 });
    expect(picks[0].slug).toBe("high");
    expect(picks[1].slug).toBe("mid");
    expect(picks[2].slug).toBe("low");
  });

  it("enforces per-region diversity cap then relaxes when short", () => {
    const anchor = mk({ slug: "a", region: "Seoul", listPriceUsd: 60 });
    const candidates = [
      mk({ slug: "s1", region: "Seoul", listPriceUsd: 60, rating: 4.9, reviewCount: 100 }),
      mk({ slug: "s2", region: "Seoul", listPriceUsd: 60, rating: 4.8, reviewCount: 90 }),
      mk({ slug: "s3", region: "Seoul", listPriceUsd: 60, rating: 4.7, reviewCount: 80 }),
      mk({ slug: "s4", region: "Seoul", listPriceUsd: 60, rating: 4.6, reviewCount: 70 }),
      mk({ slug: "j1", region: "Jeju", listPriceUsd: 60, rating: 4.5, reviewCount: 60 }),
      mk({ slug: "b1", region: "Busan", listPriceUsd: 60, rating: 4.5, reviewCount: 50 }),
    ];
    const picks = pickTourRecommendations(anchor, candidates, { k: 6, perRegionCap: 3 });
    const seoulPicks = picks.filter((p) => p.region === "Seoul");
    expect(seoulPicks.length).toBeLessThanOrEqual(4); // 3 from pass 1 + relax pass may add 1
    expect(picks.map((p) => p.slug)).toContain("j1");
    expect(picks.map((p) => p.slug)).toContain("b1");
  });

  it("returns up to k picks", () => {
    const anchor = mk({ slug: "a" });
    const candidates = Array.from({ length: 20 }, (_, i) =>
      mk({ slug: `c${i}`, region: `Region${i}` }),
    );
    expect(pickTourRecommendations(anchor, candidates, { k: 6 }).length).toBe(6);
    expect(pickTourRecommendations(anchor, candidates, { k: 3 }).length).toBe(3);
  });
});

describe("buildUserAffinityAnchor", () => {
  it("returns null for empty input", () => {
    expect(buildUserAffinityAnchor([])).toBeNull();
  });

  it("returns null when no signal extractable", () => {
    expect(buildUserAffinityAnchor([{ region: "", city: "", duration: "", badges: [], listPriceUsd: 0 }])).toBeNull();
  });

  it("picks dominant region token from booked/wishlisted city/region", () => {
    const anchor = buildUserAffinityAnchor([
      { city: "Seoul", region: "Seoul (from Incheon)", listPriceUsd: 60 },
      { city: "Seoul", region: "Seoul & Suburbs", listPriceUsd: 70 },
      { city: "Jeju", region: "East Jeju", listPriceUsd: 65 },
    ]);
    expect(anchor).not.toBeNull();
    expect(anchor!.region).toBe("seoul");
  });

  it("averages duration and price", () => {
    const anchor = buildUserAffinityAnchor([
      { duration: "8 hours", listPriceUsd: 60 },
      { duration: "10 hours", listPriceUsd: 80 },
    ]);
    expect(anchor).not.toBeNull();
    expect(anchor!.duration).toBe("9.0 hours");
    expect(anchor!.listPriceUsd).toBe(70);
  });
});
