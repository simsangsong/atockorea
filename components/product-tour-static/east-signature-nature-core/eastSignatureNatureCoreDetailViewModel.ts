/**
 * 정적 상세 1페이지에 주입할 단일 뷰모델.
 * 이후 서버/클라이언트에서 동일 형태로 치환하기 쉽게 유지.
 */

import { eastSignatureNatureCoreProduct } from "./staticProductData";
import { DEFAULT_TOUR_PRODUCT_SECTION_UI_EN } from "@/lib/tour-product/tourProductSectionUi";
import type { PickupDropoffSection } from "@/components/product-tour-static/_shared/pickupDropoffTypes";
import type { PortRouteVariant } from "@/components/product-tour-static/_shared/route-variants/routeVariantTypes";
import {
  bookingSupportSteps,
  bookingTrustItems,
  glanceItems,
  galleryItems,
  guestReviews,
  itineraryStops,
  practicalAccordionItems,
  practicalWeatherStatic,
  reviewsSummary,
  routeFlowStops,
  routePhases,
  routeShapeIntro,
  seasonalVariations,
  staticQuestions,
  subnavItems,
  whyTourWorks,
} from "./staticProductData";

export const eastSignatureNatureCoreDetailViewModel = {
  headlineLine1: "East Jeju Volcano, Coast",
  headlineLine2: "and Folk Village Small Group Day Tour",
  hero: eastSignatureNatureCoreProduct.hero,
  price: eastSignatureNatureCoreProduct.price,
  subnavItems: subnavItems.map((i) => ({ id: i.id, label: i.label })),
  glanceItems,
  galleryItems,
  itineraryStops,
  routeFlowStops,
  routePhases,
  routeShapeIntro,
  whyTourWorks,
  practicalAccordionItems,
  practicalWeatherStatic,
  seasonalVariations,
  bookingTrustItems,
  bookingSupportSteps,
  staticQuestions,
  guestReviews,
  reviewsSummary,
  sectionUi: DEFAULT_TOUR_PRODUCT_SECTION_UI_EN,
};

/**
 * Reference SKU shape. `pickup_dropoff` is optional — East Signature omits
 * it; bus-tour bundles (e.g. `south-jeju-classic-bus-tour`) populate it to
 * opt into the timeline's pickup/drop-off cards.
 */
export type EastSignatureNatureCoreDetailViewModel = typeof eastSignatureNatureCoreDetailViewModel & {
  pickup_dropoff?: PickupDropoffSection;
  /**
   * Optional — cruise shore-excursion products render a port toggle and swap
   * the stops list based on the selected docking port. Absent on standard bus
   * / small-group tours, which stick to the flat `itineraryStops`.
   */
  routeVariants?: readonly PortRouteVariant[];
};
