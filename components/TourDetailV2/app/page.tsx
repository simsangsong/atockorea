import { HeroSection } from "@/components/tour/hero-section"
import { StickySubnav } from "@/components/tour/sticky-subnav"
import { DecisionSummary } from "@/components/tour/decision-summary"
import { RouteGallery } from "@/components/tour/route-gallery"
import { ItinerarySection } from "@/components/tour/itinerary-section"
import { RouteShape } from "@/components/tour/route-shape"
import { ExperienceSection } from "@/components/tour/experience-section"
import { PracticalDetails } from "@/components/tour/practical-details"
import { BookingSupport } from "@/components/tour/booking-support"
import { QuestionsSection } from "@/components/tour/questions-section"
import { ReviewsSection } from "@/components/tour/reviews-section"
import { RecommendationsSection } from "@/components/tour/recommendations-section"
import { StickyBookingBar } from "@/components/tour/sticky-booking-bar"
import { SiteHeader } from "@/components/tour/site-header"

export default function TourDetailPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <HeroSection />
        <StickySubnav />
        
        {/* Overview Section - Warm Ivory */}
        <section id="overview" className="bg-warm-ivory">
          <div className="mx-auto max-w-xl px-5 py-10">
            <DecisionSummary />
          </div>
        </section>
        
        {/* Gallery Section - Soft Pearl */}
        <section className="bg-soft-pearl">
          <div className="mx-auto max-w-xl px-5 py-12">
            <RouteGallery />
          </div>
        </section>
        
        {/* Itinerary Section - Mist Blue */}
        <section id="itinerary" className="bg-mist-blue">
          <div className="mx-auto max-w-xl px-5 py-12">
            <ItinerarySection />
          </div>
        </section>
        
        {/* Route Shape - Cloud Gray */}
        <section className="bg-cloud-gray">
          <div className="mx-auto max-w-xl px-5 py-12">
            <RouteShape />
          </div>
        </section>
        
        {/* Experience Section - Sand Blush */}
        <section id="details" className="bg-sand-blush">
          <div className="mx-auto max-w-xl px-5 py-12">
            <ExperienceSection />
          </div>
        </section>
        
        {/* Practical Details - Soft Pearl */}
        <section className="bg-soft-pearl">
          <div className="mx-auto max-w-xl px-5 py-12">
            <PracticalDetails />
          </div>
        </section>
        
        {/* Booking Support - Mist Blue */}
        <section className="bg-mist-blue">
          <div className="mx-auto max-w-xl px-5 py-12">
            <BookingSupport />
          </div>
        </section>
        
        {/* Questions - Warm Ivory */}
        <section id="faq" className="bg-warm-ivory">
          <div className="mx-auto max-w-xl px-5 py-12">
            <QuestionsSection />
          </div>
        </section>
        
        {/* Reviews - Cloud Gray */}
        <section id="reviews" className="bg-cloud-gray">
          <div className="mx-auto max-w-xl px-5 py-12">
            <ReviewsSection />
          </div>
        </section>
        
        {/* Recommendations - Sand Blush */}
        <section className="bg-sand-blush overflow-hidden">
          <div className="py-14">
            <RecommendationsSection />
          </div>
        </section>
      </main>
      
      <StickyBookingBar />
    </div>
  )
}
