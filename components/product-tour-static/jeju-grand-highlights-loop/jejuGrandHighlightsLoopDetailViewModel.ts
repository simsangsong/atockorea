/**
 * Jeju Grand Highlights Loop — 정적 JSON → east-signature 동일 뷰모델 shape.
 */

import type { EastSignatureNatureCoreDetailViewModel } from "../east-signature-nature-core/eastSignatureNatureCoreDetailViewModel";
import { DEFAULT_TOUR_PRODUCT_SECTION_UI_EN } from "@/lib/tour-product/tourProductSectionUi";

import fullPage from "./jeju-grand-highlights-loop-tour-product-full-page.en.json";

type FullPageDoc = {
  headlineLine1: string;
  headlineLine2: string;
  hero: EastSignatureNatureCoreDetailViewModel["hero"];
  price: EastSignatureNatureCoreDetailViewModel["price"];
  subnavItems: EastSignatureNatureCoreDetailViewModel["subnavItems"];
  glanceItems: EastSignatureNatureCoreDetailViewModel["glanceItems"];
  galleryItems: EastSignatureNatureCoreDetailViewModel["galleryItems"];
  itineraryStops: EastSignatureNatureCoreDetailViewModel["itineraryStops"];
  routeFlowStops: EastSignatureNatureCoreDetailViewModel["routeFlowStops"];
  routePhases: EastSignatureNatureCoreDetailViewModel["routePhases"];
  routeShapeIntro: EastSignatureNatureCoreDetailViewModel["routeShapeIntro"];
  whyTourWorks: EastSignatureNatureCoreDetailViewModel["whyTourWorks"];
  practicalAccordionItems: EastSignatureNatureCoreDetailViewModel["practicalAccordionItems"];
  practicalWeatherStatic: EastSignatureNatureCoreDetailViewModel["practicalWeatherStatic"];
  seasonalVariations: EastSignatureNatureCoreDetailViewModel["seasonalVariations"];
  bookingTrustItems: EastSignatureNatureCoreDetailViewModel["bookingTrustItems"];
  bookingSupportSteps: EastSignatureNatureCoreDetailViewModel["bookingSupportSteps"];
  staticQuestions: EastSignatureNatureCoreDetailViewModel["staticQuestions"];
  guestReviews: EastSignatureNatureCoreDetailViewModel["guestReviews"];
  reviewsSummary: EastSignatureNatureCoreDetailViewModel["reviewsSummary"];
};

const doc = fullPage as unknown as FullPageDoc;

export const jejuGrandHighlightsLoopDetailViewModel: EastSignatureNatureCoreDetailViewModel = {
  headlineLine1: doc.headlineLine1,
  headlineLine2: doc.headlineLine2,
  hero: doc.hero,
  price: doc.price,
  subnavItems: doc.subnavItems,
  glanceItems: doc.glanceItems,
  galleryItems: doc.galleryItems,
  itineraryStops: doc.itineraryStops,
  routeFlowStops: doc.routeFlowStops,
  routePhases: doc.routePhases,
  routeShapeIntro: doc.routeShapeIntro,
  whyTourWorks: doc.whyTourWorks,
  practicalAccordionItems: doc.practicalAccordionItems,
  practicalWeatherStatic: doc.practicalWeatherStatic,
  seasonalVariations: doc.seasonalVariations,
  bookingTrustItems: doc.bookingTrustItems,
  bookingSupportSteps: doc.bookingSupportSteps,
  staticQuestions: doc.staticQuestions,
  guestReviews: doc.guestReviews,
  reviewsSummary: doc.reviewsSummary,
  sectionUi: DEFAULT_TOUR_PRODUCT_SECTION_UI_EN,
};
