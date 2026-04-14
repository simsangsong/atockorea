/**
 * Supabase `tour_product_pages.detail_payload` 시드용 JSON 생성.
 * 스크립트: `npm run gen:tour-product-seed`
 *
 * 전 페이지 JSONB 덤프: `buildEastSignatureFullPageJsonbDocument` + `npm run export:tour-product-full-jsonb`
 */

import { eastSignatureNatureCoreStaticProduct } from "../catalog/staticTourProductRegistry";
import { TOUR_PRODUCT_DETAIL_PAYLOAD_SCHEMA_VERSION } from "../../../lib/tour-product/detailPayloadV1";
import { eastSignatureNatureCoreDetailViewModel } from "./eastSignatureNatureCoreDetailViewModel";
import { eastSignatureNatureCoreProduct } from "./staticProductData";

/** JSON 직렬화 가능한 plain object */
export function buildEastSignatureDetailPayloadForSupabase() {
  const vm = eastSignatureNatureCoreDetailViewModel;
  return {
    schema_version: TOUR_PRODUCT_DETAIL_PAYLOAD_SCHEMA_VERSION,
    sectionUi: vm.sectionUi,
    hero: vm.hero,
    subnavItems: vm.subnavItems,
    glanceItems: vm.glanceItems,
    galleryItems: vm.galleryItems,
    itineraryStops: vm.itineraryStops,
    routeFlowStops: vm.routeFlowStops,
    routePhases: vm.routePhases,
    routeShapeIntro: vm.routeShapeIntro,
    whyTourWorks: vm.whyTourWorks,
    practicalAccordionItems: vm.practicalAccordionItems,
    practicalWeatherStatic: vm.practicalWeatherStatic,
    seasonalVariations: vm.seasonalVariations,
    bookingTrustItems: vm.bookingTrustItems,
    bookingSupportSteps: vm.bookingSupportSteps,
    staticQuestions: vm.staticQuestions,
    guestReviews: vm.guestReviews,
    reviewsSummary: vm.reviewsSummary,
  };
}

const reg = eastSignatureNatureCoreStaticProduct;

/**
 * `/tour-product/east-signature-nature-core` 화면 전체(히어로~리뷰~스티키 가격)를 한 JSONB에 담기 위한 문서.
 * `page_sections` 순서는 `EastSignatureNatureCoreDetailClient` 렌더 순서와 동일.
 */
export function buildEastSignatureFullPageJsonbDocument() {
  const vm = eastSignatureNatureCoreDetailViewModel;
  const prod = eastSignatureNatureCoreProduct;

  const catalogCard = {
    slug: reg.slug,
    title: reg.title,
    subtitle: reg.subtitle,
    region: reg.region,
    duration: reg.duration,
    stopsCount: reg.stopsCount,
    rating: reg.rating,
    reviewCount: reg.reviewCount,
    badges: [...reg.badges],
    heroImage: reg.heroImage,
    thumbnail: reg.thumbnail,
    priceLabel: reg.priceLabel,
    shortCardDescription: reg.shortCardDescription,
  };

  return {
    document_kind: "tour_product_full_page_v1",
    schema_version: TOUR_PRODUCT_DETAIL_PAYLOAD_SCHEMA_VERSION,
    slug: reg.slug,
    locale: "en",
    seo: {
      pageTitle: `${reg.title} | AtoC Korea`,
      metaDescription: prod.description,
    },
    catalog_card: catalogCard,
    headlineLine1: vm.headlineLine1,
    headlineLine2: vm.headlineLine2,
    price: vm.price,
    hero: vm.hero,
    subnavItems: vm.subnavItems,
    sectionUi: vm.sectionUi,
    glanceItems: vm.glanceItems,
    galleryItems: vm.galleryItems,
    itineraryStops: vm.itineraryStops,
    routeFlowStops: vm.routeFlowStops,
    routePhases: vm.routePhases,
    routeShapeIntro: vm.routeShapeIntro,
    whyTourWorks: vm.whyTourWorks,
    practicalAccordionItems: vm.practicalAccordionItems,
    practicalWeatherStatic: vm.practicalWeatherStatic,
    seasonalVariations: vm.seasonalVariations,
    bookingTrustItems: vm.bookingTrustItems,
    bookingSupportSteps: vm.bookingSupportSteps,
    staticQuestions: vm.staticQuestions,
    guestReviews: vm.guestReviews,
    reviewsSummary: vm.reviewsSummary,
    sticky_booking_bar: {
      note: "checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.",
      price: vm.price,
    },
    page_sections: [
      {
        id: "hero",
        section_html_id: null,
        component: "TourHeroSection",
        props: {
          headlineLine1: vm.headlineLine1,
          headlineLine2: vm.headlineLine2,
          hero: vm.hero,
        },
      },
      {
        id: "subnav",
        section_html_id: null,
        component: "TourTabsNav",
        props: { subnavItems: vm.subnavItems },
      },
      {
        id: "overview",
        section_html_id: "overview",
        component: "TourAtAGlance",
        props: { glanceItems: vm.glanceItems, sectionUi: vm.sectionUi },
      },
      {
        id: "atmosphere",
        section_html_id: null,
        component: "TourAtmosphereGallery",
        props: { galleryItems: vm.galleryItems, sectionUi: vm.sectionUi },
      },
      {
        id: "itinerary",
        section_html_id: "itinerary",
        component: "TourTimelineSection",
        props: { itineraryStops: vm.itineraryStops, sectionUi: vm.sectionUi },
      },
      {
        id: "day_flow",
        section_html_id: null,
        component: "TourDayFlowSection",
        props: {
          routeFlowStops: vm.routeFlowStops,
          routePhases: vm.routePhases,
          routeShapeIntro: vm.routeShapeIntro,
          sectionUi: vm.sectionUi,
        },
      },
      {
        id: "details",
        section_html_id: "details",
        component: "TourFitSection",
        props: { whyTourWorks: vm.whyTourWorks, sectionUi: vm.sectionUi },
      },
      {
        id: "practical",
        section_html_id: null,
        component: "TourPracticalDetails",
        props: {
          practicalAccordionItems: vm.practicalAccordionItems,
          practicalWeatherStatic: vm.practicalWeatherStatic,
          seasonalVariations: vm.seasonalVariations,
          sectionUi: vm.sectionUi,
        },
      },
      {
        id: "booking_support",
        section_html_id: null,
        component: "TourBookingSupportSection",
        props: {
          bookingTrustItems: vm.bookingTrustItems,
          bookingSupportSteps: vm.bookingSupportSteps,
          sectionUi: vm.sectionUi,
        },
      },
      {
        id: "faq",
        section_html_id: "faq",
        component: "TourFaqSection",
        props: { staticQuestions: vm.staticQuestions, sectionUi: vm.sectionUi },
      },
      {
        id: "reviews",
        section_html_id: "reviews",
        component: "TourReviewsSection",
        props: { guestReviews: vm.guestReviews, reviewsSummary: vm.reviewsSummary, sectionUi: vm.sectionUi },
      },
      {
        id: "sticky_booking",
        section_html_id: null,
        component: "TourStickyBookingBar",
        props: { price: vm.price },
      },
    ],
  };
}
