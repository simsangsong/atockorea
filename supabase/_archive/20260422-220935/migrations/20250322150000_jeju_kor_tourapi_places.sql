-- KorService2 제주 전체 POI import (areaBasedList2 + detailCommon2/detailIntro2/detailInfo2)
-- 적용 후: npm run import:jeju:all:tourapi  (옵션 JEJU_UPSERT_SUPABASE=1)
-- 기존 jeju_kor_tourapi_places(구 스키마)가 있으면 교체합니다.

DROP TABLE IF EXISTS public.jeju_kor_tourapi_places CASCADE;

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

CREATE INDEX IF NOT EXISTS idx_jeju_kor_tourapi_places_list_rank
  ON public.jeju_kor_tourapi_places (list_rank);

CREATE INDEX IF NOT EXISTS idx_jeju_kor_tourapi_places_fetched_at
  ON public.jeju_kor_tourapi_places (fetched_at DESC);

COMMENT ON TABLE public.jeju_kor_tourapi_places IS 'KorService2 areaBasedList2(제주) + detailCommon2/detailIntro2/detailInfo2';

CREATE OR REPLACE FUNCTION public.set_jeju_kor_tourapi_places_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jeju_kor_tourapi_places_updated_at
  BEFORE UPDATE ON public.jeju_kor_tourapi_places
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_jeju_kor_tourapi_places_updated_at();

ALTER TABLE public.jeju_kor_tourapi_places ENABLE ROW LEVEL SECURITY;

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

GRANT SELECT ON public.jeju_kor_tourapi_places TO anon, authenticated;
GRANT ALL ON public.jeju_kor_tourapi_places TO service_role;
