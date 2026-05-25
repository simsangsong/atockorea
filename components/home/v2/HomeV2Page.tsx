import {
  HeroSection,
  DestinationsShowcase,
  ChooseTravelStyle,
  FeaturedProductsShowcase,
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
 * `featuredMediaBySlug` is the server-rendered admin-media snapshot for the
 * Most-Loved rail (resolved one layer up by `app/page.tsx`). It is `undefined`
 * when this component is rendered from a `'use client'` page (e.g.
 * `app/[locale]/page.tsx`), in which case `FeaturedProductsShowcase` falls
 * back to its build-time static catalog image until the client effect
 * resolves — i.e. the old flashing behaviour. The default `/` route gets
 * the SSR pre-fetch and renders the freshest URL on first paint.
 *
 * Match: `HomeV2MatchProvider` calls `POST /api/tour-product/match` (Gemini intent + `match_tours.matching_profile` scoring).
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
          <DeferredBestMatchPreview />
          <FeaturedProductsShowcase initialMediaBySlug={featuredMediaBySlug} />
          <DestinationsShowcase />
          <ChooseTravelStyle />
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
