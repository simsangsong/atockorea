-- 관제센터 W1 — 차량 마스터 (`docs/ops-center-settlement-upgrade-plan-2026-07-25.md` §2)
--
-- 배경: 차량 배차는 `ops_room_vehicles` 한 테이블로만 돌아간다. 그 테이블은 "이 룸에
-- 이 배치도의 차가 붙었다"는 **인스턴스** 기록이고, 실제 차량의 정체는
-- `plate_number text` 자유 입력뿐이다. 그래서 "12가3456이 8월 3일에 두 투어에 동시
-- 배차됐는가"를 물어볼 대상이 없다 — 물어볼 **행**이 없기 때문이다. 오탈자('12가3456'
-- vs '12가 3456')가 두 대의 다른 차가 되는 것도 같은 이유다.
--
-- 이 슬라이스는 그 정체를 1행으로 만든다. 배차 달력의 충돌 판정, 정원 검증,
-- 오토파일럿의 '차량 미배차' 탐지가 전부 이 테이블을 축으로 삼는다.
--
-- 설계 결정:
--   1. **기존 `plate_number` 텍스트를 지우지 않는다.** 마스터에 없는 차(용차·대차)의
--      기록이 조용히 사라지면 안 된다. `vehicle_id`가 있으면 마스터가 정본이고,
--      없으면 텍스트가 그대로 표시된다. 백필도 하지 않는다 — 자동 문자열 매칭으로
--      "아마 이 차일 것"을 만들어내는 것이 오배차보다 위험하다.
--   2. `seat_capacity`는 NULL 허용이고 NULL = 레이아웃의 `total_seats` 상속. 실차가
--      개조돼 좌석이 다른 경우에만 값을 넣는다. 0을 기본값으로 두면 "정원 미상"과
--      "정원 0"이 구별되지 않는다.
--   3. 삭제는 소프트(`active=false`)를 기대한다 — 배차 이력이 걸린 차를 물리 삭제하면
--      과거 배차가 고아가 된다. FK는 그래서 ON DELETE SET NULL(하드 삭제가 일어나도
--      룸 배차 행 자체는 살아남는다).
--   4. 기사(`driver_name`/`driver_phone`)는 차량에 딸린 **기본값**이다. 당일 다른 기사가
--      운행하면 `ops_room_vehicles.driver_name`이 이긴다(이미 존재하는 컬럼).
--
-- 컨벤션은 기존 ops_* 슬라이스와 동일:
--   ops_ prefix(additive만) / tenant_id text NOT NULL DEFAULT 'atockorea' /
--   RLS enabled + 정책 0개 + anon·authenticated 권한 회수(service-role 전용).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 적용 전 점검 (기대값 주석):
--   -- (a) 이름 충돌 → NULL 이어야 create 성공
--   select to_regclass('public.ops_vehicles') as t_vehicles;
--   -- (b) 백필 대상 모집단 (자동 이관하지 않는다 — 참고용)
--   select count(*) as room_vehicle_rows, count(plate_number) as with_plate
--     from ops_room_vehicles;
--   -- (c) 적용 후: RLS on + 정책 0
--   select relname, relrowsecurity,
--          (select count(*) from pg_policies p where p.tablename = c.relname) as policies
--     from pg_class c where relname = 'ops_vehicles';
-- ─────────────────────────────────────────────────────────────────────────────

create table ops_vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  -- 번호판이 차량의 자연키다. 공백·하이픈은 애플리케이션이 정규화해서 넣는다
  -- (normalizePlate) — DB는 정규화된 값만 본다.
  plate_number text not null,

  -- 표준 배치도. 좌석맵·정원의 기본 출처.
  layout_id uuid references ops_vehicle_layouts(id) on delete set null,

  -- '흰색 카운티', '2호차' 처럼 현장에서 부르는 이름. 번호판보다 기억하기 쉽다.
  nickname text,

  -- 설계 결정 2: NULL = 레이아웃 total_seats 상속. 값이 있으면 그것이 이긴다.
  seat_capacity int check (seat_capacity is null or seat_capacity > 0),

  -- 설계 결정 4: 차량의 기본 기사. 당일 배차의 driver_name 이 있으면 그쪽이 이긴다.
  driver_name text,
  driver_phone text,

  active boolean not null default true,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 같은 테넌트에 같은 번호판 2행 = 중복 배차 감지가 무의미해진다.
  unique (tenant_id, plate_number)
);

-- 목록 기본 정렬 = 운행 중인 차량 번호판순.
create index ops_vehicles_active_idx on ops_vehicles (tenant_id, active, plate_number);

comment on table ops_vehicles is
  '차량 마스터 (관제 W1). ops_room_vehicles 는 "이 룸에 붙은 차"라는 인스턴스이고, 여기가 "그 차가 무엇인가"의 단일 소스 — 중복 배차 감지의 축.';
comment on column ops_vehicles.plate_number is
  '정규화된 번호판(공백·하이픈 제거). 애플리케이션 normalizePlate 가 유일한 정규화 지점.';
comment on column ops_vehicles.seat_capacity is
  'NULL = ops_vehicle_layouts.total_seats 상속. 실차 개조로 좌석수가 다를 때만 채운다 — 0을 기본값으로 두면 "정원 미상"과 "정원 0"이 구별되지 않는다.';
comment on column ops_vehicles.driver_name is
  '차량 기본 기사. 당일 대차 기사는 ops_room_vehicles.driver_name 이 우선한다.';

-- ============================================================================
-- 배차 인스턴스 → 마스터 연결 (additive, NULL 허용)
--   설계 결정 1: 기존 plate_number 는 남는다. 백필하지 않는다.
-- ============================================================================
alter table ops_room_vehicles
  add column vehicle_id uuid references ops_vehicles(id) on delete set null;

-- 배차 달력의 축 조회 = (차량, 날짜). 날짜는 룸/그룹 조인으로 오므로 여기선 차량만.
create index ops_room_vehicles_vehicle_idx
  on ops_room_vehicles (vehicle_id) where vehicle_id is not null;

comment on column ops_room_vehicles.vehicle_id is
  '차량 마스터 참조. NULL = 마스터 미등록(용차·대차) — 그 경우 plate_number 텍스트가 표시 정본이다.';

-- ============================================================================
-- RLS — service-role 전용 (기존 ops_* 와 동일 규약).
-- 기사 전화번호가 PII라 anon/authenticated 에 열 이유가 없다.
-- ============================================================================
alter table ops_vehicles enable row level security;
revoke all on ops_vehicles from anon, authenticated;

-- ============================================================================
-- End. Verify after apply:
--   1. ops_vehicles 존재, RLS on, 정책 0
--   2. ops_room_vehicles.vehicle_id 컬럼 존재 + 전 행 NULL (백필 없음)
--   3. anon/authenticated 로 select 불가
-- ============================================================================
