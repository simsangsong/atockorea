-- AtoC 통합 Phase 2 slice 1 — ops seating foundation (좌석 데이터 모델)
-- Consolidation plan §5.3 (사전 좌석 지정), §5.3b (차량 배치도 라이브러리 D15 —
-- 웹 검증 확정 5종), §5.6 (신규 데이터 모델, additive).
--
-- Deliberate choices (ops_parse_stack 마이그레이션과 동일 패턴):
--   1. ops_ table prefix — 기존 tour_room_* / bookings 절대 무변경, additive만.
--   2. tenant_id text NOT NULL DEFAULT 'atockorea' (B2B 발라내기 대비 컬럼만 유지).
--   3. RLS: service-role 전용 — RLS enabled, 정책 0개, anon/authenticated 권한 회수.
--      모든 접근은 서버측 service-role 클라이언트(RLS bypass)로만 이루어진다.
--   4. Realtime: ops_seat_assignments만 supabase_realtime publication에 추가
--      (게스트 실시간 좌석 잠금 — §5.3 C-10). 정책 0개 상태에서는
--      postgres_changes 구독이 아무 행도 전달하지 않으므로(SELECT RLS 강제),
--      게스트 실시간은 다음 슬라이스에서 (a) 스코프드 SELECT 정책 또는
--      (b) 서버 Broadcast 릴레이(D-1 패턴) 중 하나로 열어준다. publication
--      멤버십은 그 전제조건이라 여기서 미리 확보한다.
--
-- 배치도 시드는 이 파일에 포함하지 않는다 — scripts/seed-vehicle-layouts.ts
-- (idempotent upsert, lib/ops/seating/layouts.ts가 단일 소스).
--
-- ⚠ 적용 금지 상태로 파일만 커밋 (이번 슬라이스 범위). 적용은 사람 검토 후.

-- ============================================================================
-- ops_vehicle_layouts — 차량 배치도 라이브러리 (§5.3b D15 — 5종)
-- layout_json = {model, cols, fixtures:[{type,r,c,w?}], seats:[{n,r,c}]}
-- → 공용 components/ops/SeatMap.tsx가 SVG로 동적 렌더.
-- ============================================================================
create table ops_vehicle_layouts (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  -- county_20 | solati_16 | limo_27 | bus_35 | bus_45 (D15 확정 5종 — §5.3b)
  model text not null
    check (model in ('county_20','solati_16','limo_27','bus_35','bus_45')),
  -- 기존 content_locales 키 체계 (en/ko/zh/zh-TW/es/ja + 확장)
  display_name jsonb not null,
  layout_json jsonb not null,
  total_seats int not null check (total_seats > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- idempotent 시드(onConflict) + "표준 배치는 tenant당 model 1개" 불변식.
create unique index ops_vehicle_layouts_tenant_model_idx
  on ops_vehicle_layouts (tenant_id, model);

comment on table ops_vehicle_layouts is
  '차량 배치도 라이브러리 (§5.3b — 웹 검증 확정 5종). layout_json → SeatMap SVG 동적 렌더. 실차와 다르면 JSON 수정만으로 즉시 반영.';

-- ============================================================================
-- ops_room_vehicles — 룸 ↔ 실제 차량 (복수 차량 조인투어 대비, §5.6)
-- ============================================================================
create table ops_room_vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  room_id uuid not null references tour_rooms(id) on delete cascade,
  layout_id uuid not null references ops_vehicle_layouts(id),
  plate_number text,
  -- 기사 participant (tour_room_participants). FK 없음 — 기사 배정 전/후
  -- participant 수명주기와 독립 (§5.6 스키마 그대로).
  driver_participant_id uuid,

  created_at timestamptz not null default now()
);

create index ops_room_vehicles_room_idx on ops_room_vehicles (room_id);
create index ops_room_vehicles_layout_idx on ops_room_vehicles (layout_id);

comment on table ops_room_vehicles is
  '룸에 배정된 실제 차량 (복수 차량 조인투어 대비). 특정 실차가 표준 배치와 다르면 이 단위에서 오버라이드(§5.3b 관리자 에디터, 후속).';

-- ============================================================================
-- ops_seat_assignments — 좌석 지정/체크인 단일 소스 (§5.6, §5.4b 단일 소스 원칙)
-- 좌석판·명단·카운터가 전부 이 테이블 하나를 구독한다.
-- ============================================================================
create table ops_seat_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  room_vehicle_id uuid not null references ops_room_vehicles(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  participant_id uuid references tour_room_participants(id) on delete set null,
  seat_number int not null check (seat_number > 0),
  -- "Massimo C." (party 내 좌석별 라벨)
  guest_label text,

  assigned_at timestamptz default now(),
  checked_in_at timestamptz,
  -- 체크인 3경로 (§5.4 C-13) — 전부 동일 서버 엔드포인트로 수렴.
  checkin_actor text
    check (checkin_actor in ('guest_qr','guest_app','guide_manual')),
  -- 노쇼 처리 시각 (증거팩은 별도 ops_no_show_evidence — 후속 슬라이스).
  absent_at timestamptz,
  -- 투어 시작 시 잠금 (§5.4 C-16) + 체크인 시작 후 변경 금지 (C-11).
  locked boolean default false,

  -- 동시성 서버 단 제약 (§5.3 C-10): 레이스 시 후착 요청 409.
  unique (room_vehicle_id, seat_number)
);

create index ops_seat_assignments_booking_idx on ops_seat_assignments (booking_id);
create index ops_seat_assignments_participant_idx on ops_seat_assignments (participant_id);

comment on table ops_seat_assignments is
  '좌석 지정+체크인 단일 소스 (§5.6). UNIQUE(room_vehicle_id, seat_number)로 동시 선점 방지. 시작 게이트 = 전 좌석 {checked_in | absent} (C-15).';

-- ============================================================================
-- RLS — service-role 전용. RLS enabled + 정책 0개 + 클라이언트 role 권한 회수.
-- service_role은 RLS를 bypass하므로 서버 코드만 접근 가능.
-- ============================================================================
alter table ops_vehicle_layouts enable row level security;
alter table ops_room_vehicles enable row level security;
alter table ops_seat_assignments enable row level security;

revoke all on ops_vehicle_layouts from anon, authenticated;
revoke all on ops_room_vehicles from anon, authenticated;
revoke all on ops_seat_assignments from anon, authenticated;

-- ============================================================================
-- Realtime publication — ops_seat_assignments (게스트 실시간 좌석 잠금, C-10).
-- 기존 패턴 그대로 (20260626000000_realtime_enable_* / 20260714091000 §5).
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'ops_seat_assignments'
  ) then
    alter publication supabase_realtime add table public.ops_seat_assignments;
  end if;
end $$;

-- ============================================================================
-- End. Verify after apply:
--   1. 3 tables exist, RLS enabled, no policies (service-role only)
--   2. anon/authenticated cannot select any ops_* seating table
--   3. ops_seat_assignments in supabase_realtime publication
--   4. seed: npx tsx scripts/seed-vehicle-layouts.ts (idempotent, 5 rows)
-- ============================================================================
