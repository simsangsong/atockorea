-- =============================================================================
-- Recommendation foundation — 공통 스키마 (모든 투어/상품 재사용)
-- =============================================================================
-- 재사용 규칙:
--   - tour_product_pages: 로케일별 디스플레이(슬러그·detail_payload 등). 행마다
--     동일 논리 상품은 같은 product_id 로 묶음.
--   - tour_matching_profiles: 논리 상품(product_id)당 1행. 언어 무관. 새 투어는
--     INSERT 한 행만 추가하면 됨(테이블 구조 변경 불필요).
--   - parsed_intent_cache: 사용자 입력 정규화 → 구조화 intent 캐시. 투어와 무관하게
--     전역 공통 테이블(parser_version 으로 무효화).
-- RLS: matching 은 공개 읽기(is_active); intent 캐시는 정책 없음 → 서비스 롤(API) 전용.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) updated_at 트리거 함수
-- ---------------------------------------------------------------------------
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
-- 1) tour_product_pages.product_id (논리 상품 키 — 다국어 행 공통)
-- ---------------------------------------------------------------------------
ALTER TABLE public.tour_product_pages
  ADD COLUMN IF NOT EXISTS product_id TEXT;

COMMENT ON COLUMN public.tour_product_pages.product_id IS
  'Logical product key for all locales (e.g. east-signature-nature-core). Same schema for every future tour: set explicitly or default from slug.';

UPDATE public.tour_product_pages
SET product_id = slug
WHERE product_id IS NULL OR length(trim(product_id)) = 0;

ALTER TABLE public.tour_product_pages
  ALTER COLUMN product_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tour_product_pages_product_id_locale_unique
  ON public.tour_product_pages (product_id, locale);

CREATE INDEX IF NOT EXISTS idx_tour_product_pages_product_id
  ON public.tour_product_pages (product_id);

CREATE OR REPLACE FUNCTION public.tour_product_pages_default_product_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.product_id IS NULL OR length(trim(NEW.product_id)) = 0 THEN
    NEW.product_id := NEW.slug;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tour_product_pages_default_product_id ON public.tour_product_pages;
CREATE TRIGGER trg_tour_product_pages_default_product_id
  BEFORE INSERT OR UPDATE OF slug, product_id ON public.tour_product_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.tour_product_pages_default_product_id();

-- ---------------------------------------------------------------------------
-- 2) tour_matching_profiles — 상품 공통 1행/ product_id (모든 투어 동일 컬럼 세트)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_matching_profiles (
  product_id TEXT PRIMARY KEY,

  product_type TEXT NOT NULL,
  route_type TEXT NOT NULL,
  -- east | southwest | loop | west | ... 확장 가능 (CHECK 없이 TEXT 로 유지)
  region_type TEXT NOT NULL,

  region_tags JSONB NOT NULL DEFAULT '[]'::JSONB,
  theme_tags JSONB NOT NULL DEFAULT '[]'::JSONB,
  poi_tags JSONB NOT NULL DEFAULT '[]'::JSONB,

  pace_level SMALLINT NOT NULL,
  walking_level SMALLINT NOT NULL,
  scenic_level SMALLINT NOT NULL,
  photo_level SMALLINT NOT NULL,
  culture_level SMALLINT NOT NULL,
  relax_level SMALLINT NOT NULL,

  first_time_fit SMALLINT NOT NULL,
  family_fit SMALLINT NOT NULL,
  senior_fit SMALLINT NOT NULL,
  couple_fit SMALLINT NOT NULL,
  active_traveler_fit SMALLINT NOT NULL,
  one_day_fit SMALLINT NOT NULL,
  same_day_flight_fit SMALLINT NOT NULL,
  rain_fit SMALLINT NOT NULL,
  value_for_money_fit SMALLINT NOT NULL,
  iconic_landmark_fit SMALLINT NOT NULL,
  cafe_fit SMALLINT NOT NULL,

  pickup_base TEXT NOT NULL,
  return_time_band TEXT NOT NULL,
  duration_band TEXT NOT NULL,
  min_recommended_age SMALLINT NOT NULL,

  hard_constraints JSONB NOT NULL DEFAULT '{}'::JSONB,
  walking_notes JSONB NOT NULL DEFAULT '[]'::JSONB,
  keywords JSONB NOT NULL DEFAULT '[]'::JSONB,
  synonym_hints JSONB NOT NULL DEFAULT '[]'::JSONB,

  profile_version SMALLINT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_matching_profiles_active
  ON public.tour_matching_profiles (is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_tour_matching_profiles_region_type
  ON public.tour_matching_profiles (region_type);

-- 태그 기반 조회·확장용 (상품 수가 늘어날 때 유리)
CREATE INDEX IF NOT EXISTS idx_tour_matching_profiles_poi_tags_gin
  ON public.tour_matching_profiles USING GIN (poi_tags);

CREATE INDEX IF NOT EXISTS idx_tour_matching_profiles_region_tags_gin
  ON public.tour_matching_profiles USING GIN (region_tags);

COMMENT ON TABLE public.tour_matching_profiles IS
  'Shared matching schema for every tour product: one row per product_id. Add new tours with INSERT only; do not duplicate per locale.';

DROP TRIGGER IF EXISTS trg_tour_matching_profiles_updated_at ON public.tour_matching_profiles;
CREATE TRIGGER trg_tour_matching_profiles_updated_at
  BEFORE UPDATE ON public.tour_matching_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tour_matching_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tour_matching_profiles_select_active ON public.tour_matching_profiles;
CREATE POLICY tour_matching_profiles_select_active
  ON public.tour_matching_profiles
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

-- ---------------------------------------------------------------------------
-- 3) parsed_intent_cache — 전역 공통 (투어 종류와 무관, parser_version 으로 갱신)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parsed_intent_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  normalized_input TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  parser_version TEXT NOT NULL DEFAULT '1',

  intent JSONB NOT NULL,

  parse_method TEXT NOT NULL DEFAULT 'rule_only',
  CONSTRAINT parsed_intent_cache_parse_method_chk
    CHECK (parse_method IN ('rule_only', 'rule_plus_llm', 'llm_fallback')),

  raw_input TEXT,

  hit_count INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT parsed_intent_cache_hit_count_chk CHECK (hit_count >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS parsed_intent_cache_natural_key_uidx
  ON public.parsed_intent_cache (parser_version, locale, normalized_input);

CREATE INDEX IF NOT EXISTS idx_parsed_intent_cache_last_used_at
  ON public.parsed_intent_cache (last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_parsed_intent_cache_expires_at
  ON public.parsed_intent_cache (expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON TABLE public.parsed_intent_cache IS
  'Global cache: normalized phrase → parsed intent JSON. Same table for all tours; invalidate via parser_version or expires_at. Service role from API.';

DROP TRIGGER IF EXISTS trg_parsed_intent_cache_updated_at ON public.parsed_intent_cache;
CREATE TRIGGER trg_parsed_intent_cache_updated_at
  BEFORE UPDATE ON public.parsed_intent_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.parsed_intent_cache ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4) 시드: 현재 실제 상품 1개만 (east-signature-nature-core)
--    새 투어는 동일 INSERT 템플릿으로 product_id 만 바꿔 추가.
-- ---------------------------------------------------------------------------
INSERT INTO public.tour_matching_profiles (
  product_id,
  product_type,
  route_type,
  region_type,
  region_tags,
  theme_tags,
  poi_tags,
  pace_level,
  walking_level,
  scenic_level,
  photo_level,
  culture_level,
  relax_level,
  first_time_fit,
  family_fit,
  senior_fit,
  couple_fit,
  active_traveler_fit,
  one_day_fit,
  same_day_flight_fit,
  rain_fit,
  value_for_money_fit,
  iconic_landmark_fit,
  cafe_fit,
  pickup_base,
  return_time_band,
  duration_band,
  min_recommended_age,
  hard_constraints,
  walking_notes,
  keywords,
  synonym_hints,
  profile_version,
  is_active
)
VALUES (
  'east-signature-nature-core',
  'small_group',
  'fixed_route',
  'east',
  '["jeju_east"]'::JSONB,
  '["volcano", "coast", "village", "culture", "geology"]'::JSONB,
  '["stone_park", "seopjikoji", "seongsan", "ilchulland", "seongeup"]'::JSONB,
  3,
  3,
  4,
  4,
  4,
  3,
  5,
  4,
  4,
  4,
  3,
  3,
  2,
  3,
  5,
  4,
  2,
  'jeju_city',
  '17:30-18:00',
  '8h',
  8,
  '{"avoidIf":[],"notIdealFor":["very_low_mobility","stroller_heavy_if_summit_focus"]}'::JSONB,
  '["moderate overall","seongsan can be more active if summit is taken"]'::JSONB,
  '["east jeju","seongsan","volcano","coast","village","first time","culture"]'::JSONB,
  '["iconic east","balanced day","classic jeju east"]'::JSONB,
  1,
  TRUE
)
ON CONFLICT (product_id) DO UPDATE SET
  product_type = EXCLUDED.product_type,
  route_type = EXCLUDED.route_type,
  region_type = EXCLUDED.region_type,
  region_tags = EXCLUDED.region_tags,
  theme_tags = EXCLUDED.theme_tags,
  poi_tags = EXCLUDED.poi_tags,
  pace_level = EXCLUDED.pace_level,
  walking_level = EXCLUDED.walking_level,
  scenic_level = EXCLUDED.scenic_level,
  photo_level = EXCLUDED.photo_level,
  culture_level = EXCLUDED.culture_level,
  relax_level = EXCLUDED.relax_level,
  first_time_fit = EXCLUDED.first_time_fit,
  family_fit = EXCLUDED.family_fit,
  senior_fit = EXCLUDED.senior_fit,
  couple_fit = EXCLUDED.couple_fit,
  active_traveler_fit = EXCLUDED.active_traveler_fit,
  one_day_fit = EXCLUDED.one_day_fit,
  same_day_flight_fit = EXCLUDED.same_day_flight_fit,
  rain_fit = EXCLUDED.rain_fit,
  value_for_money_fit = EXCLUDED.value_for_money_fit,
  iconic_landmark_fit = EXCLUDED.iconic_landmark_fit,
  cafe_fit = EXCLUDED.cafe_fit,
  pickup_base = EXCLUDED.pickup_base,
  return_time_band = EXCLUDED.return_time_band,
  duration_band = EXCLUDED.duration_band,
  min_recommended_age = EXCLUDED.min_recommended_age,
  hard_constraints = EXCLUDED.hard_constraints,
  walking_notes = EXCLUDED.walking_notes,
  keywords = EXCLUDED.keywords,
  synonym_hints = EXCLUDED.synonym_hints,
  profile_version = EXCLUDED.profile_version,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

COMMIT;
