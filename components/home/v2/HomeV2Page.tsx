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
          <div className="h-10 bg-gradient-to-b from-[#FDF8F0] to-[#1C1810]" aria-hidden />
          <ProcessOperational />
          <div className="h-10 bg-gradient-to-b from-[#141008] to-white" aria-hidden />
          <FinalCTA />
        </div>
        <StickyHomeCta />
      </HomeV2MatchProvider>
    </div>
  );
}
