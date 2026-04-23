-- KorService2 제주 관광지 상위 N건 + detailCommon2/detailIntro2 정제 저장 (투어 상품 tours 와 별도)
-- 적용 후: npm run import:jeju:top:tourapi  (옵션 JEJU_TOP_UPSERT_SUPABASE=1)

CREATE TABLE IF NOT EXISTS public.jeju_kor_tourapi_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_rank INTEGER,
  source_name TEXT NOT NULL,
  matched_title TEXT,
  content_id TEXT NOT NULL,
  content_type_id TEXT NOT NULL,
  addr1 TEXT,
  addr2 TEXT,
  overview TEXT,
  first_image TEXT,
  first_image2 TEXT,
  mapx TEXT,
  mapy TEXT,
  tel TEXT,
  homepage TEXT,
  score NUMERIC,
  match_reason JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_api TEXT NOT NULL DEFAULT 'KorService2',
  fetched_at TIMESTAMPTZ NOT NULL,
  opening_hours_raw TEXT,
  admission_fee_raw TEXT,
  business_status_note TEXT,
  reservation_info TEXT,
  parking_info TEXT,
  rest_date TEXT,
  use_time_text TEXT,
  fee_text TEXT,
  intro_raw_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_id, content_type_id)
);

CREATE INDEX IF NOT EXISTS idx_jeju_kor_tourapi_places_list_rank
  ON public.jeju_kor_tourapi_places (list_rank);

CREATE INDEX IF NOT EXISTS idx_jeju_kor_tourapi_places_fetched_at
  ON public.jeju_kor_tourapi_places (fetched_at DESC);

COMMENT ON TABLE public.jeju_kor_tourapi_places IS 'KorService2 areaBasedList2(제주) + detailCommon2/detailIntro2 — 관광지 단위';

ALTER TABLE public.jeju_kor_tourapi_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jeju_kor_tourapi_places_select_anon"
  ON public.jeju_kor_tourapi_places
  FOR SELECT
  TO anon, authenticated
  USING (true);
