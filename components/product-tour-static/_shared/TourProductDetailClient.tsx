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
    <div className="tour-product-v2-static-root min-h-screen bg-background">
      <div className="lg:mx-auto lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:px-6">
        <main className="lg:min-w-0">
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

        <section id="overview" className="bg-warm-ivory">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-10">
            <TourAtAGlance glanceItems={vm.glanceItems} sectionUi={vm.sectionUi} />
          </div>
        </section>

        <section className="bg-soft-pearl">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-6">
            <TourAtmosphereGallery galleryItems={vm.galleryItems} sectionUi={vm.sectionUi} />
          </div>
        </section>

        <section
          id="itinerary"
          className="relative overflow-hidden"
          style={{
            background: [
              // Organic flowing blobs — varied sizes (small/medium/large), varied aspect ratios (tall/wide/round),
              // scattered irregularly. No stripes. Saturation reduced ~30% (alpha × 0.7) from previous step.

              // ===== YEONDU (chartreuse) — varied scales =====
              // large flowing blob
              "radial-gradient(ellipse 36% 22% at 18% 12%, rgba(178, 215, 110, 0.095) 0%, rgba(178, 215, 110, 0.030) 38%, transparent 68%)",
              // tall organic shape
              "radial-gradient(ellipse 12% 28% at 62% 30%, rgba(180, 218, 115, 0.090) 0%, rgba(180, 218, 115, 0.028) 40%, transparent 70%)",
              // small accent
              "radial-gradient(ellipse 9% 7% at 88% 18%, rgba(172, 210, 100, 0.083) 0%, rgba(172, 210, 100, 0.028) 36%, transparent 65%)",
              // medium round-ish
              "radial-gradient(ellipse 24% 18% at 38% 62%, rgba(184, 220, 118, 0.084) 0%, rgba(184, 220, 118, 0.030) 40%, transparent 70%)",
              // wide soft ribbon
              "radial-gradient(ellipse 30% 11% at 76% 78%, rgba(176, 214, 108, 0.080) 0%, rgba(176, 214, 108, 0.028) 42%, transparent 72%)",
              // tiny dot
              "radial-gradient(ellipse 7% 9% at 12% 78%, rgba(178, 216, 112, 0.084) 0%, rgba(178, 216, 112, 0.028) 35%, transparent 65%)",

              // ===== FRESH GREEN — varied scales =====
              // large drifting blob (top)
              "radial-gradient(ellipse 32% 18% at 50% 6%, rgba(140, 205, 135, 0.095) 0%, rgba(140, 205, 135, 0.030) 38%, transparent 68%)",
              // medium oval
              "radial-gradient(ellipse 22% 26% at 8% 44%, rgba(146, 208, 138, 0.090) 0%, rgba(146, 208, 138, 0.030) 40%, transparent 70%)",
              // small irregular
              "radial-gradient(ellipse 11% 8% at 56% 48%, rgba(152, 210, 144, 0.090) 0%, rgba(152, 210, 144, 0.028) 38%, transparent 68%)",
              // wide low ribbon
              "radial-gradient(ellipse 28% 13% at 90% 56%, rgba(138, 204, 132, 0.084) 0%, rgba(138, 204, 132, 0.028) 40%, transparent 72%)",
              // tall narrow
              "radial-gradient(ellipse 10% 24% at 22% 92%, rgba(150, 210, 142, 0.084) 0%, rgba(150, 210, 142, 0.028) 40%, transparent 70%)",
              // medium roundish
              "radial-gradient(ellipse 18% 20% at 70% 14%, rgba(144, 207, 136, 0.084) 0%, rgba(144, 207, 136, 0.028) 38%, transparent 70%)",

              // ===== MINT (cooler accent) — small/varied =====
              "radial-gradient(ellipse 26% 9% at 30% 28%, rgba(125, 210, 175, 0.078) 0%, rgba(125, 210, 175, 0.024) 42%, transparent 72%)",
              "radial-gradient(ellipse 8% 14% at 84% 64%, rgba(130, 212, 178, 0.078) 0%, rgba(130, 212, 178, 0.024) 38%, transparent 68%)",
              "radial-gradient(ellipse 16% 10% at 50% 84%, rgba(128, 212, 176, 0.072) 0%, rgba(128, 212, 176, 0.024) 40%, transparent 70%)",

              // ===== ORANGE accents — small irregular =====
              "radial-gradient(ellipse 8% 12% at 16% 56%, rgba(255, 150, 70, 0.095) 0%, rgba(255, 150, 70, 0.030) 36%, transparent 62%)",
              "radial-gradient(ellipse 11% 7% at 80% 90%, rgba(255, 158, 80, 0.090) 0%, rgba(255, 158, 80, 0.030) 36%, transparent 62%)",
              "radial-gradient(ellipse 6% 9% at 66% 6%, rgba(255, 145, 65, 0.084) 0%, rgba(255, 145, 65, 0.028) 36%, transparent 62%)",
              "radial-gradient(ellipse 14% 8% at 4% 26%, rgba(255, 152, 72, 0.078) 0%, rgba(255, 152, 72, 0.026) 38%, transparent 65%)",

              // pure-white base
              "linear-gradient(180deg, #ffffff 0%, #ffffff 100%)",
            ].join(", "),
          }}
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
          <div className="mx-auto max-w-2xl px-4 sm:px-5 pt-2 pb-7">
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
          <section id="pickup-dropoff" className="bg-warm-ivory">
            <div className="mx-auto max-w-2xl px-4 sm:px-5 py-7">
              <TourPickupDropoffSection
                pickup_dropoff={vm.pickup_dropoff}
                sectionUi={vm.sectionUi}
                regionLabel={vm.hero?.meta?.region}
              />
            </div>
          </section>
        ) : null}

        <section id="details" className="bg-sand-blush">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-7">
            <TourFitSection whyTourWorks={vm.whyTourWorks} sectionUi={vm.sectionUi} />
          </div>
        </section>

        <section className="bg-soft-pearl">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-7">
            <TourPracticalDetails
              practicalAccordionItems={vm.practicalAccordionItems}
              practicalWeatherStatic={vm.practicalWeatherStatic}
              seasonalVariations={vm.seasonalVariations}
              sectionUi={vm.sectionUi}
            />
          </div>
        </section>

        <section className="bg-mist-blue">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-7">
            <TourBookingSupportSection
              bookingTrustItems={vm.bookingTrustItems}
              bookingSupportSteps={vm.bookingSupportSteps}
              sectionUi={vm.sectionUi}
            />
          </div>
        </section>

        <section id="faq" className="bg-warm-ivory">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-7">
            <TourFaqSection staticQuestions={vm.staticQuestions} sectionUi={vm.sectionUi} />
          </div>
        </section>

        <section id="reviews" className="bg-cloud-gray">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-7">
            <TourReviewsSection
              guestReviews={vm.guestReviews}
              reviewsSummary={vm.reviewsSummary}
              sectionUi={vm.sectionUi}
            />
          </div>
        </section>

        {recommendations && recommendations.length > 0 ? (
          <section className="bg-warm-ivory">
            <div className="mx-auto max-w-2xl px-4 sm:px-5 py-7">
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
