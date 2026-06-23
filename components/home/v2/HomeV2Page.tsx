import {
  HeroSection,
  DestinationsShowcase,
  ChooseTravelStyle,
  FeaturedProductsShowcase,
  AiAgentBand,
  WhyAtockorea,
  ProcessOperational,
  FinalCTA,
} from "@/components/home/v2/sections";
import { DeferredBestMatchPreview } from "@/components/home/v2/DeferredBestMatchPreview";
import { HomeV2MatchProvider } from "@/components/home/v2/HomeV2MatchProvider";
import { MatcherBottomSheetLazy } from "@/components/home/v2/MatcherBottomSheetLazy";
import { StickyHomeCta } from "@/components/home/v2/StickyHomeCta";
import type { TourProductCardMediaMap } from "@/lib/tour-product/cardMediaTypes";

/**
 * v0-derived homepage main content (presentation-only).
 * Render inside site `<main>` under the existing Header; Footer/BottomNav stay in shell.
 *
 * Phase 13 D36 — Phase 11's HomeBuilderSection mount has been REMOVED
 * because the home-embedded planner caused a duplicate-timeline UX
 * (result preview stripe + cart timeline both showing the same itinerary).
 * The builder is back to a standalone page at `/itinerary-builder` and
 * the hero "Build myself" tab forwards conditions via URL.
 */
export type HomeV2PageProps = {
  featuredMediaBySlug?: TourProductCardMediaMap;
};

export default function HomeV2Page({ featuredMediaBySlug }: HomeV2PageProps = {}) {
  return (
    <div className="relative min-w-0">
      <HomeV2MatchProvider>
        <div className="home-v2-body-isolate relative z-0">
          <HeroSection />
          {/* Reform W1e-1 — the tour-type decision (ChooseTravelStyle) is the
              primary action, so it leads right after the hero instead of sitting
              at slot 5. Match preview / featured / destinations follow. */}
          <ChooseTravelStyle />
          <DeferredBestMatchPreview />
          <FeaturedProductsShowcase initialMediaBySlug={featuredMediaBySlug} />
          <DestinationsShowcase />
          {/* L2 (chatbot promo) — "Your Korea travel agent" band sits in the
              value-prop cluster, just before the Why pillars. */}
          <AiAgentBand />
          <WhyAtockorea />
          <ProcessOperational />
          <FinalCTA />
        </div>
        <StickyHomeCta />
        <MatcherBottomSheetLazy />
      </HomeV2MatchProvider>
    </div>
  );
}
