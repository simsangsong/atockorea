-- 앱 전반 감사 플랜 §K B4.1 — 명단 메모 (운영자 노트)
--
-- 요구: 명단에서 손님별로 짧은 메모를 남기고, 이름을 누르면 전문이 보인다.
--
-- 🔴 B4-D1 — **`needs`와 분리한다.** `needs`(알레르기·유모차 등)는 **손님이
-- 선언한 것**이고, 메모는 **운영자가 쓴 것**이다. 한 필드에 섞으면 누가 말한
-- 건지 알 수 없어지고, 그러면 알레르기 표시의 신뢰도가 떨어진다 — 명단에서
-- 알레르기 하이라이트가 갖는 의미가 오염된다. 그건 안전 문제다.
--
-- 🔴 B4-D2 — **예약당 짧은 노트 1개.** 스레드형 코멘트가 아니다.
-- 운전 중·승차 중에 읽는 물건이고, 스레드는 안 읽힌다. UNIQUE(booking_id)가
-- 그 결정을 스키마로 강제한다.
--
-- 🔴 B4-D3 — **보존기간을 건다.** 메모엔 개인정보가 들어간다("무릎이 안 좋으심").
-- `needs`와 동일하게 투어 후 30일 퍼지(플라이휠 크론에 1스텝 추가).
-- 무기한 보관할 이유가 없다.
--
-- B4-D4 — 표시 위치 3곳(명단 행·게스트 카드·관제 룸 드로어)이 **같은 소스**를
-- 읽는다. 테이블이 하나뿐인 것이 그 보장이다.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 적용 전 점검:
--   -- (a) 이미 있는가? → 0
--   select count(*) from information_schema.tables
--    where table_schema='public' and table_name='ops_guest_notes';
--   -- (b) 참조 대상 → 1
--   select count(*) from information_schema.tables
--    where table_schema='public' and table_name='bookings';

create table if not exists ops_guest_notes (
  id uuid primary key default gen_random_uuid(),
  -- §2 명명 규칙: 모든 ops_* 는 tenant_id DEFAULT 'atockorea'.
  tenant_id text not null default 'atockorea',

  -- B4-D2: 예약당 1개. 예약이 지워지면 메모도 지워진다(개인정보를 남길 이유가 없다).
  booking_id uuid not null references bookings(id) on delete cascade,

  -- 짧게. 명단 행에서 말줄임으로 보이고 카드에서 전문이 보이는 분량이다.
  note text not null check (char_length(note) between 1 and 500),

  -- 누가 마지막으로 고쳤나. 가이드·기사·admin 셋 다 쓸 수 있다.
  updated_by_role text not null check (updated_by_role in ('guide', 'driver', 'admin')),
  updated_by_name text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint ops_guest_notes_booking_unique unique (booking_id)
);

create index if not exists ops_guest_notes_updated_idx
  on ops_guest_notes (tenant_id, updated_at desc);

alter table ops_guest_notes enable row level security;

-- service-role 전용 (기존 ops_* 컨벤션): 정책 0개 + 클라이언트 role 권한 회수.
revoke all on ops_guest_notes from anon, authenticated;

comment on table ops_guest_notes is
  '§K B4 명단 메모. 예약당 1개(B4-D2). 손님이 선언한 needs와 분리된다(B4-D1) — 섞으면 알레르기 표시의 신뢰도가 떨어진다. 투어 후 30일 퍼지(B4-D3, 플라이휠 크론).';
comment on column ops_guest_notes.note is
  '운영자가 쓴 짧은 노트(최대 500자). 손님이 선언한 needs가 아니다. 손님에게 노출되지 않는다.';
comment on column ops_guest_notes.updated_by_role is
  '마지막 수정자 역할. 가이드가 쓴 것과 admin이 쓴 것을 구분해야 나중에 신뢰도를 판단할 수 있다.';

-- ============================================================================
-- End. Verify after apply:
--   1. select count(*) from information_schema.tables
--       where table_schema='public' and table_name='ops_guest_notes';   → 1
--   2. select relrowsecurity from pg_class where relname='ops_guest_notes'; → t
--   3. select count(*) from pg_policies where tablename='ops_guest_notes';  → 0
--   4. select has_table_privilege('anon','ops_guest_notes','SELECT');       → false
--   5. 빈 메모 거부 확인:
--      insert into ops_guest_notes (booking_id, note, updated_by_role)
--        values ((select id from bookings limit 1), '', 'guide');  → 반드시 실패
--   6. 적용 직후 0행.
-- ============================================================================
