"use client";

import type { EastSignatureNatureCoreDetailViewModel } from "../east-signature-nature-core/eastSignatureNatureCoreDetailViewModel";
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
} from "../east-signature-nature-core/tour-detail-sections";
import { southwestHallasanOsullocAewolDetailViewModel as staticVm } from "./southwestDetailViewModel";

export type SouthwestHallasanOsullocAewolDetailClientProps = {
  viewModel?: EastSignatureNatureCoreDetailViewModel;
  checkout?: TourProductCheckoutContext | null;
};

/** east-signature-nature-core와 동일 레이아웃; 데이터만 서남쪽 상품. */
export function SouthwestHallasanOsullocAewolDetailClient({
  viewModel,
  checkout,
}: SouthwestHallasanOsullocAewolDetailClientProps) {
  const vm = viewModel ?? staticVm;
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
            <TourReviewsSection guestReviews={vm.guestReviews} reviewsSummary={vm.reviewsSummary} sectionUi={vm.sectionUi} />
          </div>
        </section>
      </main>

      <TourStickyBookingBar price={vm.price} checkout={checkout} />
    </div>
  );
}
