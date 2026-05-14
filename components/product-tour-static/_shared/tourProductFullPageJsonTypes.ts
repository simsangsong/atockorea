/**
 * Authoring-side shape for `tour_product_full_page_v1` JSON bundles.
 *
 * The East template is the reference layout; all new small-group tours reuse
 * the same 11-section view-model by authoring a JSON per locale with this
 * shape. Fields unused by the template (e.g. `seo`, `page_sections`) are kept
 * optional/loose so legacy authoring artifacts continue to validate.
 */

import type { EastSignatureNatureCoreDetailViewModel } from "@/components/product-tour-static/east-signature-nature-core/eastSignatureNatureCoreDetailViewModel";

/**
 * Keys consumed by the shared `TourProductDetailClient`.
 * Keep in sync with `EastSignatureNatureCoreDetailViewModel` — this list is
 * what `buildTourProductViewModelFromFullPageJson()` copies through.
 */
export const TOUR_PRODUCT_VIEW_MODEL_KEYS = [
  "headlineLine1",
  "headlineLine2",
  "hero",
  "price",
  "subnavItems",
  "glanceItems",
  "galleryItems",
  "itineraryStops",
  "routeFlowStops",
  "routePhases",
  "routeShapeIntro",
  "whyTourWorks",
  "practicalAccordionItems",
  "practicalWeatherStatic",
  "seasonalVariations",
  "bookingTrustItems",
  "bookingSupportSteps",
  "staticQuestions",
  "guestReviews",
  "reviewsSummary",
  /** Optional — bus tours carry `pickup_dropoff` with fixed meeting/return points. */
  "pickup_dropoff",
  /** Optional — cruise shore-excursion tours carry per-docking-port itineraries. */
  "routeVariants",
  /** Optional — private/charter tours with pax × duration pricing matrix. */
  "pricingTiers",
  /** Optional — opt-in section rendered above the itinerary for tours with a
   *  live external status feed (currently only `"haenyeo"` for Jeju east tours
   *  that include the haenyeo-show stop). */
  "liveStatusSection",
] as const;

export type TourProductViewModelKey = (typeof TOUR_PRODUCT_VIEW_MODEL_KEYS)[number];

/** Partial shape — authoring JSON may carry extra keys (catalog_card, seo, matching_profile, page_sections). */
export type TourProductFullPageJson = Partial<EastSignatureNatureCoreDetailViewModel> & {
  locale?: string;
  sectionUi?: unknown;
  [extra: string]: unknown;
};

/** Alias — the rendering view-model contract is identical to East's. */
export type TourProductDetailViewModel = EastSignatureNatureCoreDetailViewModel;
