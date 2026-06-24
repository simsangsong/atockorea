/**
 * View-model contract shared by every tour-product detail page.
 *
 * v17 batch decoupled this from the legacy `staticProductData` runtime literal.
 * The shape now lives explicitly in
 * `_shared/tourProductDetailSectionTypes.ts`; this file just composes those
 * field types into the section-component contract used by 16+ consumers.
 *
 * Historical name kept so existing imports don't have to be renamed in
 * lock-step.
 */

import type { PickupDropoffSection } from "@/components/product-tour-static/_shared/pickupDropoffTypes";
import type { PortRouteVariant } from "@/components/product-tour-static/_shared/route-variants/routeVariantTypes";
import type {
  BookingSupportStep,
  BookingTrustItem,
  GalleryMediaItem,
  GlanceItem,
  GuestReview,
  ItineraryStop,
  PracticalAccordionItem,
  PracticalWeatherStatic,
  ReviewsSummary,
  RouteFlowStop,
  RoutePhase,
  RouteShapeIntro,
  SampleItinerarySection,
  SeasonalVariation,
  StaticQuestion,
  SubnavItem,
  TourProductHero,
  TourProductPrice,
  TourProductPricingTiers,
  WhyTourWorks,
} from "@/components/product-tour-static/_shared/tourProductDetailSectionTypes";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";

export type EastSignatureNatureCoreDetailViewModel = {
  headlineLine1: string;
  headlineLine2: string;
  hero: TourProductHero;
  price: TourProductPrice;
  subnavItems: readonly SubnavItem[];
  glanceItems: readonly GlanceItem[];
  galleryItems: readonly GalleryMediaItem[];
  itineraryStops: readonly ItineraryStop[];
  routeFlowStops: readonly RouteFlowStop[];
  routePhases: readonly RoutePhase[];
  routeShapeIntro: RouteShapeIntro;
  whyTourWorks: WhyTourWorks;
  practicalAccordionItems: readonly PracticalAccordionItem[];
  practicalWeatherStatic: PracticalWeatherStatic;
  seasonalVariations: readonly SeasonalVariation[];
  bookingTrustItems: readonly BookingTrustItem[];
  bookingSupportSteps: readonly BookingSupportStep[];
  staticQuestions: readonly StaticQuestion[];
  /** Runtime always populates these (empty array / zero summary) — never null at the view-model layer. */
  guestReviews: readonly GuestReview[];
  reviewsSummary: ReviewsSummary;
  sectionUi: TourProductSectionUiV1;
  pickup_dropoff?: PickupDropoffSection;
  /** Optional — cruise shore-excursion products toggle stops by docking port. */
  routeVariants?: readonly PortRouteVariant[];
  /** Optional — private/charter products with per-vehicle pricing that varies by pax + duration. */
  pricingTiers?: TourProductPricingTiers;
  /**
   * Optional — private/charter products surface *sample* day plans instead of a
   * fixed route-flow + numbered timeline. When present, the orchestrator swaps
   * DayFlow + Timeline for the sample-itinerary section and skips the route/AI
   * recommend logic (pickup/drop-off default to the guest's hotel).
   */
  sampleItineraries?: SampleItinerarySection;
};
