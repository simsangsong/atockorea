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
import { TourRatesSheet } from "@/components/product-tour-static/_shared/TourRatesSheet";
import { SegmentedToggle } from "@/components/product-tour-static/_shared/SegmentedToggle";
import { parseListUnitUsd } from "@/components/product-tour-static/_shared/bookingShared";
import { useCurrencyOptional } from "@/lib/currency";
import type { StaticTourProductRegistration } from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import dynamic from "next/dynamic";

/**
 * T4 — the AI assistant widget is interaction-only chrome (floating chat
 * button + drawer, no SEO content): load its chunk lazily with ssr:false so
 * its SSE/localStorage/chat logic stays out of the initial bundle and
 * hydration pass. It is position-fixed, so the deferred mount causes no CLS.
 */
const TourProductAiAssistantWidget = dynamic(
  () =>
    import("@/components/product-tour-static/_shared/TourProductAiAssistantWidget").then(
      (m) => m.TourProductAiAssistantWidget,
    ),
  { ssr: false, loading: () => null },
);
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
import { trackEvent } from "@/src/design/analytics";

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
  // W2.4 — Standard|Sample itinerary view (charter products only).
  const [itineraryView, setItineraryView] = useState<"standard" | "sample">("standard");
  // W2.6 — reviews cold-start: zero reviews hides the section + Reviews tab
  // together, except when the write deep link (#reviews-write / ?write=1)
  // brings a guest here to leave the first review.
  const hasGuestReviews =
    (vm.reviewsSummary?.totalReviews ?? 0) > 0 && (vm.guestReviews?.length ?? 0) > 0;
  const [writeDeepLink, setWriteDeepLink] = useState(false);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (window.location.hash === "#reviews-write" || sp.get("write") === "1") {
      setWriteDeepLink(true);
    }
  }, []);
  const showReviewsSection = hasGuestReviews || writeDeepLink;
  const subnavItems = hasGuestReviews
    ? vm.subnavItems
    : vm.subnavItems.filter((item) => item.id !== "reviews");
  // W1.4 — single rate-card sheet (§F-8 grammar ②). Fixed price entry points:
  // sticky bar / booking card / the At-a-Glance button below (surface rule §B).
  const [ratesSheetOpen, setRatesSheetOpen] = useState(false);
  const hasRatesSheet = Boolean(vm.pricingTiers && vm.pricingTiers.tiers.length > 0);
  const currencyCtx = useCurrencyOptional();
  const fromPriceLabel = useMemo(() => {
    // Tiered products anchor "From" on the matrix minimum so all three fixed
    // price entry points quote the same floor as the booking surfaces.
    let usd: number | null = null;
    if (vm.pricingTiers && vm.pricingTiers.tiers.length > 0) {
      for (const tier of vm.pricingTiers.tiers) {
        for (const d of vm.pricingTiers.durations) {
          const v = tier.prices[d];
          if (typeof v === "number" && v > 0 && (usd == null || v < usd)) usd = v;
        }
      }
    }
    if (usd == null) usd = parseListUnitUsd(vm.price);
    if (usd == null || usd <= 0) return null;
    if (currencyCtx) return currencyCtx.formatPrice(usd);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(usd);
  }, [vm.price, vm.pricingTiers, currencyCtx]);
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

          {/* W2.1 — trust strip absorbed into a hero microline (§I #1): the old
              bordered standalone section is gone; one unboxed deep-tone line
              rides directly under the hero. Booking surfaces keep their own
              single reassurance line (§F-1: trust copy appears exactly twice). */}
          <div className="mx-auto max-w-2xl px-4 pb-1 pt-2 sm:px-5">
            <div className="flex items-center gap-x-3.5 overflow-x-auto whitespace-nowrap scrollbar-hide">
              <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" strokeWidth={2.25} />
                {t("tour.freeCancellation")}
              </span>
              <span aria-hidden className="h-1 w-1 flex-shrink-0 rounded-full bg-slate-300" />
              <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-800">
                <Zap className="h-3.5 w-3.5 flex-shrink-0 text-amber-600" strokeWidth={2.25} />
                {t("tour.instantConfirmation")}
              </span>
              <span aria-hidden className="h-1 w-1 flex-shrink-0 rounded-full bg-slate-300" />
              <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-sky-900">
                <Headphones className="h-3.5 w-3.5 flex-shrink-0 text-primary" strokeWidth={2.25} />
                {t("tour.customerSupport")}
              </span>
            </div>
          </div>

          <TourTabsNav subnavItems={subnavItems} />

        <section id="overview" className="mx-3 mt-5 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 py-6">
            <TourAtAGlance glanceItems={vm.glanceItems} sectionUi={vm.sectionUi} />
            {hasRatesSheet ? (
              <button
                type="button"
                onClick={() => {
                  setRatesSheetOpen(true);
                  trackEvent("pd_rates_sheet_open", { slug: tourProductSlug, source: "at_a_glance" });
                }}
                className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)] transition hover:border-slate-300"
              >
                <span className="text-[13.5px] font-semibold tabular-nums text-foreground">
                  {fromPriceLabel
                    ? (vm.sectionUi.ratesFromTemplate ?? "From {price}").replace("{price}", fromPriceLabel)
                    : (vm.sectionUi.ratesSheetTitle ?? "Rate card")}
                </span>
                <span className="text-[12px] font-medium text-muted-foreground">
                  {vm.sectionUi.ratesViewFullLabel ?? "View full rate card"} ›
                </span>
              </button>
            ) : null}
          </div>
        </section>

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
          className="mx-3 mt-4 scroll-mt-24 lg:mx-0"
        >
          {/* W2.4 — charter products switch Standard|Sample inside the
              itinerary section via THE shared segmented toggle (§F-8 ③).
              Both views stay mounted (hidden attr) so the locale copy
              survives the DOM round-trip check. The `sample-itinerary` id
              keeps old deep links landing here (W2.7 anchor compat). */}
          {privateSampleItinerary ? (
            <div id="sample-itinerary" className="mx-auto max-w-2xl scroll-mt-24 px-4 pt-6 sm:px-5">
              <SegmentedToggle
                ariaLabel="Itinerary view"
                value={itineraryView}
                onChange={setItineraryView}
                options={[
                  { value: "standard", label: vm.sectionUi.itineraryStandardLabel ?? "Standard route" },
                  { value: "sample", label: vm.sectionUi.itinerarySampleLabel ?? "Sample itineraries" },
                ]}
              />
            </div>
          ) : null}
          <div hidden={itineraryView !== "standard"}>
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
          </div>
          {privateSampleItinerary ? (
            <div hidden={itineraryView !== "sample"} className="mx-auto max-w-2xl px-4 sm:px-5 pt-4 pb-4">
              <TourPrivateSampleItinerarySection
                config={privateSampleItinerary}
                locale={locale}
              />
            </div>
          ) : null}
        </section>

        {vm.pickup_dropoff ? (
          <section id="pickup-dropoff" className="mx-3 mt-4 scroll-mt-24 lg:mx-0">
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

        {/* W2.5 — FAQ & After-you-book merged section: slim support stepline
            (+ W4.4 operated-by trust card) rides above the FAQ list. */}
        <section id="faq" className="mx-3 mt-4 scroll-mt-24 lg:mx-0">
          <div className="mx-auto max-w-2xl px-4 sm:px-5 pt-5 pb-2">
            <TourBookingSupportSection
              bookingTrustItems={vm.bookingTrustItems}
              bookingSupportSteps={vm.bookingSupportSteps}
              sectionUi={vm.sectionUi}
            />
          </div>
          <div className="mx-auto max-w-2xl px-4 sm:px-5 pt-3 pb-5">
            <TourFaqSection staticQuestions={vm.staticQuestions} sectionUi={vm.sectionUi} />
          </div>
        </section>

        {/* W2.6 — with zero reviews the section AND the Reviews tab are hidden
            together; the `#reviews-write` / `?write=1` deep link (review
            collection loop, W4.3) still renders the write-review block so the
            cold-start path never dead-ends. */}
        {showReviewsSection ? (
          <section id="reviews" className="mx-3 mt-4 scroll-mt-24 lg:mx-0">
            <div className="mx-auto max-w-2xl px-4 sm:px-5 py-5">
              <TourReviewsSection
                guestReviews={vm.guestReviews}
                reviewsSummary={vm.reviewsSummary}
                sectionUi={vm.sectionUi}
              />
            </div>
          </section>
        ) : null}

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
              onOpenRatesSheet={
                hasRatesSheet
                  ? () => {
                      setRatesSheetOpen(true);
                      trackEvent("pd_rates_sheet_open", { slug: tourProductSlug, source: "booking_card" });
                    }
                  : undefined
              }
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

      {hasRatesSheet && vm.pricingTiers ? (
        <TourRatesSheet
          open={ratesSheetOpen}
          onClose={() => setRatesSheetOpen(false)}
          pricingTiers={vm.pricingTiers}
          sectionUi={vm.sectionUi}
        />
      ) : null}

      <TourProductAiAssistantWidget
        tourProductSlug={tourProductSlug}
        productTitle={productTitle}
        supportQuickChips={supportQuickChips}
      />
    </div>
  );
}
