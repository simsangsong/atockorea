"use client";

import type { CSSProperties } from "react";
import {
  HeroSection,
  BestMatchPreview,
  ChooseTravelStyle,
  ProcessOperational,
  VisualBreak,
  TravelerReviews,
  FinalCTA,
} from "@/components/home/v2/sections";
import { HomeV2MatchProvider } from "@/components/home/v2/HomeV2MatchProvider";
import { HomeV2ReviewSummaryProvider } from "@/components/home/v2/HomeV2ReviewSummaryProvider";

/** v0 page shell: atmospheric background only (no v0 header/footer/sticky bar). */
const HOME_V2_ATMOSPHERE_STYLE: CSSProperties = {
  background: `
    radial-gradient(ellipse 100% 50% at 20% 15%, rgba(219, 234, 254, 0.3) 0%, transparent 50%),
    radial-gradient(ellipse 70% 50% at 85% 25%, rgba(254, 215, 170, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse 60% 40% at 50% 85%, rgba(233, 213, 255, 0.12) 0%, transparent 50%),
    radial-gradient(ellipse 50% 50% at 10% 70%, rgba(167, 243, 208, 0.08) 0%, transparent 50%),
    linear-gradient(180deg, #FFFDFB 0%, #FDF9F5 40%, #F9F4ED 100%)
  `,
};

/**
 * v0-derived homepage main content (presentation-only).
 * Render inside site `<main>` under the existing Header; Footer/BottomNav stay in shell.
 *
 * Match: `HomeV2MatchProvider` calls `POST /api/tour-product/match` (Gemini intent + `tour_matching_profiles` scoring).
 */
export default function HomeV2Page() {
  return (
    <div className="relative min-w-0">
      <div className="pointer-events-none fixed inset-0 -z-10" style={HOME_V2_ATMOSPHERE_STYLE} aria-hidden />
      <HomeV2MatchProvider>
        <HomeV2ReviewSummaryProvider>
          <div className="home-v2-body-isolate relative z-0">
            <HeroSection />
            <BestMatchPreview />
            <ChooseTravelStyle />
            <ProcessOperational />
            <VisualBreak />
            <TravelerReviews />
            <FinalCTA />
          </div>
        </HomeV2ReviewSummaryProvider>
      </HomeV2MatchProvider>
    </div>
  );
}
