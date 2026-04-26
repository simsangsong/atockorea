import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";

/**
 * Supabase `tour_product_pages.detail_payload` 계약 (schema_version === 1).
 * 정적 구현 기준: `eastSignatureNatureCoreDetailViewModel` + `staticProductData` 섹션 필드.
 *
 * DB: supabase/migrations/20260412120000_tour_product_pages_and_offers.sql
 *
 * 주입 규칙:
 * - 컬럼: slug, 카드/SEO, headline_line_*, price_amount_label 등 (목록·메타)
 * - JSONB: 아래 필드 (본문 섹션) — 리뷰는 tour_id + reviews 테이블 우선, 여기는 시드/폴백
 */

export const TOUR_PRODUCT_DETAIL_PAYLOAD_SCHEMA_VERSION = 1 as const;

/** DB CHECK: detail_payload.schema_version */
export type TourProductDetailPayloadSchemaVersion = typeof TOUR_PRODUCT_DETAIL_PAYLOAD_SCHEMA_VERSION;

/** `tour_product_pages` 행 + payload 조립 결과에 쓰는 상세 뷰모델 (앱 `Tour*` props 소스). */
export type TourProductDetailViewModelV1 = {
  schema_version: TourProductDetailPayloadSchemaVersion;
  headlineLine1: string;
  headlineLine2: string;
  hero: {
    imageUrl: string;
    imagePosition: string;
    tagline: string;
    pills: readonly string[] | string[];
    meta: {
      duration: string;
      region: string;
      stops: string;
      rating: number;
      ratingStars: number;
    };
  };
  price: {
    amountLabel: string;
    currency: string;
    per: string;
  };
  subnavItems: readonly { id: string; label: string }[];
  glanceItems: unknown[];
  galleryItems: unknown[];
  itineraryStops: unknown[];
  routeFlowStops: unknown[];
  routePhases: unknown[];
  routeShapeIntro: { title: string; subtitle: string };
  whyTourWorks: unknown;
  practicalAccordionItems: unknown[];
  /** 라이브 날씨 API 연결 시 서버에서 덮어쓰기 */
  practicalWeatherStatic: { today: { temp: string; label: string }; tomorrow: { temp: string; label: string } };
  seasonalVariations: unknown[];
  bookingTrustItems: unknown[];
  bookingSupportSteps: unknown[];
  staticQuestions: unknown[];
  /** tour_id 없거나 CMS 전용일 때만 */
  guestReviews?: unknown[];
  reviewsSummary?: unknown;
  /** 섹션 제목·부제 등 UI 문자열 (로케일별) */
  sectionUi: TourProductSectionUiV1;
};

/**
 * JSONB에만 넣는 블록 (컬럼과 중복 최소화할 때).
 * headline/hero/price는 컬럼+오퍼에서 채우고 JSON에서는 생략 가능 — 앱에서 merge.
 */
export type TourProductDetailPayloadV1 = {
  schema_version: TourProductDetailPayloadSchemaVersion;
  headlineLine1?: string;
  headlineLine2?: string;
  hero?: TourProductDetailViewModelV1["hero"];
  subnavItems?: TourProductDetailViewModelV1["subnavItems"];
  glanceItems?: unknown[];
  galleryItems?: unknown[];
  itineraryStops?: unknown[];
  routeFlowStops?: unknown[];
  routePhases?: unknown[];
  routeShapeIntro?: TourProductDetailViewModelV1["routeShapeIntro"];
  whyTourWorks?: unknown;
  practicalAccordionItems?: unknown[];
  practicalWeatherStatic?: TourProductDetailViewModelV1["practicalWeatherStatic"];
  seasonalVariations?: unknown[];
  bookingTrustItems?: unknown[];
  bookingSupportSteps?: unknown[];
  staticQuestions?: unknown[];
  guestReviews?: unknown[];
  reviewsSummary?: unknown;
  sectionUi?: Partial<TourProductSectionUiV1>;
  pickup_dropoff?: unknown;
  routeVariants?: unknown[];
};

export type TourProductOfferRow = {
  id: string;
  tour_product_page_id: string;
  label: string | null;
  amount_minor: number;
  currency: string;
  stripe_price_id: string | null;
  is_active: boolean;
  is_default: boolean;
  valid_from: string | null;
  valid_to: string | null;
};
