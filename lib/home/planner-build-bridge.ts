import type { HeroDestination } from "@/lib/home/types/hero-planner";

/**
 * Phase 5 — match→build bridge.
 *
 * The match-result surfaces (BestMatchPreview, MatcherMorphingPanel) and the
 * planner card (LandingPlannerCard) live in different parts of the tree and
 * don't share mode state. Rather than lift state or thread callbacks through
 * the match provider, the result CTA dispatches a window CustomEvent that the
 * planner card listens for and flips itself into build mode. Centralised here
 * so the event name can't drift between dispatcher and listener.
 */
export const PLANNER_BUILD_EVENT = "atoc:planner-build";

/** Localised destination-noun key per destination, reusing the existing hero
 *  labels — used to interpolate {destination} into `planner.customizeThisDay`. */
export const PLANNER_DEST_LABEL_KEY: Record<HeroDestination, string> = {
  jeju: "premium.hero.destJeju",
  seoul: "premium.hero.destSeoul",
  busan: "premium.hero.destBusan",
};

/** Narrow a free-form provider value (matchedDestination: string | null) to a
 *  known builder destination, or null. */
export function asPlannerDestination(value: string | null): HeroDestination | null {
  return value === "jeju" || value === "seoul" || value === "busan" ? value : null;
}

/** Fire the bridge event. No-op on the server. */
export function dispatchPlannerBuild(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PLANNER_BUILD_EVENT));
}
