import {
  HeroSection,
  BestMatchPreview,
  DestinationsShowcase,
  ChooseTravelStyle,
  FeaturedProductsShowcase,
  WhyAtockorea,
  ProcessOperational,
  FinalCTA,
} from "@/components/home/v2/sections";
import { HomeV2MatchProvider } from "@/components/home/v2/HomeV2MatchProvider";
import { StickyHomeCta } from "@/components/home/v2/StickyHomeCta";

/**
 * v0-derived homepage main content (presentation-only).
 * Render inside site `<main>` under the existing Header; Footer/BottomNav stay in shell.
 *
 * Match: `HomeV2MatchProvider` calls `POST /api/tour-product/match` (Gemini intent + `match_tours.matching_profile` scoring).
 */
export default function HomeV2Page() {
  return (
    <div className="relative min-w-0">
      <HomeV2MatchProvider>
        <div className="home-v2-body-isolate relative z-0">
          <HeroSection />
          <BestMatchPreview />
          <DestinationsShowcase />
          <ChooseTravelStyle />
          <FeaturedProductsShowcase />
          <WhyAtockorea />
          <ProcessOperational />
          <FinalCTA />
        </div>
        <StickyHomeCta />
      </HomeV2MatchProvider>
    </div>
  );
}
