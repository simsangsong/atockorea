/**
 * v0 East tour detail — full page composition (raw snapshot).
 * Not wired to any route. Integrate behind `EastSmallGroupTourV2Page` later.
 *
 * Header: `SiteHeader` (exclude when using site chrome).
 * Sticky CTA: `StickyBookingBar` (preserve for fidelity).
 */
import { HeroSection } from "./components/tour/hero-section";
import { StickySubnav } from "./components/tour/sticky-subnav";
import { DecisionSummary } from "./components/tour/decision-summary";
import { RouteGallery } from "./components/tour/route-gallery";
import { ItinerarySection } from "./components/tour/itinerary-section";
import { RouteShape } from "./components/tour/route-shape";
import { ExperienceSection } from "./components/tour/experience-section";
import { PracticalDetails } from "./components/tour/practical-details";
import { BookingSupport } from "./components/tour/booking-support";
import { QuestionsSection } from "./components/tour/questions-section";
import { RecommendationsSection } from "./components/tour/recommendations-section";
import { StickyBookingBar } from "./components/tour/sticky-booking-bar";
import { SiteHeader } from "./components/tour/site-header";

export default function V0EastTourDetailPageComposition() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <HeroSection />
        <StickySubnav />

        <section id="overview" className="bg-warm-ivory">
          <div className="mx-auto max-w-xl px-5 py-10">
            <DecisionSummary />
          </div>
        </section>

        <section className="bg-soft-pearl">
          <div className="mx-auto max-w-xl px-5 py-12">
            <RouteGallery />
          </div>
        </section>

        <section id="itinerary" className="bg-mist-blue">
          <div className="mx-auto max-w-xl px-5 py-12">
            <ItinerarySection />
          </div>
        </section>

        <section className="bg-cloud-gray">
          <div className="mx-auto max-w-xl px-5 py-12">
            <RouteShape />
          </div>
        </section>

        <section id="details" className="bg-sand-blush">
          <div className="mx-auto max-w-xl px-5 py-12">
            <ExperienceSection />
          </div>
        </section>

        <section className="bg-soft-pearl">
          <div className="mx-auto max-w-xl px-5 py-12">
            <PracticalDetails />
          </div>
        </section>

        <section className="bg-mist-blue">
          <div className="mx-auto max-w-xl px-5 py-12">
            <BookingSupport />
          </div>
        </section>

        <section id="faq" className="bg-warm-ivory">
          <div className="mx-auto max-w-xl px-5 py-12">
            <QuestionsSection />
          </div>
        </section>

        <section className="bg-sand-blush overflow-hidden">
          <div className="py-14">
            <RecommendationsSection />
          </div>
        </section>
      </main>

      <StickyBookingBar />
    </div>
  );
}
