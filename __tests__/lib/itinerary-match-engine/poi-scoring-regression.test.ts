import { ruleParse } from "@/lib/tour-match-v2/parser-rule";
import { scorePoi, type ScorablePoiRow } from "@/lib/itinerary-match-engine/score-poi";
import {
  buildPoiRationale,
  isBuilderAttraction,
  metadataScoreAdjustment,
  resolveBuilderOrigin,
} from "@/lib/itinerary-match-engine/poi-taxonomy";

function poi(poi_key: string, name_en = poi_key): ScorablePoiRow {
  return {
    poi_key,
    name_en,
    region: "test",
    category: null,
    default_image_url: null,
    default_stay_minutes: 60,
    lat: 35,
    lng: 129,
    // Deliberately polluted values. Curated POI overrides must win over
    // inherited tour-profile noise.
    matching_profile: {
      market_fit: 1,
      street_food_fit: 1,
      beach_fit: 1,
      cafe_fit: 1,
      unesco_fit: 1,
      active_traveler_fit: 1,
      iconic_landmark_fit: 1,
    },
  };
}

function score(query: string, key: string): number {
  return scorePoi(poi(key), ruleParse(query)).total;
}

describe("itinerary POI scoring regressions", () => {
  it("keeps Busan food-market intent centered on actual markets", () => {
    const jagalchi = score("Busan foodie day, traditional markets, seafood and street food", "jagalchi_market");
    const gukje = score("Busan foodie day, traditional markets, seafood and street food", "gukje_market");
    const memorial = score("Busan foodie day, traditional markets, seafood and street food", "un_memorial_cemetery");
    const temple = score("Busan foodie day, traditional markets, seafood and street food", "haedong_yonggungsa");

    expect(jagalchi).toBeGreaterThan(memorial + 2);
    expect(gukje).toBeGreaterThan(temple + 2);
  });

  it("does not let inherited beach/cafe noise push Jeju Stone Park into beach cafe intent", () => {
    const aewol = score("Jeju beaches, ocean views, cafes, relaxed pace", "aewol_cafe_street");
    const hyeopjae = score("Jeju beaches, ocean views, cafes, relaxed pace", "hyeopjae_beach");
    const stonePark = score("Jeju beaches, ocean views, cafes, relaxed pace", "jeju_stone_park");

    expect(aewol).toBeGreaterThan(stonePark + 2);
    expect(hyeopjae).toBeGreaterThan(stonePark + 2);
  });

  it("penalizes hard walking stops for family easy-walking no-hiking intent", () => {
    const cheongsapo = score("family with kids, easy walking, stroller friendly, no hiking", "cheongsapo_blue_line_park");
    const songdo = score("family with kids, easy walking, stroller friendly, no hiking", "songdo_beach");
    const taejongdae = score("family with kids, easy walking, stroller friendly, no hiking", "taejongdae");
    const hallasan = score("family with kids, easy walking, stroller friendly, no hiking", "hallasan_eorimok_trail");

    expect(cheongsapo).toBeGreaterThan(taejongdae + 2);
    expect(songdo).toBeGreaterThan(hallasan + 3);
  });

  it("parses the revised preset wording into useful itinerary-builder signals", () => {
    const parsed = ruleParse("family with kids, easy walking, stroller friendly, no hiking");

    expect(parsed.personas).toContain("family_with_young_kids");
    expect(parsed.negative_signals).toContain("active_traveler");
    expect(parsed.boost_dimensions.mobility_friendly_fit).toBeGreaterThan(0);
    expect(parsed.boost_dimensions.easy_walking_fit).toBeGreaterThan(0);
  });

  it("keeps logistics stops out of normal builder recommendations", () => {
    expect(isBuilderAttraction("jeju_cruise_port")).toBe(false);
    expect(isBuilderAttraction("jagalchi_market")).toBe(true);
  });

  it("adds subregion preference without making it a hard filter", () => {
    const parsed = ruleParse("Jeju east coast highlights");

    expect(metadataScoreAdjustment("seongsan_ilchulbong", parsed)).toBeGreaterThan(0);
    expect(metadataScoreAdjustment("hyeopjae_beach", parsed)).toBeLessThan(0);
  });

  it("resolves cruise origins separately from region centroids", () => {
    const jejuCruise = resolveBuilderOrigin("jeju", "cruise", null);
    const regular = resolveBuilderOrigin("jeju", null, null);

    expect(jejuCruise).toEqual(expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }));
    expect(regular).toBeUndefined();
  });

  it("returns user-facing rationale labels from score components and metadata", () => {
    const parsed = ruleParse("beaches, ocean views, cafes, relaxed pace");
    const labels = buildPoiRationale(
      "aewol_cafe_street",
      { theme_overlap: 2.5, persona_align: 0 },
      parsed
    );

    expect(labels).toEqual(expect.arrayContaining(["beach", "cafes", "ocean views"]));
  });

  it("treats DB-promoted profiles as source-of-truth over local fallback overrides", () => {
    const promoted = scorePoi(
      {
        ...poi("jagalchi_market"),
        builder_profile_source: "curated_itinerary_builder",
        matching_profile: {
          food_market_fit: 0,
          market_fit: 0,
          street_food_fit: 0,
          seafood_market_fit: 0,
        },
      },
      ruleParse("Busan foodie day, traditional markets, seafood and street food")
    );

    expect(promoted.total).toBeLessThan(1);
  });

  it("uses DB builder metadata before local taxonomy for subregion and rationale", () => {
    const parsed = ruleParse("Jeju east coast highlights");
    const row = {
      poi_key: "hyeopjae_beach",
      poi_meta: {
        builder: {
          kind: "attraction",
          sub_regions: ["jeju_east"],
          category_group: "beach",
          rationale_tags: ["db east override"],
        },
      },
    };

    expect(metadataScoreAdjustment(row, parsed)).toBeGreaterThan(0);
    expect(buildPoiRationale(row, { theme_overlap: 1 }, parsed)).toContain("db east override");
  });
});
