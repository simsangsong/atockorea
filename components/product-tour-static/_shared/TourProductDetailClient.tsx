"use client";

import type { TourProductDetailViewModel } from "./tourProductFullPageJsonTypes";
import type { TourProductCheckoutContext } from "@/lib/tour-product/eastSignatureCheckoutContext";
import {
  TourAtAGlance,
  TourAtmosphereGallery,
  TourBookingSupportSection,
  TourDayFlowSection,
  TourFaqSection,
  TourFitSection,
  TourHeroSection,
  TourPracticalDetails,
  TourReviewsSection,
  TourStickyBookingBar,
  TourTabsNav,
  TourTimelineSection,
} from "@/components/product-tour-static/east-signature-nature-core/tour-detail-sections";

export type TourProductDetailClientProps = {
  viewModel: TourProductDetailViewModel;
  checkout?: TourProductCheckoutContext | null;
};

/**
 * Generic small-group tour detail page — East template layout, driven entirely
 * by the view-model built from `tour_product_full_page_v1` JSON (or Supabase).
 *
 * New slugs should route through this component via the catch-all
 * `app/tour-product/[slug]/page.tsx`; existing East / Jeju pages continue to
 * render through their slug-specific clients until migrated.
 */
export function TourProductDetailClient({ viewModel, checkout }: TourProductDetailClientProps) {
  const vm = viewModel;
  return (
    <div className="tour-product-v2-static-root min-h-screen bg-background">
      <main>
        <TourHeroSection headlineLine1={vm.headlineLine1} headlineLine2={vm.headlineLine2} hero={vm.hero} />
        <TourTabsNav subnavItems={vm.subnavItems} />

        <section id="overview" className="bg-warm-ivory">
          <div className="mx-auto max-w-xl px-5 py-10">
            <TourAtAGlance glanceItems={vm.glanceItems} sectionUi={vm.sectionUi} />
          </div>
        </section>

        <section className="bg-soft-pearl">
          <div className="mx-auto max-w-xl px-5 py-12">
            <TourAtmosphereGallery galleryItems={vm.galleryItems} sectionUi={vm.sectionUi} />
          </div>
        </section>

        <section id="itinerary" className="bg-mist-blue">
          <div className="mx-auto max-w-xl px-5 py-12">
            <TourTimelineSection itineraryStops={vm.itineraryStops} sectionUi={vm.sectionUi} />
          </div>
        </section>

        <section className="bg-cloud-gray">
          <div className="mx-auto max-w-xl px-5 py-12">
            <TourDayFlowSection
              routeFlowStops={vm.routeFlowStops}
              routePhases={vm.routePhases}
              routeShapeIntro={vm.routeShapeIntro}
              sectionUi={vm.sectionUi}
            />
          </div>
        </section>

        <section id="details" className="bg-sand-blush">
          <div className="mx-auto max-w-xl px-5 py-12">
            <TourFitSection whyTourWorks={vm.whyTourWorks} sectionUi={vm.sectionUi} />
          </div>
        </section>

        <section className="bg-soft-pearl">
          <div className="mx-auto max-w-xl px-5 py-12">
            <TourPracticalDetails
              practicalAccordionItems={vm.practicalAccordionItems}
              practicalWeatherStatic={vm.practicalWeatherStatic}
              seasonalVariations={vm.seasonalVariations}
              sectionUi={vm.sectionUi}
            />
          </div>
        </section>

        <section className="bg-mist-blue">
          <div className="mx-auto max-w-xl px-5 py-12">
            <TourBookingSupportSection
              bookingTrustItems={vm.bookingTrustItems}
              bookingSupportSteps={vm.bookingSupportSteps}
              sectionUi={vm.sectionUi}
            />
          </div>
        </section>

        <section id="faq" className="bg-warm-ivory">
          <div className="mx-auto max-w-xl px-5 py-12">
            <TourFaqSection staticQuestions={vm.staticQuestions} sectionUi={vm.sectionUi} />
          </div>
        </section>

        <section id="reviews" className="bg-cloud-gray">
          <div className="mx-auto max-w-xl px-5 py-12">
            <TourReviewsSection
              guestReviews={vm.guestReviews}
              reviewsSummary={vm.reviewsSummary}
              sectionUi={vm.sectionUi}
            />
          </div>
        </section>
      </main>

      <TourStickyBookingBar price={vm.price} checkout={checkout} />
    </div>
  );
}
