-- AtoC 통합 플랜 §5.4b / D12 — 노쇼 증거팩 (ops_no_show_evidence)
--
-- 배경: 20260723130000_ops_seating.sql의 ops_seat_assignments.absent_at 주석이
-- "증거팩은 별도 ops_no_show_evidence — 후속 슬라이스"라고 예고한 그 테이블이다.
-- 지금까지 노쇼는 absent_at 마킹 + tour_room_events.payload.evidence_url 문자열이
-- 전부였다(문자열은 위조 가능 → OTA 분쟁에서 증거력 없음).
--
-- 플랜 원문: "행 롱프레스 → [노쇼 처리] → 카메라 강제 실행(픽업지 현장 사진) +
-- GPS 좌표 + 타임스탬프 자동 첨부 → ops_no_show_evidence 저장(워터마크 사진 +
-- PDF, OTA 분쟁 대응). 증거 없는 노쇼 처리 불가 — 비가역 액션의 유일한 마찰
-- 지점(체크인은 무마찰, 노쇼만 증거 요구: 비대칭 마찰 원칙)."
--
-- 설계 결정 (코디네이터 확정):
--   1. 사진은 public 버킷 금지 — 분쟁 증거에 사람·현장이 찍힌다. 전용 private
--      버킷 `ops-evidence`에 올리고 조회는 단기(기본 10분) 서명 URL로만 한다.
--      그래서 이 테이블은 URL이 아니라 STORAGE PATH를 저장한다.
--   2. 원본(photo_path) + 워터마크본(watermarked_path) 둘 다 보관 —
--      원본 = 무결성, 워터마크본 = 제출용. sharp 합성 실패는 치명적이지 않으므로
--      watermarked_path는 NULL 허용(원본만으로도 증거는 성립).
--   3. captured_at(클라 신고값)과 recorded_at(서버 수신시각)을 분리 저장 —
--      기기 시계는 조작 가능하다. 분쟁 시 권위 있는 값은 recorded_at.
--   4. GPS는 필수 사실이되 우회로가 아니다: 좌표가 없으면
--      gps_unavailable_reason(필수 텍스트)이 그 사실을 기록으로 남긴다.
--      라우트가 (좌표 있음) XOR (사유 있음)을 강제하고, DB도 CHECK로 막는다.
--   5. PDF 자동생성은 하지 않는다(신규 npm 의존성 금지) — admin 인쇄용 증거
--      시트(@media print)에서 브라우저 인쇄 → PDF 저장으로 대체.
--
-- 컨벤션은 기존 ops_* 슬라이스와 동일:
--   ops_ prefix(additive만) / tenant_id text NOT NULL DEFAULT 'atockorea' /
--   RLS enabled + 정책 0개 + anon·authenticated 권한 회수(service-role 전용).
--
-- ⚠ 적용 금지 상태로 파일만 커밋. 적용은 사람 검토 후.
--
-- 기존 데이터 위반 사전 점검 (적용 전 실행 — 전부 0행이어야 하고, 어차피
-- 신규 테이블이라 백필/제약 소급이 없다는 것을 보이는 쿼리):
--
--   -- (a) 같은 이름의 테이블이 이미 있는가? → 0행이어야 create table 성공.
--   select to_regclass('public.ops_no_show_evidence') as already_exists;
--
--   -- (b) FK 대상 테이블·컬럼이 실제로 존재하는가? → 4행(각 1행) 나와야 함.
--   select table_name, column_name from information_schema.columns
--    where (table_name, column_name) in
--          (('tour_rooms','id'),('ops_room_vehicles','id'),
--           ('bookings','id'),('ops_seat_assignments','id'));
--
--   -- (c) 이 마이그레이션은 기존 행을 단 하나도 건드리지 않는다(ALTER/UPDATE
--   --     없음). 참고로 현재 노쇼 마킹 건수 = 앞으로 "증거 없는 레거시 노쇼"가
--   --     될 수 있는 모집단(해제/재처리는 사람 판단):
--   select count(*) as legacy_absent_rows
--     from ops_seat_assignments where absent_at is not null;

-- ============================================================================
-- ops_no_show_evidence — 노쇼 1건 = 증거 1행 (§5.4b D12)
-- ============================================================================
create table ops_no_show_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  room_id uuid not null references tour_rooms(id) on delete cascade,
  room_vehicle_id uuid not null references ops_room_vehicles(id) on delete cascade,
  seat_number int not null check (seat_number > 0),
  booking_id uuid not null references bookings(id) on delete cascade,
  -- 좌석 배정 행이 나중에 지워져도 증거는 남는다(분쟁 대응) → SET NULL.
  seat_assignment_id uuid references ops_seat_assignments(id) on delete set null,

  -- 마스킹된 표시명 ("Massimo C.") — 생 PII 금지 (§5.2 마스킹 스타일).
  guest_label text,

  -- private 버킷 `ops-evidence` 내부 경로. URL이 아니다 (서명 URL은 조회 시 발급).
  photo_path text not null,
  -- sharp 오버레이 합성본. 합성 실패 시 null (원본만으로도 증거 성립).
  watermarked_path text,

  -- 클라이언트가 신고한 촬영시각. 기기 시계는 조작 가능 → 참고값.
  captured_at timestamptz not null,
  -- 서버 수신시각 = 권위 있는 타임스탬프.
  recorded_at timestamptz not null default now(),

  latitude double precision,
  longitude double precision,
  accuracy_m int,
  -- 좌표를 못 받은 이유(기기 거부/실패). 좌표가 없으면 필수.
  gps_unavailable_reason text,

  -- 기록자: 토큰 actor는 participant id가 없어 null일 수 있다(역할은 항상 기록).
  actor_role text check (actor_role in ('guide','driver','admin')),
  actor_participant_id uuid,
  device_user_agent text,

  -- 스태프 자유 메모 (예: "픽업지 10분 대기 후 출발").
  note text,

  created_at timestamptz not null default now(),

  -- 좌표 범위 위생 (클라가 보낸 값을 DB에서도 한 번 더 막는다).
  constraint ops_no_show_evidence_lat_range
    check (latitude is null or (latitude >= -90 and latitude <= 90)),
  constraint ops_no_show_evidence_lng_range
    check (longitude is null or (longitude >= -180 and longitude <= 180)),
  -- 설계 결정 4: 좌표가 없으면 "왜 없는지"가 반드시 기록된다.
  constraint ops_no_show_evidence_gps_or_reason
    check (
      (latitude is not null and longitude is not null)
      or (gps_unavailable_reason is not null and length(btrim(gps_unavailable_reason)) > 0)
    )
);

-- 노쇼 강제 검사(라우트가 매 mark마다 도는 조회) = (차량, 좌석) 룩업.
create index ops_no_show_evidence_seat_idx
  on ops_no_show_evidence (room_vehicle_id, seat_number);
-- admin 인쇄용 증거 시트 = 룸 단위 최신순.
create index ops_no_show_evidence_room_idx
  on ops_no_show_evidence (room_id, recorded_at desc);
create index ops_no_show_evidence_booking_idx
  on ops_no_show_evidence (booking_id);

comment on table ops_no_show_evidence is
  '노쇼 증거팩 (§5.4b D12). 사진(private 버킷 경로)+GPS+타임스탬프 = 비가역 노쇼 처리의 유일한 마찰 지점. 증거 행이 없으면 absent 라우트가 400 evidence_required.';
comment on column ops_no_show_evidence.photo_path is
  'private 버킷 ops-evidence 내부 경로 (원본, 무결성용). 조회는 단기 서명 URL로만.';
comment on column ops_no_show_evidence.watermarked_path is
  '촬영시각·GPS·좌석·게스트를 구워넣은 제출용 합성본. sharp 실패 시 null.';
comment on column ops_no_show_evidence.captured_at is
  '클라이언트 신고 촬영시각(기기 시계 — 참고값). 권위 있는 값은 recorded_at.';
comment on column ops_no_show_evidence.gps_unavailable_reason is
  '좌표를 못 받은 사유. "GPS 없음"도 기록된 사실이지 우회로가 아니다(CHECK 강제).';

-- ============================================================================
-- RLS — service-role 전용. RLS enabled + 정책 0개 + 클라이언트 role 권한 회수.
-- 증거 사진 경로는 anon에게 절대 새어 나가면 안 된다 (서명 URL만이 유일한 창구).
-- ============================================================================
alter table ops_no_show_evidence enable row level security;
revoke all on ops_no_show_evidence from anon, authenticated;

-- ============================================================================
-- End. Verify after apply:
--   1. table exists, RLS enabled, policies = 0
--   2. anon/authenticated cannot select ops_no_show_evidence
--   3. Storage: private 버킷 `ops-evidence` (public=false) — 코드가 없으면
--      createBucket({public:false})로 자동 생성한다. 대시보드에서 만들 때도
--      반드시 Public 체크 해제.
--   4. 적용 후 노쇼 마킹은 증거 없이는 400 evidence_required (의도된 하드 게이트)
--      — 이 마이그레이션 적용이 UI 배포보다 먼저여야 한다.
-- ============================================================================
