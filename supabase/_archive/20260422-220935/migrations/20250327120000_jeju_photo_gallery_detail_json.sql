-- Tour API PhotoGalleryService1 — 제주 관광사진 상세 목록 (스크립트 `npm run import:jeju:photo-gallery`)

ALTER TABLE public.jeju_kor_tourapi_places
  ADD COLUMN IF NOT EXISTS photo_gallery_detail_json JSONB;

ALTER TABLE public.jeju_kor_tourapi_places
  ADD COLUMN IF NOT EXISTS photo_gallery_fetched_at TIMESTAMPTZ;

COMMENT ON COLUMN public.jeju_kor_tourapi_places.photo_gallery_detail_json IS
  '관광사진 API(galleryDetailList1 등)에서 수집한 상세 사진 목록·메타(JSON). KorService2 detailImage와 별도';

COMMENT ON COLUMN public.jeju_kor_tourapi_places.photo_gallery_fetched_at IS
  'Last successful import from PhotoGalleryService1 for this row';
