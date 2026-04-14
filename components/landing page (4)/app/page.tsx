import { SiteHeader } from '@/components/home/site-header'
import { HeroSection } from '@/components/home/hero-section'
import { BestMatchPreview } from '@/components/home/best-match-preview'
import { ChooseTravelStyle } from '@/components/home/choose-travel-style'
import { ProcessOperational } from '@/components/home/process-operational'
import { VisualBreak } from '@/components/home/visual-break'
import { TravelerReviews } from '@/components/home/traveler-reviews'
import { FinalCTA } from '@/components/home/final-cta'
import { Footer } from '@/components/home/footer'
import { StickyPriceBar } from '@/components/home/sticky-price-bar'

export default function HomePage() {
  return (
    <div className="min-h-screen relative">
      {/* Premium Atmospheric Background - Enhanced */}
      <div 
        className="fixed inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 100% 50% at 20% 15%, rgba(219, 234, 254, 0.3) 0%, transparent 50%),
            radial-gradient(ellipse 70% 50% at 85% 25%, rgba(254, 215, 170, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 50% 85%, rgba(233, 213, 255, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse 50% 50% at 10% 70%, rgba(167, 243, 208, 0.08) 0%, transparent 50%),
            linear-gradient(180deg, #FFFDFB 0%, #FDF9F5 40%, #F9F4ED 100%)
          `
        }}
      />
      <SiteHeader />
      <main>
        <HeroSection />
        <BestMatchPreview />
        <ChooseTravelStyle />
        <ProcessOperational />
        <VisualBreak />
        <TravelerReviews />
        <FinalCTA />
      </main>
      <Footer />
      <StickyPriceBar />
    </div>
  )
}
