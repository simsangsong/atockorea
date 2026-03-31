-- Supabase SQL Editor에서 한 번 실행 (idempotent)
-- · public.jeju_kor_tourapi_places 가 없으면 테이블 생성
-- · 인덱스 / updated_at 트리거 / RLS / 정책 / GRANT 은 항상 최종 상태로 맞춤
-- · 실제 관광지 데이터는 npm run import:jeju:all:tourapi (JEJU_UPSERT_SUPABASE=1) 로 채움
--
-- 이미 다른 스키마(UUID 등)로 테이블이 있는 경우: 백업 후
--   DROP TABLE IF EXISTS public.jeju_kor_tourapi_places CASCADE;
-- 를 실행한 뒤 이 스크립트를 다시 실행하세요.

CREATE OR REPLACE FUNCTION public.set_jeju_kor_tourapi_places_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'jeju_kor_tourapi_places'
  ) THEN
    CREATE TABLE public.jeju_kor_tourapi_places (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      content_id TEXT NOT NULL,
      content_type_id INTEGER NOT NULL,
      title TEXT,
      addr1 TEXT,
      addr2 TEXT,
      overview TEXT,
      first_image TEXT,
      first_image2 TEXT,
      mapx NUMERIC,
      mapy NUMERIC,
      tel TEXT,
      homepage TEXT,
      readcount INTEGER,
      list_rank INTEGER,
      opening_hours_raw TEXT,
      admission_fee_raw TEXT,
      business_status_note TEXT,
      reservation_info TEXT,
      parking_info TEXT,
      rest_date TEXT,
      use_time_text TEXT,
      fee_text TEXT,
      intro_raw_json JSONB,
      detail_info_raw_json JSONB,
      source_api TEXT,
      fetched_at TIMESTAMPTZ,
      sync_batch_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT jeju_kor_tourapi_places_content_unique UNIQUE (content_id, content_type_id)
    );

    COMMENT ON TABLE public.jeju_kor_tourapi_places IS
      'KorService2 areaBasedList2(제주) + detailCommon2/detailIntro2/detailInfo2';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_jeju_kor_tourapi_places_list_rank
  ON public.jeju_kor_tourapi_places (list_rank);

CREATE INDEX IF NOT EXISTS idx_jeju_kor_tourapi_places_fetched_at
  ON public.jeju_kor_tourapi_places (fetched_at DESC);

DROP TRIGGER IF EXISTS trg_jeju_kor_tourapi_places_updated_at
  ON public.jeju_kor_tourapi_places;

CREATE TRIGGER trg_jeju_kor_tourapi_places_updated_at
  BEFORE UPDATE ON public.jeju_kor_tourapi_places
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_jeju_kor_tourapi_places_updated_at();

ALTER TABLE public.jeju_kor_tourapi_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jeju_kor_tourapi_places_select_anon_auth" ON public.jeju_kor_tourapi_places;
DROP POLICY IF EXISTS "jeju_kor_tourapi_places_insert_service_role" ON public.jeju_kor_tourapi_places;
DROP POLICY IF EXISTS "jeju_kor_tourapi_places_update_service_role" ON public.jeju_kor_tourapi_places;
DROP POLICY IF EXISTS "jeju_kor_tourapi_places_delete_service_role" ON public.jeju_kor_tourapi_places;

CREATE POLICY "jeju_kor_tourapi_places_select_anon_auth"
  ON public.jeju_kor_tourapi_places
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "jeju_kor_tourapi_places_insert_service_role"
  ON public.jeju_kor_tourapi_places
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "jeju_kor_tourapi_places_update_service_role"
  ON public.jeju_kor_tourapi_places
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "jeju_kor_tourapi_places_delete_service_role"
  ON public.jeju_kor_tourapi_places
  FOR DELETE
  TO service_role
  USING (true);

ALTER TABLE public.jeju_kor_tourapi_places
  ADD COLUMN IF NOT EXISTS manual_boost_score NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.jeju_kor_tourapi_places.manual_boost_score IS
  'Additive push for generation candidate ranking; distinct from manual_priority (operator ordering)';

ALTER TABLE public.jeju_kor_tourapi_places
  ADD COLUMN IF NOT EXISTS photo_gallery_detail_json JSONB;

ALTER TABLE public.jeju_kor_tourapi_places
  ADD COLUMN IF NOT EXISTS photo_gallery_fetched_at TIMESTAMPTZ;

COMMENT ON COLUMN public.jeju_kor_tourapi_places.photo_gallery_detail_json IS
  'Tour API PhotoGalleryService1 상세 사진 목록(JSON)';

COMMENT ON COLUMN public.jeju_kor_tourapi_places.photo_gallery_fetched_at IS
  'Last Photo Gallery import time';

GRANT SELECT ON public.jeju_kor_tourapi_places TO anon, authenticated;
GRANT ALL ON public.jeju_kor_tourapi_places TO service_role;
