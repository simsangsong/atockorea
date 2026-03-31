-- Supabase SQL Editor에서 실행 (여러 번 실행해도 안전: 컬럼이 이미 있으면 스킵)
-- 대상: public.jeju_kor_tourapi_places

ALTER TABLE public.jeju_kor_tourapi_places
  ADD COLUMN IF NOT EXISTS photo_gallery_detail_json JSONB;

ALTER TABLE public.jeju_kor_tourapi_places
  ADD COLUMN IF NOT EXISTS photo_gallery_fetched_at TIMESTAMPTZ;

COMMENT ON COLUMN public.jeju_kor_tourapi_places.photo_gallery_detail_json IS
  '관광사진 API(galleryDetailList1 등)에서 수집한 상세 사진 목록·메타(JSON). KorService2 detailImage와 별도';

COMMENT ON COLUMN public.jeju_kor_tourapi_places.photo_gallery_fetched_at IS
  'Last successful import from PhotoGalleryService1 for this row';
