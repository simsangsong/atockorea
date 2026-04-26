"use client";

import { useMemo } from "react";

import {
  eastSignatureNatureCoreDetailViewModel as staticVm,
  type EastSignatureNatureCoreDetailViewModel,
} from "./eastSignatureNatureCoreDetailViewModel";
import { pickAssistantQuickChipsFromViewModel } from "@/lib/tour-product/assistantQuickChips";
import type { TourProductCheckoutContext } from "@/lib/tour-product/eastSignatureCheckoutContext";
import {
  TourAtAGlance,
  TourAtmosphereGallery,
  TourBookingSupportSection,
  TourFaqSection,
  TourFitSection,
  TourHeroSection,
  TourPracticalDetails,
  TourReviewsSection,
  TourStickyBookingBar,
  TourTabsNav,
  TourTimelineSection,
} from "./tour-detail-sections";
import { TourProductAiAssistantWidget } from "@/components/product-tour-static/_shared/TourProductAiAssistantWidget";

export type EastSignatureNatureCoreDetailClientProps = {
  /** Supabase 등에서 조립한 뷰모델; 없으면 번들 내 정적 데이터 */
  viewModel?: EastSignatureNatureCoreDetailViewModel;
  /** 기존 `/tour/[id]/checkout` + Stripe — `tours` 가격이 결제 금액 소스 */
  checkout?: TourProductCheckoutContext | null;
  tourProductSlug?: string;
};

/** 레이아웃(`SitePageShell`)에서 메인 Header/Footer — 본문 + StickyBookingBar 만 담당. */
export function EastSignatureNatureCoreDetailClient({
  viewModel,
  checkout,
  tourProductSlug = "east-signature-nature-core",
}: EastSignatureNatureCoreDetailClientProps) {
  const vm: EastSignatureNatureCoreDetailViewModel = viewModel ?? staticVm;
  const productTitle = `${vm.headlineLine1} ${vm.headlineLine2}`.replace(/\s+/g, " ").trim();
  const supportQuickChips = useMemo(() => pickAssistantQuickChipsFromViewModel(vm, 4), [vm]);
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
            <TourTimelineSection
              itineraryStops={vm.itineraryStops}
              sectionUi={vm.sectionUi}
              pickup_dropoff={vm.pickup_dropoff}
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

      <TourProductAiAssistantWidget
        tourProductSlug={tourProductSlug}
        productTitle={productTitle}
        supportQuickChips={supportQuickChips}
      />
    </div>
  );
}
