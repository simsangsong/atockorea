/**
 * Static curated preview for the unified planner's "Build myself" mode.
 *
 * Deliberately static (NOT a live `match_pois` fetch) per the unified planner
 * plan (docs/landing-matcher-builder-unified-plan-2026-05-20.md): keeps the
 * homepage fast — no Supabase/POI query, no Google Maps JS on `/` — and
 * sidesteps the still-pending POI image-quality cleanup. All three builder
 * regions (jeju, busan, seoul) now route into the itinerary builder (Seoul
 * added with the Phase 9 pricing overhaul — pricing-policy.ts).
 *
 * Stop names are romanized proper nouns shown verbatim across locales.
 */
export type PlannerBuildPreview = {
  /** Reuses the existing hero photo — no new asset, no extra bandwidth. */
  image: string;
  imageAlt: string;
  stops: string[];
};

export const PLANNER_BUILD_PREVIEW: Record<"jeju" | "busan" | "seoul", PlannerBuildPreview> = {
  jeju: {
    image: "/images/hero/jeju-hero.jpg",
    imageAlt: "Jeju Island coastline",
    stops: ["Seongsan", "O'sulloc", "Aewol"],
  },
  busan: {
    image: "/images/hero/busan-hero.jpg",
    imageAlt: "Busan coastal scene",
    stops: ["Haedong Yonggungsa", "Gamcheon", "Gyeongju"],
  },
  seoul: {
    image: "/images/hero/seoul-hero.jpg",
    imageAlt: "Seoul skyline",
    stops: ["Gyeongbokgung", "Bukchon", "Namsan"],
  },
};
