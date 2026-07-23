-- AtoC 통합 Phase 1 slice 1 — bookings OTA 확장 (additive only)
-- Consolidation plan §3 A-7a / §5.6:
--   bookings upsert 키 = (source, external_booking_id). 기존 컬럼은 재사용,
--   추가 컬럼은 아래 2개뿐. 기존 컬럼 변경/삭제 절대 금지 (plan §2 명명 규칙).
--
-- ⚠ 적용 금지 상태로 파일만 커밋 (이번 슬라이스 범위).

alter table bookings add column if not exists external_booking_id text;
alter table bookings add column if not exists ota_raw_meta jsonb;

comment on column bookings.external_booking_id is
  'OTA 예약번호 (Klook/Viator/GYG/KKday). 인박스 파서 멱등 upsert 키의 절반 — (source, external_booking_id).';
comment on column bookings.ota_raw_meta is
  'OTA 원문에서 추출한 마스킹된 요약 메타 (PII 마스킹본만 — 원문 이메일 저장 금지).';

-- 멱등 upsert 키: 같은 OTA 예약이 두 번 파싱돼도 1행. 자체 주문(external_booking_id
-- NULL)은 인덱스 대상에서 제외 (partial index).
create unique index if not exists uq_bookings_source_ext
  on bookings (source, external_booking_id)
  where external_booking_id is not null;
