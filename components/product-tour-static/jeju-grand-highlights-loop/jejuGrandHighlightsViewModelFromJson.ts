/**
 * `jeju-grand-highlights-loop.*.json` (tour_product_full_page_v1) → 동부와 동일 뷰모델 shape.
 * JSON 필드가 우선; sectionUi 없으면 로케일 기본 + merge.
 */

import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import type { EastSignatureNatureCoreDetailViewModel } from "../east-signature-nature-core/eastSignatureNatureCoreDetailViewModel";
import { mergeTourProductSectionUi } from "@/lib/tour-product/tourProductSectionUi";

import { getJejuGrandHighlightsLoopFullPageJson } from "./jejuGrandHighlightsLocaleBundles";

/** 뷰모델에 들어가는 키만 (seo, catalog_card, page_sections, sticky 등 제외) */
const VM_KEYS = [
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
] as const;

type FullPageJson = ReturnType<typeof getJejuGrandHighlightsLoopFullPageJson> & {
  sectionUi?: unknown;
  locale?: string;
};

export function buildJejuGrandHighlightsLoopDetailViewModelFromJson(
  locale: TourProductPageLocale = "en",
): EastSignatureNatureCoreDetailViewModel {
  const doc = getJejuGrandHighlightsLoopFullPageJson(locale);
  const raw = doc as FullPageJson;
  const sectionUi = mergeTourProductSectionUi(
    raw.sectionUi && typeof raw.sectionUi === "object" ? raw.sectionUi : undefined,
    raw.locale ?? locale,
  );

  const base: Record<string, unknown> = {};
  for (const k of VM_KEYS) {
    if (raw[k as keyof typeof raw] !== undefined) {
      base[k] = raw[k as keyof typeof raw] as unknown;
    }
  }

  return {
    ...base,
    sectionUi,
  } as unknown as EastSignatureNatureCoreDetailViewModel;
}

export const jejuGrandHighlightsLoopDetailViewModel: EastSignatureNatureCoreDetailViewModel =
  buildJejuGrandHighlightsLoopDetailViewModelFromJson("en");
