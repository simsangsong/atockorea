"use client";

import HeroPremium from '@/src/components/home/HeroPremium';
import ProductCardsPremium from '@/src/components/home/ProductCardsPremium';
import SmallGroupValuePremium from '@/src/components/home/SmallGroupValuePremium';
import HowItWorksPremium from '@/src/components/home/HowItWorksPremium';
import TrustAndReviewsSection from '@/src/components/home/TrustAndReviewsSection';
import ClassicBusSection from '@/components/ClassicBusSection';
import FinalCtaPremium from '@/src/components/home/FinalCtaPremium';

/**
 * Pre–v2 homepage main content (hero through final CTA).
 * Wrapped by route shells: {@link SitePageShell} on `/`, or Header/Footer on `/[locale]`.
 */
export default function LegacyHomePage() {
  return (
    <>
      <HeroPremium />
      <ProductCardsPremium />
      <SmallGroupValuePremium />
      <HowItWorksPremium />
      <TrustAndReviewsSection />
      <ClassicBusSection />
      <FinalCtaPremium />
    </>
  );
}
