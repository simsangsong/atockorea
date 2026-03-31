import { TourHero } from '@/components/tour/tour-hero'
import { OverviewCards } from '@/components/tour/overview-cards'
import { BestForSection } from '@/components/tour/best-for-section'
import { RouteTimeline } from '@/components/tour/route-timeline'
import { RouteFlow } from '@/components/tour/route-flow'
import { SeasonalSection } from '@/components/tour/seasonal-section'
import { GuestDetails } from '@/components/tour/guest-details'
import { TrustSection } from '@/components/tour/trust-section'
import { AfterBooking } from '@/components/tour/after-booking'
import { FAQSection } from '@/components/tour/faq-section'
import { BookingBar } from '@/components/tour/booking-bar'
import { RelatedTours } from '@/components/tour/related-tours'

export default function TourDetailPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Desktop layout with sidebar booking card */}
      <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-10 lg:max-w-[1400px] lg:mx-auto">
        {/* Main content */}
        <div>
          <TourHero />
          
          {/* Elegant divider */}
          <div className="section-divider mx-5 md:mx-8 lg:mx-10" />
          
          <OverviewCards />
          <BestForSection />
          <RouteTimeline />
          <RouteFlow />
          <SeasonalSection />
          <GuestDetails />
          <TrustSection />
          <AfterBooking />
          <FAQSection />
        </div>
        
        {/* Desktop booking sidebar */}
        <div className="hidden lg:block lg:pt-[calc(65vh-10rem)] lg:pr-8">
          <BookingBar />
        </div>
      </div>
      
      {/* Elegant section transition */}
      <div className="section-divider mx-5 md:mx-8 lg:mx-10 my-8" />
      
      {/* Related tours - full width */}
      <RelatedTours />
      
      {/* Mobile booking bar */}
      <div className="lg:hidden">
        <BookingBar />
      </div>
    </main>
  )
}
