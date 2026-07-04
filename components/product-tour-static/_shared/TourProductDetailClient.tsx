"use client";
import { useEffect, useMemo, useState } from "react";
import { Headphones, ShieldCheck, Zap } from "lucide-react";

import type { TourProductDetailViewModel } from "./tourProductFullPageJsonTypes";
import type { TourProductCheckoutContext } from "@/lib/tour-product/eastSignatureCheckoutContext";
import type { PreferredLanguage } from "@/components/product-tour-static/_shared/bookingShared";
import {
  TourAtAGlance,
  TourAtmosphereGallery,
  TourBookingSupportSection,
  TourDayFlowSection,
  TourDesktopBookingCard,
  TourFaqSection,
  TourFitSection,
  TourHeroSection,
  TourIncludedSection,
  TourPickupDropoffSection,
  TourPracticalDetails,
  TourPrivateSampleItinerarySection,
  TourRecommendationsSection,
  TourReviewsSection,
  TourStickyBookingBar,
  TourTabsNav,
  TourTimelineSection,
} from "@/components/product-tour-static/east-signature-nature-core/tour-detail-sections";
import { getPrivateSampleItineraryConfig } from "@/components/product-tour-static/_shared/privateSampleItinerary";
import type { StaticTourProductRegistration } from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import { TourProductAiAssistantWidget } from "@/components/product-tour-static/_shared/TourProductAiAssistantWidget";
import { HaenyeoStatusButton } from "@/components/product-tour-static/_shared/HaenyeoStatusButton";
import { PlatformCompareBlock } from "@/components/tour/PlatformCompareBlock";
import { getTourCompareLinks } from "@/lib/tour/platform-compare-registry";
import { TourExternalReviewsSection } from "@/components/product-tour-static/_shared/TourExternalReviewsSection";
import type { ExternalReviewAggregate } from "@/lib/tour-product/externalReviews";
import { pickAssistantQuickChipsFromViewModel } from "@/lib/tour-product/assistantQuickChips";
import {
  coerceSeedDateYmd,
  coerceSeedGuests,
  coerceSeedLanguage,
} from "@/components/product-tour-static/_shared/bookingSeedParams";
import { useTranslations } from "@/lib/i18n";

/**
 * Platform price-compare widget hidden per user direction 2026-05-20 — the site
 * no longer surfaces named OTA platforms (Klook/GYG/Viator) anywhere. Flip back
 * to `true` to restore the comparison strategy (registry + component intact).
 */
const SHOW_PLATFORM_COMPARE = false;

/**
 * Third-party OTA review aggregates (TripAdvisor/Viator/GYG/Klook) hidden for the
 * Klook onboarding 2026-06-29 — the storefront surfaces no named OTA platforms
 * during listing review. Flip back to `true` to restore (data + component intact).
 */
const SHOW_EXTERNAL_REVIEWS = false;

/**
 * Per-tour outbound Viator listing — renders a "View on Viator" button in the
 * overview section. Tours absent from this map render nothing.
 */
const VIATOR_LISTING_URL_BY_SLUG: Record<string, string> = {
  "jeju-island-private-car-charter-tour":
    "https://www.viator.com/tours/Jeju-Island/Jeju-Eastern-UNESCO-Day-Tour-Explore-Beaches-and-Heritage/d50286-5664240P2",
};

export type TourProductDetailClientProps = {
  viewModel: TourProductDetailViewModel;
  checkout?: TourProductCheckoutContext | null;
  /** Static tour product slug (matches `tour_product_full_page` / registry). */
  tourProductSlug: string;
  /** Other tours to surface in the "You might also like" section at page foot. */
  recommendations?: readonly StaticTourProductRegistration[];
  /** Active locale — propagated to client widgets (e.g. HaenyeoStatusButton). */
  locale?: "en" | "ko" | "ja" | "zh" | "zh-TW" | "es";
  /**
   * U9 carry-through — group size seeded from the upstream `?party=` query param
   * (home stepper → /tours/list → detail). Forwarded to the booking cards so the
   * visitor is not re-asked for a party size they already chose.
   */
  initialGuests?: number;
  /**
   * Deep-link seeding (AI agents / shared links) — `?date=` and `?language=`
   * pre-fill the booking cards so a constructed URL lands the traveller ready to
   * confirm. Validated upstream in the page; absent → cards keep their defaults.
   */
  seedDateYmd?: string;
  seedLanguage?: PreferredLanguage;
  /**
   * Third-party platform review aggregates (TripAdvisor / Viator / GetYourGuide
   * / Klook) for this tour — rating + count + outbound link, attributed to the
   * source. Empty/absent → the external-reviews block renders nothing.
   */
  externalReviews?: readonly ExternalReviewAggregate[];
};

/**
 * Generic small-group tour detail page — East template layout, driven entirely
 * by the view-model built from `tour_product_full_page_v1` JSON (or Supabase).
 *
 * New slugs should route through this component via the catch-all
 * `app/tour-product/[slug]/page.tsx`; existing East / Jeju pages continue to
 * render through their slug-specific clients until migrated.
 */
export function TourProductDetailClient({ viewModel, checkout, tourProductSlug, recommendations, locale = "en", initialGuests, seedDateYmd, seedLanguage, externalReviews }: TourProductDetailClientProps) {
  const vm = viewModel;
  const t = useTranslations();
  const hasRouteVariants = Array.isArray(vm.routeVariants) && vm.routeVariants.length > 0;
  const [selectedPortIndex, setSelectedPortIndex] = useState(0);
  const selectedPortLabel = hasRouteVariants
    ? vm.routeVariants?.[Math.min(selectedPortIndex, (vm.routeVariants?.length ?? 1) - 1)]?.title
    : undefined;
  const productTitle = `${vm.headlineLine1} ${vm.headlineLine2}`.replace(/\s+/g, " ").trim();
  const supportQuickChips = useMemo(() => pickAssistantQuickChipsFromViewModel(vm, 4), [vm]);
  const hasPlatformCompareLinks = useMemo(
    () => getTourCompareLinks(tourProductSlug) !== null,
    [tourProductSlug],
  );
  // Private car-charter products surface a "Sample Itineraries" section (example
  // day plans + private-tour rules). Returns null for every other product.
  const privateSampleItinerary = useMemo(
    () => getPrivateSampleItineraryConfig(tourProductSlug),
    [tourProductSlug],
  );
  const viatorListingUrl = VIATOR_LISTING_URL_BY_SLUG[tourProductSlug];
  // T1 — deep-link seeds (`?party=&guests=&date=&language=`) are parsed HERE
  // instead of in the server page: reading `searchParams` server-side would opt
  // the route out of ISR (per-request SSR again). The server HTML renders the
  // cards with defaults; when a deep-link arrives, this effect fires right
  // after hydration and the `key` below remounts the cards with the seeded
  // initial state. Normal visits (no seed params) never remount. Server-passed
  // props still win when present (admin preview / legacy callers).
  const [urlSeeds, setUrlSeeds] = useState<{
    guests?: number;
    dateYmd?: string;
    language?: PreferredLanguage;
  } | null>(null);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const guests = coerceSeedGuests(sp.get("party") ?? sp.get("guests"));
    const dateYmd = coerceSeedDateYmd(sp.get("date"));
    const language = coerceSeedLanguage(sp.get("language") ?? sp.get("lang"));
    if (guests != null || dateYmd != null || language != null) {
      setUrlSeeds({ guests, dateYmd, language });
    }
  }, []);
  const effectiveGuests = initialGuests ?? urlSeeds?.guests;
  const effectiveSeedDateYmd = seedDateYmd ?? urlSeeds?.dateYmd;
  const effectiveSeedLanguage = seedLanguage ?? urlSeeds?.language;
  const bookingSeedKey = urlSeeds ? "url-seeded" : "default";
  return (
    <div className="tour-product-v2-static-root min-h-screen bg-white">
      <div className="lg:mx-auto lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:px-6">
        <main className="lg:min-w-0 pb-6">
          <TourHeroSection
            headlineLine1={vm.headlineLine1}
            headlineLine2={vm.headlineLine2}
            hero={vm.hero}
            tourProductSlug={tourProductSlug}
            viatorListingUrl={viatorListingUrl}
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

        <section id="overview" className="mx-3 mt-5 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-6">
            <TourAtAGlance glanceItems={vm.glanceItems} sectionUi={vm.sectionUi} />
          </div>
        </section>

        {vm.pricingTiers && vm.pricingTiers.tiers.length > 0 ? (
          <section id="pricing" className="mx-3 mt-4 lg:mx-0">
            <div className="mx-auto max-w-2xl px-4 sm:px-5 py-5">
              <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[var(--home-shadow-neutral-card)]">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="text-base font-bold tracking-tight text-foreground">Pricing</h3>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Per {vm.pricingTiers.unit}
                  </span>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200/70">
                  <table className="w-full text-[13px]">
                    <thead className="bg-slate-100/70 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Group size</th>
                        {vm.pricingTiers.durations.map((d) => (
                          <th key={d} className="px-3 py-2 text-right font-semibold">
                            {vm.pricingTiers!.durations.length === 1 ? "Price" : d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vm.pricingTiers.tiers.map((tr) => (
                        <tr key={tr.paxLabel} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-foreground">{tr.paxLabel}</td>
                          {vm.pricingTiers!.durations.map((d) => {
                            const v = tr.prices[d];
                            return (
                              <td key={d} className="px-3 py-2 text-right tabular-nums text-foreground">
                                {typeof v === "number" ? `$${v}` : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {vm.pricingTiers.extraPerPaxAbove ? (
                  <p className="mt-2 text-[11.5px] text-muted-foreground">
                    {vm.pricingTiers.extraPerPaxAbove.anchorPax + 1}+ pax: +${vm.pricingTiers.extraPerPaxAbove.perPaxAdd} per extra guest
                  </p>
                ) : null}
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  Tap &quot;Check Availability&quot; to pick guests and confirm the live total.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mx-3 mt-4 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-5">
            <TourAtmosphereGallery galleryItems={vm.galleryItems} sectionUi={vm.sectionUi} />
          </div>
        </section>

        {(vm as { liveStatusSection?: string }).liveStatusSection === "haenyeo" ? (
          <section id="haenyeo-status" className="mx-3 mt-4 lg:mx-0">
            <div className="mx-auto max-w-2xl px-4 sm:px-5 pt-2 pb-2">
              <HaenyeoStatusButton locale={locale} variant="section" autoFetch />
            </div>
          </section>
        ) : null}

        <section
          id="itinerary"
          className="mx-3 mt-4 lg:mx-0"
        >
          <div className="mx-auto max-w-2xl px-4 sm:px-5 pt-6 pb-3 space-y-7">
            <TourDayFlowSection
              routeFlowStops={vm.routeFlowStops}
              routePhases={vm.routePhases}
              routeShapeIntro={vm.routeShapeIntro}
              sectionUi={vm.sectionUi}
              itineraryStops={vm.itineraryStops}
            />
          </div>
          <div className="mx-auto max-w-2xl px-4 sm:px-5 pt-2 pb-4">
            <TourTimelineSection
              itineraryStops={vm.itineraryStops}
              sectionUi={vm.sectionUi}
              pickup_dropoff={vm.pickup_dropoff}
              routeVariants={vm.routeVariants}
              selectedPortIndex={selectedPortIndex}
              onPortChange={setSelectedPortIndex}
              locale={locale}
            />
          </div>
        </section>

        {privateSampleItinerary ? (
          <section id="sample-itinerary" className="mx-3 mt-4 lg:mx-0">
            <div className="mx-auto max-w-2xl px-4 sm:px-5 py-5">
              <TourPrivateSampleItinerarySection
                config={privateSampleItinerary}
                locale={locale}
              />
            </div>
          </section>
        ) : null}

        {vm.pickup_dropoff ? (
          <section id="pickup-dropoff" className="mx-3 mt-4 lg:mx-0">
            <div className="mx-auto max-w-2xl px-4 sm:px-5 py-5">
              <TourPickupDropoffSection
                pickup_dropoff={vm.pickup_dropoff}
                sectionUi={vm.sectionUi}
              />
            </div>
          </section>
        ) : null}

        <section id="included" className="mx-3 mt-4 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-5">
            <TourIncludedSection
              practicalAccordionItems={vm.practicalAccordionItems}
              sectionUi={vm.sectionUi}
            />
          </div>
        </section>

        <section id="details" className="mx-3 mt-4 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-5">
            <TourFitSection whyTourWorks={vm.whyTourWorks} sectionUi={vm.sectionUi} />
          </div>
        </section>

        <section className="mx-3 mt-4 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-5">
            <TourPracticalDetails
              practicalAccordionItems={vm.practicalAccordionItems}
              practicalWeatherStatic={vm.practicalWeatherStatic}
              seasonalVariations={vm.seasonalVariations}
              sectionUi={vm.sectionUi}
              tourProductSlug={tourProductSlug}
            />
          </div>
        </section>

        <section className="mx-3 mt-4 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-5">
            <TourBookingSupportSection
              bookingTrustItems={vm.bookingTrustItems}
              bookingSupportSteps={vm.bookingSupportSteps}
              sectionUi={vm.sectionUi}
            />
          </div>
        </section>

        <section id="faq" className="mx-3 mt-4 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-5">
            <TourFaqSection staticQuestions={vm.staticQuestions} sectionUi={vm.sectionUi} />
          </div>
        </section>

        <section id="reviews" className="mx-3 mt-4 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-5">
            <TourReviewsSection
              guestReviews={vm.guestReviews}
              reviewsSummary={vm.reviewsSummary}
              sectionUi={vm.sectionUi}
            />
          </div>
        </section>

        {/* Third-party platform review aggregates — same operator's listing on
            global OTAs, attributed + outbound-linked. Aggregate-only (no review
            prose copied, no competitor price). Renders nothing when unmapped. */}
        {SHOW_EXTERNAL_REVIEWS && externalReviews && externalReviews.length > 0 ? (
          <section id="external-reviews" className="mx-3 mt-4 lg:mx-0">
            <div className="mx-auto max-w-2xl px-4 sm:px-5 py-5">
              <TourExternalReviewsSection
                aggregates={externalReviews}
                tourProductSlug={tourProductSlug}
              />
            </div>
          </section>
        ) : null}

        {/* Price-compare widget — hidden 2026-05-20 (SHOW_PLATFORM_COMPARE=false).
            Previously: same tour on global OTA platforms, shown when the registry
            had verified links for this slug. */}
        {SHOW_PLATFORM_COMPARE && hasPlatformCompareLinks ? (
          <section className="mx-3 mt-4 lg:mx-0">
            <div className="mx-auto max-w-2xl px-4 sm:px-5 py-5">
              <PlatformCompareBlock tourProductSlug={tourProductSlug} />
            </div>
          </section>
        ) : null}

        {recommendations && recommendations.length > 0 ? (
          <section className="mx-3 mt-4 lg:mx-0">
            <div className="mx-auto max-w-2xl px-4 sm:px-5 py-5">
              <TourRecommendationsSection recommendations={recommendations} sectionUi={vm.sectionUi} />
            </div>
          </section>
        ) : null}

        </main>

        {/* Desktop right-rail booking card — sticks under the global header */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 py-8">
            <TourDesktopBookingCard
              key={bookingSeedKey}
              price={vm.price}
              checkout={checkout}
              selectedPortLabel={selectedPortLabel}
              sectionUi={vm.sectionUi}
              pricingTiers={vm.pricingTiers}
              initialGuests={effectiveGuests}
              seedDateYmd={effectiveSeedDateYmd}
              seedLanguage={effectiveSeedLanguage}
            />
          </div>
        </aside>
      </div>

      {/* Mobile sticky CTA — hidden on lg+ where the right-rail card takes over */}
      <div className="lg:hidden">
        <TourStickyBookingBar
          key={bookingSeedKey}
          price={vm.price}
          checkout={checkout}
          selectedPortLabel={selectedPortLabel}
          sectionUi={vm.sectionUi}
          pricingTiers={vm.pricingTiers}
          initialGuests={effectiveGuests}
          seedDateYmd={effectiveSeedDateYmd}
          seedLanguage={effectiveSeedLanguage}
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
