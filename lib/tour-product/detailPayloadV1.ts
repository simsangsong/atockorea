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
  SeasonalVariation,
  StaticQuestion,
  SubnavItem,
  TourProductHero,
  TourProductPrice,
  WhyTourWorks,
} from "@/components/product-tour-static/_shared/tourProductDetailSectionTypes";
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

/**
 * v17 batch authoring JSONs ship `schema_version: 7`. The runtime parser
 * accepts any v >= 1; this constant is the value seeded SQL emits.
 */
export const TOUR_PRODUCT_DETAIL_PAYLOAD_SCHEMA_VERSION = 7 as const;

/** DB CHECK: detail_payload.schema_version */
export type TourProductDetailPayloadSchemaVersion = typeof TOUR_PRODUCT_DETAIL_PAYLOAD_SCHEMA_VERSION;

/** `tour_product_pages` 행 + payload 조립 결과에 쓰는 상세 뷰모델 (앱 `Tour*` props 소스). */
export type TourProductDetailViewModelV1 = {
  schema_version: TourProductDetailPayloadSchemaVersion;
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
  /** 라이브 날씨 API 연결 시 서버에서 덮어쓰기 */
  practicalWeatherStatic: PracticalWeatherStatic;
  seasonalVariations: readonly SeasonalVariation[];
  bookingTrustItems: readonly BookingTrustItem[];
  bookingSupportSteps: readonly BookingSupportStep[];
  staticQuestions: readonly StaticQuestion[];
  /** Runtime always populates (empty array / zero summary). */
  guestReviews: readonly GuestReview[];
  reviewsSummary: ReviewsSummary;
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
  hero?: TourProductHero;
  subnavItems?: readonly SubnavItem[];
  glanceItems?: readonly GlanceItem[];
  galleryItems?: readonly GalleryMediaItem[];
  itineraryStops?: readonly ItineraryStop[];
  routeFlowStops?: readonly RouteFlowStop[];
  routePhases?: readonly RoutePhase[];
  routeShapeIntro?: RouteShapeIntro;
  whyTourWorks?: WhyTourWorks;
  practicalAccordionItems?: readonly PracticalAccordionItem[];
  practicalWeatherStatic?: PracticalWeatherStatic;
  seasonalVariations?: readonly SeasonalVariation[];
  bookingTrustItems?: readonly BookingTrustItem[];
  bookingSupportSteps?: readonly BookingSupportStep[];
  staticQuestions?: readonly StaticQuestion[];
  guestReviews?: readonly GuestReview[];
  reviewsSummary?: ReviewsSummary;
  sectionUi?: Partial<TourProductSectionUiV1>;
  pickup_dropoff?: unknown;
  routeVariants?: readonly unknown[];
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
