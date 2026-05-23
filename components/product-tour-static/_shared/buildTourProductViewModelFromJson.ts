/**
 * Slug-agnostic adapter: `tour_product_full_page_v1` JSON → East template VM.
 *
 * Supersedes the per-slug adapter that used to live in
 * `jeju-grand-highlights-loop/jejuGrandHighlightsViewModelFromJson.ts`; any
 * new small-group tour registered via the catch-all `[slug]` route relies on
 * this single function to render identical UI.
 */

import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import { mergeTourProductSectionUi } from "@/lib/tour-product/tourProductSectionUi";
import { mapItineraryVariantsToRouteVariants } from "@/lib/tour-product/portRouteVariantsAdapter";

import {
  TOUR_PRODUCT_VIEW_MODEL_KEYS,
  type TourProductDetailViewModel,
  type TourProductFullPageJson,
} from "./tourProductFullPageJsonTypes";

export function buildTourProductViewModelFromFullPageJson(
  doc: TourProductFullPageJson,
  locale: TourProductPageLocale = "en",
): TourProductDetailViewModel {
  const sectionUi = mergeTourProductSectionUi(
    doc.sectionUi && typeof doc.sectionUi === "object" ? doc.sectionUi : undefined,
    doc.locale ?? locale,
  );

  const base: Record<string, unknown> = {};
  for (const k of TOUR_PRODUCT_VIEW_MODEL_KEYS) {
    const v = doc[k as keyof TourProductFullPageJson];
    if (v !== undefined) base[k] = v;
  }

  // Back-fill routeVariants from the legacy authoring key `itinerary_variants`
  // when the canonical key is absent. Only the two Jeju cruise tours currently
  // populate this; every other product authors empty arrays, which the adapter
  // returns as null and we leave untouched.
  if (
    !Array.isArray(base.routeVariants) ||
    (Array.isArray(base.routeVariants) && base.routeVariants.length === 0)
  ) {
    const adapted = mapItineraryVariantsToRouteVariants(
      (doc as { itinerary_variants?: unknown }).itinerary_variants,
    );
    if (adapted) base.routeVariants = adapted;
  }

  /**
   * Runtime-shape matches the East static VM when authoring JSON is complete;
   * the template components tolerate missing optional sections (empty arrays).
   */
  return {
    ...base,
    sectionUi,
  } as unknown as TourProductDetailViewModel;
}
