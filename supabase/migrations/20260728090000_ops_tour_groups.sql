-- 앱 전반 감사 플랜 §K B0.1 — 조인투어 마스터 룸(그룹)
--
-- 배경 (B0-D3): 마스터 룸이 실체가 없다. 지금 "조인투어"는 `(tour_id, tour_date)`가
-- 같은 예약들의 암묵적 묶음일 뿐이고, 차량은 `ops_room_vehicles.room_id`로
-- **그 중 임의의 한 예약 룸**에 매달려 있다.
--
-- 🔴 라이브 FK 실측이 이게 왜 결함인지 말해준다:
--     bookings ──CASCADE──> tour_rooms ──CASCADE──> ops_room_vehicles
--                                                      ├─CASCADE─> ops_seat_assignments
--                                                      └─CASCADE─> ops_no_show_evidence
--   앵커가 된 예약 1건을 취소·삭제하면 **조인투어 전체의 차량 + 남의 좌석 +
--   남의 노쇼 증거**가 함께 사라진다. 노쇼 증거는 시스템이 "증거 없으면 absent 400"으로
--   강제 수집한 분쟁 대응 산출물이다(A-plan-review R4 — 플랜은 좌석까지만 적었다).
--
-- 앵커가 임의라는 것 자체가 결함이므로, 안정적인 앵커를 만든다:
--   ops_tour_groups = (tour_id, tour_date) 1행. 여기에 차량·정원·상태가 걸린다.
--
-- 예약당 `tour_rooms`는 **채팅·개인 카드 평면으로 그대로 유지한다**(D2 additive,
-- 기존 동작 무변경). 룸을 그룹으로 합치지 않는다 — `tour_rooms.booking_id`가
-- NOT NULL UNIQUE라 룸은 예약당 1개이고, 그게 개인 카드가 사는 방식이다.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 적용 전 점검 (기대값):
--
--   -- (a) 테이블이 이미 있는가? → 0
--   select count(*) from information_schema.tables
--    where table_schema='public' and table_name='ops_tour_groups';
--
--   -- (b) 백필 모집단과 위반 가능성 → 실측 2026-07-24: vehicles=0, seats=0, rooms=1
--   select (select count(*) from ops_room_vehicles) as vehicles,
--          (select count(*) from ops_seat_assignments) as seats,
--          (select count(*) from tour_rooms) as rooms,
--          (select count(*) from tour_rooms where tour_id is null or tour_date is null) as unresolvable;
--   -- unresolvable > 0 이면 그 룸의 차량은 그룹을 못 받는다(= group_id NULL로 남는다).
--   -- 지금은 0이므로 백필 손실 없음.

-- ============================================================================
-- 1. ops_tour_groups — 마스터 룸
-- ============================================================================
create table if not exists ops_tour_groups (
  id uuid primary key default gen_random_uuid(),
  -- §2 명명 규칙: 모든 ops_* 는 tenant_id DEFAULT 'atockorea'.
  tenant_id text not null default 'atockorea',

  -- 그룹의 정체성. 이 둘이 같으면 같은 그룹이고, 그게 조인투어의 정의다.
  -- tours가 지워지면 그 상품의 그룹은 의미가 없다 → CASCADE.
  -- (예약 삭제와 달리 상품 삭제는 드물고, 남겨도 되살릴 대상이 없다.)
  tour_id uuid not null references tours(id) on delete cascade,
  tour_date date not null,

  -- B2-D3 — **그날 그 그룹만의 예외** 정원. NULL이 정상이고, 그때는 상품값
  -- (tours.max_room_guests)을 따른다. 운영자가 명시적으로 넣었을 때만 값이 산다.
  -- 해석 순서는 B2.1b가 코드 한 곳에 고정한다.
  capacity int check (capacity is null or capacity > 0),

  -- 시작 게이트가 그룹 단위로 올라온다(B0.4).
  status text not null default 'planned'
    check (status in ('planned', 'started', 'ended', 'cancelled')),
  started_at timestamptz,
  ended_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- B0-D4 파생 생성(ensureTourGroup)의 upsert 대상. 사람이 만드는 엔티티는
  -- 반드시 빠뜨려지므로 수동 생성 UI를 두지 않는다.
  constraint ops_tour_groups_unique unique (tour_id, tour_date)
);

create index if not exists ops_tour_groups_date_idx
  on ops_tour_groups (tenant_id, tour_date);

alter table ops_tour_groups enable row level security;
revoke all on ops_tour_groups from anon, authenticated;

comment on table ops_tour_groups is
  '§K B0 마스터 룸. (tour_id, tour_date) 1행. 차량·정원·시작게이트가 여기 걸린다. 예약당 tour_rooms는 채팅·개인 카드 평면으로 유지(D2 additive). ensureTourGroup()이 파생 생성하며 수동 생성 UI는 없다.';
comment on column ops_tour_groups.capacity is
  'B2-D3 그날 그 그룹만의 예외 정원. NULL = 상품값(tours.max_room_guests) 상속. 해석 순서는 lib/ops/seating/capacity.ts 한 곳에 있다.';

-- ============================================================================
-- 2. ops_room_vehicles를 그룹 소유로 (additive + 백필)
-- ============================================================================
alter table ops_room_vehicles
  add column if not exists group_id uuid references ops_tour_groups(id) on delete cascade;

-- 차량이 걸려 있는 (tour_id, tour_date)마다 그룹을 만든다.
insert into ops_tour_groups (tour_id, tour_date)
select distinct r.tour_id, r.tour_date
  from ops_room_vehicles v
  join tour_rooms r on r.id = v.room_id
 where r.tour_id is not null and r.tour_date is not null
on conflict (tour_id, tour_date) do nothing;

update ops_room_vehicles v
   set group_id = g.id
  from tour_rooms r
  join ops_tour_groups g on g.tour_id = r.tour_id and g.tour_date = r.tour_date
 where v.room_id = r.id and v.group_id is null;

create index if not exists ops_room_vehicles_group_idx
  on ops_room_vehicles (group_id) where group_id is not null;

comment on column ops_room_vehicles.group_id is
  'B0.1 — 차량의 진짜 소유자. room_id는 롤백 가능성을 위해 남긴 레거시 앵커이고, 새 코드는 이 컬럼을 쓴다.';

-- ── room_id를 치명적이지 않게 만든다 ────────────────────────────────────────
-- 이게 B0-D3가 고치려는 결함 그 자체다. NOT NULL과 CASCADE를 동시에 풀어야
-- "앵커 예약 삭제 → 그룹 전체 차량 소멸"이 끊긴다.
-- 컬럼은 지우지 않는다(B0-D5: 롤백 가능하게 기존 컬럼 유지).
alter table ops_room_vehicles alter column room_id drop not null;

alter table ops_room_vehicles drop constraint if exists ops_room_vehicles_room_id_fkey;
alter table ops_room_vehicles
  add constraint ops_room_vehicles_room_id_fkey
  foreign key (room_id) references tour_rooms(id) on delete set null;

comment on column ops_room_vehicles.room_id is
  '레거시 앵커(B0 이전). 이제 nullable + ON DELETE SET NULL — 임의의 한 예약이 삭제돼도 차량과 남의 좌석이 함께 사라지지 않는다. 소유는 group_id가 갖는다.';

-- 완전히 떠 있는 차량 행이 새로 생기는 것은 막는다(기존 행 정리는 아니다).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ops_room_vehicles_anchor_present') then
    alter table ops_room_vehicles
      add constraint ops_room_vehicles_anchor_present
      check (group_id is not null or room_id is not null);
  end if;
end $$;

-- ============================================================================
-- 3. 노쇼 증거가 남의 삭제로 사라지지 않게 (A-plan-review R4)
-- ============================================================================
-- evidence.booking_id → bookings CASCADE 는 유지한다: 자기 예약이 지워질 때
-- 자기 증거가 지워지는 것은 옳다. 문제는 **남의 예약**이 앵커였을 때
-- room_vehicle_id를 타고 함께 지워지는 경로다.
alter table ops_no_show_evidence drop constraint if exists ops_no_show_evidence_room_vehicle_id_fkey;
alter table ops_no_show_evidence
  add constraint ops_no_show_evidence_room_vehicle_id_fkey
  foreign key (room_vehicle_id) references ops_room_vehicles(id) on delete set null;

comment on column ops_no_show_evidence.room_vehicle_id is
  'ON DELETE SET NULL (B0.1). 증거는 분쟁 대응 산출물이라 차량 행이 사라져도 남아야 한다 — 시스템이 "증거 없으면 absent 400"으로 강제 수집한 데이터다.';

-- ============================================================================
-- End. Verify after apply:
--   1. select count(*) from ops_tour_groups;                                  → 0 (차량 0건이라 백필 없음)
--   2. select is_nullable from information_schema.columns
--       where table_name='ops_room_vehicles' and column_name='room_id';       → YES
--   3. select rc.delete_rule from information_schema.referential_constraints rc
--       where rc.constraint_name in ('ops_room_vehicles_room_id_fkey',
--                                    'ops_no_show_evidence_room_vehicle_id_fkey');  → 둘 다 SET NULL
--   4. select count(*) from ops_room_vehicles where group_id is null;         → 0
--   5. select relrowsecurity from pg_class where relname='ops_tour_groups';   → t, 정책 0개
--   6. select has_table_privilege('anon','ops_tour_groups','SELECT');         → false
-- ============================================================================
