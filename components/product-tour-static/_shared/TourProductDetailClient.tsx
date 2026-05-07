"use client";
import { useMemo, useState } from "react";
import { Headphones, ShieldCheck, Zap } from "lucide-react";

import type { TourProductDetailViewModel } from "./tourProductFullPageJsonTypes";
import type { TourProductCheckoutContext } from "@/lib/tour-product/eastSignatureCheckoutContext";
import {
  TourAtAGlance,
  TourAtmosphereGallery,
  TourBookingSupportSection,
  TourDayFlowSection,
  TourDesktopBookingCard,
  TourFaqSection,
  TourFitSection,
  TourHeroSection,
  TourPickupDropoffSection,
  TourPracticalDetails,
  TourRecommendationsSection,
  TourReviewsSection,
  TourStickyBookingBar,
  TourTabsNav,
  TourTimelineSection,
} from "@/components/product-tour-static/east-signature-nature-core/tour-detail-sections";
import type { StaticTourProductRegistration } from "@/components/product-tour-static/catalog/staticTourProductRegistry";
import { TourProductAiAssistantWidget } from "@/components/product-tour-static/_shared/TourProductAiAssistantWidget";
import { pickAssistantQuickChipsFromViewModel } from "@/lib/tour-product/assistantQuickChips";
import { useTranslations } from "@/lib/i18n";

export type TourProductDetailClientProps = {
  viewModel: TourProductDetailViewModel;
  checkout?: TourProductCheckoutContext | null;
  /** Static tour product slug (matches `tour_product_full_page` / registry). */
  tourProductSlug: string;
  /** Other tours to surface in the "You might also like" section at page foot. */
  recommendations?: readonly StaticTourProductRegistration[];
};

/**
 * Generic small-group tour detail page — East template layout, driven entirely
 * by the view-model built from `tour_product_full_page_v1` JSON (or Supabase).
 *
 * New slugs should route through this component via the catch-all
 * `app/tour-product/[slug]/page.tsx`; existing East / Jeju pages continue to
 * render through their slug-specific clients until migrated.
 */
export function TourProductDetailClient({ viewModel, checkout, tourProductSlug, recommendations }: TourProductDetailClientProps) {
  const vm = viewModel;
  const t = useTranslations();
  const hasRouteVariants = Array.isArray(vm.routeVariants) && vm.routeVariants.length > 0;
  const [selectedPortIndex, setSelectedPortIndex] = useState(0);
  const selectedPortLabel = hasRouteVariants
    ? vm.routeVariants?.[Math.min(selectedPortIndex, (vm.routeVariants?.length ?? 1) - 1)]?.title
    : undefined;
  const productTitle = `${vm.headlineLine1} ${vm.headlineLine2}`.replace(/\s+/g, " ").trim();
  const supportQuickChips = useMemo(() => pickAssistantQuickChipsFromViewModel(vm, 4), [vm]);
  return (
    <div className="tour-product-v2-static-root min-h-screen bg-white">
      <div className="lg:mx-auto lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:px-6">
        <main className="lg:min-w-0 pb-6">
          <TourHeroSection
            headlineLine1={vm.headlineLine1}
            headlineLine2={vm.headlineLine2}
            hero={vm.hero}
            tourProductSlug={tourProductSlug}
          />

          {/* Trust strip — converts on first scroll without overloading the hero */}
          <div className="border-b border-border/60 bg-white">
            <div className="mx-auto max-w-2xl px-4 sm:px-5 py-2.5 lg:max-w-2xl">
              <div className="flex items-center gap-x-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
                <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" strokeWidth={2} />
                  {t("tour.freeCancellation")}
                </span>
                <span aria-hidden className="h-3 w-px flex-shrink-0 bg-border" />
                <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-foreground">
                  <Zap className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" strokeWidth={2} />
                  {t("tour.instantConfirmation")}
                </span>
                <span aria-hidden className="h-3 w-px flex-shrink-0 bg-border" />
                <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-foreground">
                  <Headphones className="h-3.5 w-3.5 flex-shrink-0 text-primary" strokeWidth={2} />
                  {t("tour.customerSupport")}
                </span>
              </div>
            </div>
          </div>

          <TourTabsNav subnavItems={vm.subnavItems} />

        <section id="overview" className="mx-3 mt-6 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-8">
            <TourAtAGlance glanceItems={vm.glanceItems} sectionUi={vm.sectionUi} />
          </div>
        </section>

        <section className="mx-3 mt-6 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-6">
            <TourAtmosphereGallery galleryItems={vm.galleryItems} sectionUi={vm.sectionUi} />
          </div>
        </section>

        <section
          id="itinerary"
          className="mx-3 mt-6 lg:mx-0"
        >
          <div className="mx-auto max-w-2xl px-4 sm:px-5 pt-10 pb-4 space-y-9">
            <TourDayFlowSection
              routeFlowStops={vm.routeFlowStops}
              routePhases={vm.routePhases}
              routeShapeIntro={vm.routeShapeIntro}
              sectionUi={vm.sectionUi}
              itineraryStops={vm.itineraryStops}
            />
          </div>
          <div className="mx-auto max-w-2xl px-4 sm:px-5 pt-2 pb-6">
            <TourTimelineSection
              itineraryStops={vm.itineraryStops}
              sectionUi={vm.sectionUi}
              pickup_dropoff={vm.pickup_dropoff}
              routeVariants={vm.routeVariants}
              selectedPortIndex={selectedPortIndex}
              onPortChange={setSelectedPortIndex}
            />
          </div>
        </section>

        {vm.pickup_dropoff ? (
          <section id="pickup-dropoff" className="mx-3 mt-6 lg:mx-0">
            <div className="mx-auto max-w-2xl px-4 sm:px-5 py-6">
              <TourPickupDropoffSection
                pickup_dropoff={vm.pickup_dropoff}
                sectionUi={vm.sectionUi}
              />
            </div>
          </section>
        ) : null}

        <section id="details" className="mx-3 mt-6 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-6">
            <TourFitSection whyTourWorks={vm.whyTourWorks} sectionUi={vm.sectionUi} />
          </div>
        </section>

        <section className="mx-3 mt-6 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-6">
            <TourPracticalDetails
              practicalAccordionItems={vm.practicalAccordionItems}
              practicalWeatherStatic={vm.practicalWeatherStatic}
              seasonalVariations={vm.seasonalVariations}
              sectionUi={vm.sectionUi}
            />
          </div>
        </section>

        <section className="mx-3 mt-6 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-6">
            <TourBookingSupportSection
              bookingTrustItems={vm.bookingTrustItems}
              bookingSupportSteps={vm.bookingSupportSteps}
              sectionUi={vm.sectionUi}
            />
          </div>
        </section>

        <section id="faq" className="mx-3 mt-6 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-6">
            <TourFaqSection staticQuestions={vm.staticQuestions} sectionUi={vm.sectionUi} />
          </div>
        </section>

        <section id="reviews" className="mx-3 mt-6 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-6">
            <TourReviewsSection
              guestReviews={vm.guestReviews}
              reviewsSummary={vm.reviewsSummary}
              sectionUi={vm.sectionUi}
            />
          </div>
        </section>

        {recommendations && recommendations.length > 0 ? (
          <section className="mx-3 mt-6 lg:mx-0">
            <div className="mx-auto max-w-2xl px-4 sm:px-5 py-6">
              <TourRecommendationsSection recommendations={recommendations} sectionUi={vm.sectionUi} />
            </div>
          </section>
        ) : null}

        </main>

        {/* Desktop right-rail booking card — sticks under the global header */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 py-8">
            <TourDesktopBookingCard
              price={vm.price}
              checkout={checkout}
              selectedPortLabel={selectedPortLabel}
              sectionUi={vm.sectionUi}
            />
          </div>
        </aside>
      </div>

      {/* Mobile sticky CTA — hidden on lg+ where the right-rail card takes over */}
      <div className="lg:hidden">
        <TourStickyBookingBar
          price={vm.price}
          checkout={checkout}
          selectedPortLabel={selectedPortLabel}
          sectionUi={vm.sectionUi}
        />
      </div>

      <TourProductAiAssistantWidget
        tourProductSlug={tourProductSlug}
        productTitle={productTitle}
        supportQuickChips={supportQuickChips}
      />
    </div>
  );
}
