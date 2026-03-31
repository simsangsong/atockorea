import { TourHero } from "@/components/tour/sections/tour-hero"
import { OverviewSnapshot } from "@/components/tour/sections/overview-snapshot"
import { WhyThisTour } from "@/components/tour/sections/why-this-tour"
import { RouteTimeline } from "@/components/tour/sections/route-timeline"
import { RouteFlow } from "@/components/tour/sections/route-flow"
import { SeasonalInfo } from "@/components/tour/sections/seasonal-info"
import { PracticalDetails } from "@/components/tour/sections/practical-details"
import { TrustSection } from "@/components/tour/sections/trust-section"
import { AfterBookingSupport } from "@/components/tour/sections/after-booking-support"
import { PremiumFAQ } from "@/components/tour/sections/premium-faq"
import { RelatedTours } from "@/components/tour/sections/related-tours"
import { StickyBookingBar, DesktopBookingCard } from "@/components/tour/sticky-booking-bar"

export default function TourDetailPage() {
  return (
    <main className="tour-detail-premium sg-dp-theme min-h-screen">
      {/* Desktop: Two-column layout — outer grid matches SmallGroupTourDetailTemplate measure */}
      <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-10 lg:max-w-[1400px] lg:mx-auto">
        <div>
          <div className="sg-reveal">
            <TourHero
              title="East Signature Nature Core"
              subtitle="A refined East Jeju route for first-time visitors who want iconic scenery, local character, and a smooth all-day rhythm."
              ratingLine="0.0 (0)"
              durationLine="Full day · East Jeju"
              stopsLine="6 stops"
              eyebrow="Signature"
              imageSrc="https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1200&q=80"
              routePreviewLine="Hamdeok Beach — Seongeup — Local Lunch — Seopjikoji — Seongsan — Stone Park"
              policyChips={['Free cancel']}
              availabilityHref="#desktop-booking"
            />
          </div>

          <div className="divide-y divide-neutral-100 bg-white mt-6 rounded-t-3xl lg:rounded-none lg:mt-0 lg:bg-[var(--dp-bg)]">
            <OverviewSnapshot />
            
            <WhyThisTour />
            
            <RouteTimeline />
            
            <RouteFlow />
            
            <SeasonalInfo />
            
            <PracticalDetails />
            
            <TrustSection />
            
            <AfterBookingSupport />
            
            <PremiumFAQ />
            
            <RelatedTours />
          </div>
        </div>

        <div className="hidden lg:block lg:pt-[calc(65vh-10rem)] lg:pr-8" id="desktop-booking">
          <div className="sticky top-8">
            <div className="sg-dp-glass-elevated rounded-2xl p-6 lg:p-7">
              <DesktopBookingCard price="₩175,000" priceNote="per person" />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky booking bar */}
      <StickyBookingBar 
        price="₩175,000" 
        priceNote="per person" 
      />
    </main>
  )
}
