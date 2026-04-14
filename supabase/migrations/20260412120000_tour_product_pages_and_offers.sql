-- =============================================================================
-- Tour product pages (v0-shell static detail → live CMS)
-- =============================================================================
-- 목적:
--   - /tour-product 스타일 상세에 필요한 marketing JSONB(detail_payload) + 목록용 스칼라
--   - 실제 판매가/Stripe 등은 tour_product_offers 로 분리
--   - 예약·리뷰는 기존 public.tours / bookings / reviews 와 tour_id 로 연결
-- UI 계약: components/product-tour-static/.../eastSignatureNatureCoreDetailViewModel.ts
-- =============================================================================

BEGIN;

-- Idempotent: shared trigger helper (이미 있으면 정의만 갱신)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1) tour_product_pages — 슬러그별 랜딩 + detail_payload
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_product_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 동일 슬러그·다국어
  slug TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  CONSTRAINT tour_product_pages_slug_locale_unique UNIQUE (slug, locale),

  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- 기존 투어 상품(예약·장바구니·리뷰 FK)과 연결 — 없으면 NULL (마케팅 전용 페이지)
  tour_id UUID REFERENCES public.tours (id) ON DELETE SET NULL,

  -- 카드·SEO·히어로 이미지(목록/OG용 — 본문 hero 객체는 detail_payload 권장)
  title TEXT NOT NULL,
  subtitle TEXT,
  region_label TEXT,
  duration_label TEXT,
  stops_count INTEGER,
  rating_avg NUMERIC(3, 2),
  review_count INTEGER,
  badges TEXT[] NOT NULL DEFAULT '{}',
  hero_image_url TEXT,
  thumbnail_url TEXT,
  card_short_description TEXT,
  seo_title TEXT,
  meta_description TEXT,

  -- v0 헤드라인 분리 (TourHeroSection)
  headline_line_1 TEXT,
  headline_line_2 TEXT,

  -- 스티키 바 등 표시용 (오퍼가 없을 때 폴백; 라이브는 offers 우선)
  price_amount_label TEXT,
  price_currency TEXT NOT NULL DEFAULT 'KRW',
  price_per TEXT NOT NULL DEFAULT 'person',

  -- schema_version 포함 필수 — 앱에서 뷰모델 조립 시 검증
  detail_payload JSONB NOT NULL DEFAULT '{"schema_version": 1}'::JSONB,
  CONSTRAINT tour_product_pages_detail_has_schema_version
    CHECK (detail_payload ? 'schema_version'),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_product_pages_slug ON public.tour_product_pages (slug);
CREATE INDEX IF NOT EXISTS idx_tour_product_pages_tour_id ON public.tour_product_pages (tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_product_pages_list_published
  ON public.tour_product_pages (is_published, sort_order, locale)
  WHERE is_published = TRUE;

COMMENT ON TABLE public.tour_product_pages IS
  'Marketing/detail shell for tour-product v0 UI; detail_payload matches app view-model sections (schema_versioned JSONB).';

COMMENT ON COLUMN public.tour_product_pages.detail_payload IS
  $c$JSON schema_version 1: hero, subnavItems, glanceItems, galleryItems, itineraryStops, routeFlowStops, routePhases, routeShapeIntro, whyTourWorks, practicalAccordionItems, practicalWeatherStatic, seasonalVariations, bookingTrustItems, bookingSupportSteps, staticQuestions; optional guestReviews/reviewsSummary for seed. See lib/tour-product/detailPayloadV1.ts.$c$;

DROP TRIGGER IF EXISTS trg_tour_product_pages_updated_at ON public.tour_product_pages;
CREATE TRIGGER trg_tour_product_pages_updated_at
  BEFORE UPDATE ON public.tour_product_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2) tour_product_offers — 판매 단위(금액·Stripe·기간)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_product_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_product_page_id UUID NOT NULL REFERENCES public.tour_product_pages (id) ON DELETE CASCADE,

  label TEXT,
  amount_minor BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KRW',
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  valid_from DATE,
  valid_to DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_product_offers_page ON public.tour_product_offers (tour_product_page_id);

CREATE UNIQUE INDEX IF NOT EXISTS tour_product_offers_one_default_per_page
  ON public.tour_product_offers (tour_product_page_id)
  WHERE is_default = TRUE AND is_active = TRUE;

COMMENT ON TABLE public.tour_product_offers IS
  'Sellable price points for a tour_product_page; app maps default offer → sticky bar / checkout.';

DROP TRIGGER IF EXISTS trg_tour_product_offers_updated_at ON public.tour_product_offers;
CREATE TRIGGER trg_tour_product_offers_updated_at
  BEFORE UPDATE ON public.tour_product_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3) RLS — 공개 조회는 published 만; 쓰기는 서비스 롤·대시보드
-- ---------------------------------------------------------------------------
ALTER TABLE public.tour_product_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_product_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tour_product_pages_select_published ON public.tour_product_pages;
CREATE POLICY tour_product_pages_select_published
  ON public.tour_product_pages
  FOR SELECT
  TO anon, authenticated
  USING (is_published = TRUE);

DROP POLICY IF EXISTS tour_product_offers_select_published ON public.tour_product_offers;
CREATE POLICY tour_product_offers_select_published
  ON public.tour_product_offers
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1
      FROM public.tour_product_pages p
      WHERE p.id = tour_product_offers.tour_product_page_id
        AND p.is_published = TRUE
    )
  );

COMMIT;
