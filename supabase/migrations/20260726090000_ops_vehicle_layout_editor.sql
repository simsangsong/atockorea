-- AtoC 통합 플랜 §5.3b — 관리자 배치도 에디터 (실차 사진 대조 게이트 + 차량별 오버라이드)
--
-- 배경: ops_vehicle_layouts에는 확정 5종(county_20/solati_16/limo_27/bus_35/bus_45)이
-- 시딩돼 있지만 편집 UI가 없다. §5.3b가 "정적 이미지 방식"을 기각한 근거의 절반이
-- "실차와 다른 배치를 발견하면 JSON 수정만으로 즉시 반영"인데, 현재는 그 수정이
-- raw SQL로만 가능하다(= 현장에서 못 고친다). 이 마이그레이션은 그 편집기가 필요로
-- 하는 두 가지 사실만 추가한다:
--
--   1. 배치도가 "실차 사진과 대조되었는가" (§5.3b 게이트).
--      사진 없이는 확정 불가 — is_verified는 reference_photo_path + verified_at이
--      함께 있어야만 true가 될 수 있고, DB CHECK가 그걸 강제한다.
--      사진은 ops_no_show_evidence와 동일한 정책: PUBLIC 버킷 금지, private 버킷
--      경로만 저장하고 조회는 단기 서명 URL. 차량 내부 사진에는 좌석·설비뿐
--      아니라 기사·손님이 찍힐 수 있다.
--   2. 특정 실차가 표준 모델 배치와 다를 때의 차량 단위 오버라이드
--      (§5.3b 마지막 줄 — "특정 차량이 표준 배치와 다르면 ops_room_vehicles 단위
--      오버라이드"). 표준 배치도 행은 절대 건드리지 않는다.
--
-- 부수적으로 ops_room_vehicles.driver_name을 추가한다. 기존 driver_participant_id는
-- 기사가 링크로 입장한 뒤에만 채울 수 있는데(참가자 행이 그때 생긴다), 배차는 보통
-- 그보다 먼저 확정된다. 배차 화면에서 "기사 미입장" 상태를 공백으로 두지 않기 위한
-- 라벨 컬럼이다 (연락처는 저장하지 않는다 — PII 최소화).
--
-- 컨벤션은 기존 ops_* 슬라이스와 동일: additive만(기존 컬럼·행 무변경),
-- RLS enabled + 정책 0개 유지(이 마이그레이션은 정책을 만들지 않는다).
--
-- ⚠ 적용 금지 상태로 파일만 커밋. 적용은 사람 검토 후.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 적용 전 점검 (기대값을 각 줄에 적어둔다):
--
--   -- (a) 대상 테이블이 존재하는가? → 2행.
--   select table_name from information_schema.tables
--    where table_schema='public' and table_name in ('ops_vehicle_layouts','ops_room_vehicles');
--
--   -- (b) 추가하려는 컬럼이 이미 있는가? → 0행이어야 한다(add column if not exists라 재실행 안전).
--   select table_name, column_name from information_schema.columns
--    where table_schema='public'
--      and (table_name, column_name) in (
--        ('ops_vehicle_layouts','is_verified'), ('ops_vehicle_layouts','verified_at'),
--        ('ops_vehicle_layouts','verified_by'), ('ops_vehicle_layouts','reference_photo_path'),
--        ('ops_room_vehicles','layout_override_json'), ('ops_room_vehicles','override_note'),
--        ('ops_room_vehicles','override_updated_at'), ('ops_room_vehicles','driver_name'));
--
--   -- (c) CHECK 소급 위반 가능성: is_verified는 default false로 들어오고 기존 행은
--   --     전부 false가 되므로 위반 0. 참고로 현재 배치도 행 수(=시드 5종):
--   select count(*) as layout_rows from ops_vehicle_layouts;
--
--   -- (d) 오버라이드 대상 모집단(현재 배차된 실차 수) — 전부 NULL로 시작한다.
--   select count(*) as room_vehicle_rows from ops_room_vehicles;

-- ============================================================================
-- 1. ops_vehicle_layouts — 실차 사진 대조 게이트 (§5.3b)
-- ============================================================================
alter table ops_vehicle_layouts
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  -- private 버킷 `ops-vehicle-refs` 내부 경로. URL이 아니다(조회는 서명 URL).
  add column if not exists reference_photo_path text;

-- 게이트의 본체: 사진과 확정시각 없이는 verified가 될 수 없다.
-- 애플리케이션(라우트)이 1차로 막고, DB가 최종 방어선이다.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ops_vehicle_layouts_verified_needs_photo'
  ) then
    alter table ops_vehicle_layouts
      add constraint ops_vehicle_layouts_verified_needs_photo
      check (
        is_verified = false
        or (reference_photo_path is not null
            and length(btrim(reference_photo_path)) > 0
            and verified_at is not null)
      );
  end if;
end $$;

comment on column ops_vehicle_layouts.is_verified is
  '실차 사진 대조 완료 여부 (§5.3b 게이트). 사진+확정시각 없이는 true 불가(CHECK). 배치도 JSON을 수정하면 라우트가 false로 되돌린다 — 재대조 필요.';
comment on column ops_vehicle_layouts.reference_photo_path is
  'private 버킷 ops-vehicle-refs 내부 경로 (실차 내부 사진). URL 아님 — 조회는 단기 서명 URL만.';
comment on column ops_vehicle_layouts.verified_by is
  '대조를 확정한 admin 사용자. 사람 판단의 책임 소재 (auth.users 삭제 시 SET NULL — 확정 사실 자체는 남는다).';

-- ============================================================================
-- 2. ops_room_vehicles — 차량 단위 배치도 오버라이드 (§5.3b 마지막 줄)
-- ============================================================================
alter table ops_room_vehicles
  -- NULL = 표준 모델 배치 그대로. 값이 있으면 이 실차에만 적용된다
  -- (ops_vehicle_layouts.layout_json은 절대 변경되지 않는다).
  add column if not exists layout_override_json jsonb,
  add column if not exists override_note text,
  add column if not exists override_updated_at timestamptz,
  -- 기사 입장 전(참가자 행 생성 전) 배차를 표시하기 위한 라벨. 연락처 미저장.
  add column if not exists driver_name text;

comment on column ops_room_vehicles.layout_override_json is
  '이 실차 전용 배치도 (§5.3b). NULL이면 ops_vehicle_layouts.layout_json 사용. 표준 배치도를 오염시키지 않고 한 대만 다르게 태울 때 쓴다.';
comment on column ops_room_vehicles.driver_name is
  '기사 표시명 (배차 시점 라벨). 기사가 링크로 입장하면 driver_participant_id가 채워지고 그쪽이 우선한다.';

-- ============================================================================
-- End. Verify after apply:
--   1. select column_name from information_schema.columns
--       where table_name='ops_vehicle_layouts' and column_name in
--         ('is_verified','verified_at','verified_by','reference_photo_path');  → 4행
--   2. select column_name from information_schema.columns
--       where table_name='ops_room_vehicles' and column_name in
--         ('layout_override_json','override_note','override_updated_at','driver_name'); → 4행
--   3. CHECK 동작: update ops_vehicle_layouts set is_verified=true where model='bus_45';
--      → 반드시 실패해야 한다 (사진 경로가 없으므로). 실패하면 게이트가 살아있다.
--   4. Storage: private 버킷 `ops-vehicle-refs` (public=false). 코드가 없으면
--      createBucket({public:false})로 자동 생성한다. 대시보드에서 만들 때도
--      Public 체크는 반드시 해제.
--   5. RLS: 정책 0개 그대로 (이 마이그레이션은 정책을 만들지 않는다).
-- ============================================================================
