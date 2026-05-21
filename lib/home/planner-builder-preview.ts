/**
 * Static curated preview for the unified planner's "Build myself" mode.
 *
 * Deliberately static (NOT a live `match_pois` fetch) per the unified planner
 * plan (docs/landing-matcher-builder-unified-plan-2026-05-20.md): keeps the
 * homepage fast — no Supabase/POI query, no Google Maps JS on `/` — and
 * sidesteps the still-pending POI image-quality cleanup. Builder-supported
 * regions only (jeju, busan); Seoul uses the manual-request fallback.
 *
 * Stop names are romanized proper nouns shown verbatim across locales.
 */
export type PlannerBuildPreview = {
  /** Reuses the existing hero photo — no new asset, no extra bandwidth. */
  image: string;
  imageAlt: string;
  stops: string[];
};

export const PLANNER_BUILD_PREVIEW: Record<"jeju" | "busan", PlannerBuildPreview> = {
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
};
