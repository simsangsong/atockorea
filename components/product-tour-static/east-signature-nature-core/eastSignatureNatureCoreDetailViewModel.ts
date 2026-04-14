/**
 * 정적 상세 1페이지에 주입할 단일 뷰모델.
 * 이후 서버/클라이언트에서 동일 형태로 치환하기 쉽게 유지.
 */

import { eastSignatureNatureCoreProduct } from "./staticProductData";
import { DEFAULT_TOUR_PRODUCT_SECTION_UI_EN } from "@/lib/tour-product/tourProductSectionUi";
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
  headlineLine1: "Jeju East Volcano, Coast & Village",
  headlineLine2: "Small Group Tour",
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

export type EastSignatureNatureCoreDetailViewModel = typeof eastSignatureNatureCoreDetailViewModel;
