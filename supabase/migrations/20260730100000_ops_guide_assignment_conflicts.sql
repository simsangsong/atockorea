-- 관제 W2 — 가이드 배정 충돌 차단 (`docs/ops-center-settlement-upgrade-plan-2026-07-25.md` §3)
--
-- 배경: `POST /api/admin/guides/assignments`는 검증 없이 insert 직행이었다. 유일한
-- 방어선인 `UNIQUE(guide_id, tour_date, booking_id)`는 **booking_id가 NULL이면 뚫린다**
-- — Postgres UNIQUE는 NULL을 서로 다른 값으로 보기 때문이다. 즉 예약이 아직 안 붙은
-- 배정(가장 흔한 초기 상태)은 같은 가이드·같은 날에 몇 개든 쌓였다.
--
-- 설계안 §1-1이 "DB 제약 + API 검증 **둘 다**"라고 못박은 이유가 이것이다. UI/API에만
-- 두면 동시 편집·다른 라우트·직접 SQL에서 조용히 뚫린다. 그래서 여기서는 **DB가
-- 최종 방어선**이고, API는 사람에게 읽히는 메시지를 만드는 계층이다.
--
-- 규칙 (하드 블록만 DB에 있다. 경고 5·6·7은 순수 함수 conflicts.ts + API 응답):
--   1. 같은 가이드·같은 날·**시간 겹침** → 블록. 오버라이드 가능.
--      양쪽 다 start/end가 있을 때만 판정한다 — 시각을 모르면서 "겹쳤다"고
--      단정하는 것은 거짓말이고, 그 거짓말은 정당한 연속 투어 배정을 막는다.
--   2. 같은 가이드·같은 날·같은 예약(**둘 다 NULL 포함**) → 블록. 오버라이드 불가.
--      NULL 구멍은 부분 유니크 인덱스가 막는다. 시각이 다르면 서로 다른 배정으로
--      인정한다 — 그래야 하루 두 탕이 가능하다.
--   3. 휴무일 배정 → 블록. 오버라이드 가능.
--   4. 비활성 가이드 → 블록. 오버라이드 **불가**(퇴사자에게 일을 줄 이유가 없다).
--
-- 오버라이드에 대해: `ops_guide_unavailable_dates`의 원래 주석은 "배정을 차단하지
-- 않는다(trust-based NOTICE)"였다. 그 판단은 현장 재량을 지키려는 것이었고 옳다 —
-- 그래서 차단을 없애는 대신 **사유를 남기고 통과하는 문**을 뒀다. 막지 않으면 실수를
-- 못 잡고, 사유 없이 막으면 현장이 못 돈다. 사유는 감사 추적이 된다.
--
-- ⚠ 시간 컬럼은 배정 원장에 **비정규화**한다. 실사용 시각은 `bookings.tour_time`에
-- 있지만 (a) booking_id가 NULL인 배정이 흔하고 (b) 트리거가 조인을 타면 예약 시각
-- 변경이 과거 배정의 유효성을 소급해서 뒤집는다. 배정 시점의 시각을 그대로 붙잡아
-- 두는 것이 판정을 결정론적으로 만든다(API가 booking에서 읽어 채워 준다).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 적용 전 점검 (기대값 주석):
--   -- (a) 새 제약을 위반할 기존 행이 있는가? → 0 이어야 무해하게 적용된다.
--   select count(*) from (
--     select guide_id, tour_date, count(*) c
--       from ops_guide_assignments
--      where booking_id is null and status <> 'cancelled'
--      group by 1,2 having count(*) > 1) x;             -- 기대: 0
--   select count(*) from ops_guide_assignments a
--     join ops_guide_unavailable_dates u
--       on u.guide_id = a.guide_id and u.date = a.tour_date
--    where a.status <> 'cancelled';                      -- 기대: 0 (있으면 오버라이드 표시 필요)
--   -- (b) 적용 후: 트리거 1개 + 부분 유니크 인덱스 1개
--   select tgname from pg_trigger where tgrelid = 'ops_guide_assignments'::regclass and not tgisinternal;
-- ─────────────────────────────────────────────────────────────────────────────

alter table ops_guide_assignments
  -- 배정 시점의 투어 시각 스냅샷. NULL = 시각 미상(= 겹침 판정 대상 아님).
  add column if not exists start_time time,
  add column if not exists end_time   time,
  -- 감사: 누가 언제 배정했는가. uuid 대신 사람이 읽는 값(관리자 이메일)을 넣는다 —
  -- 조인해야 읽히는 감사 컬럼은 읽히지 않는다.
  add column if not exists assigned_by text,
  add column if not exists assigned_at timestamptz,
  -- 규칙 1·3을 사유와 함께 통과시키는 문.
  add column if not exists conflict_override boolean not null default false,
  add column if not exists conflict_override_reason text;

alter table ops_guide_assignments
  drop constraint if exists ops_guide_assignments_time_order;
alter table ops_guide_assignments
  add constraint ops_guide_assignments_time_order
    check (start_time is null or end_time is null or end_time > start_time);

-- 오버라이드는 사유 없이는 성립하지 않는다. 사유 없는 오버라이드는 감사 추적이
-- 아니라 그냥 꺼진 안전장치다.
alter table ops_guide_assignments
  drop constraint if exists ops_guide_assignments_override_needs_reason;
alter table ops_guide_assignments
  add constraint ops_guide_assignments_override_needs_reason
    check (conflict_override = false or nullif(btrim(coalesce(conflict_override_reason, '')), '') is not null);

comment on column ops_guide_assignments.start_time is
  '배정 시점의 투어 시작 시각 스냅샷(bookings.tour_time 등에서 복사). NULL = 미상 — 겹침 판정에서 제외된다.';
comment on column ops_guide_assignments.conflict_override is
  '휴무일·시간겹침 하드블록을 사유와 함께 통과. 비활성 가이드·완전중복은 오버라이드되지 않는다.';
comment on column ops_guide_assignments.assigned_by is
  '배정한 관리자(이메일). 사람이 읽는 값 — 조인 없이 감사가 가능해야 한다.';

-- ============================================================================
-- 규칙 2 — NULL booking_id 구멍 봉인
--   시각이 다르면 다른 배정으로 인정한다(하루 두 탕). 둘 다 시각이 없으면
--   서로 구별할 수 없는 같은 행이므로 중복이다.
-- ============================================================================
create unique index if not exists ops_guide_assignments_dateslot_uniq
  on ops_guide_assignments (tenant_id, guide_id, tour_date, coalesce(start_time, '00:00'::time))
  where booking_id is null and status <> 'cancelled';

-- ============================================================================
-- 규칙 1·3·4 — BEFORE 트리거
--   에러 메시지는 안정적인 **코드 문자열**이다. 라우트가 문자열 매칭으로 분기하고
--   한국어 문장을 만든다 — DB 문구를 바꿔도 API 계약이 깨지지 않게.
-- ============================================================================
create or replace function ops_guide_assignment_conflict_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active boolean;
  v_other  uuid;
begin
  -- 취소된 배정은 자리를 차지하지 않는다.
  if new.status = 'cancelled' then
    return new;
  end if;

  -- 규칙 4: 비활성 가이드. 오버라이드 불가.
  select g.active into v_active from ops_guides g where g.id = new.guide_id;
  if v_active is not null and v_active = false then
    raise exception 'assignment_guide_inactive'
      using errcode = '23514',
            detail  = format('guide=%s', new.guide_id);
  end if;

  -- 규칙 3: 휴무일. 오버라이드 가능.
  if not coalesce(new.conflict_override, false) then
    if exists (
      select 1 from ops_guide_unavailable_dates u
       where u.guide_id = new.guide_id
         and u.date = new.tour_date
    ) then
      raise exception 'assignment_guide_unavailable'
        using errcode = '23514',
              detail  = format('guide=%s date=%s', new.guide_id, new.tour_date);
    end if;
  end if;

  -- 규칙 1: 시간 겹침. 양쪽 다 시각이 있을 때만. 오버라이드 가능.
  if not coalesce(new.conflict_override, false)
     and new.start_time is not null and new.end_time is not null then
    select a.id into v_other
      from ops_guide_assignments a
     where a.tenant_id = new.tenant_id
       and a.guide_id  = new.guide_id
       and a.tour_date = new.tour_date
       and a.id       <> new.id
       and a.status   <> 'cancelled'
       and a.start_time is not null
       and a.end_time   is not null
       and a.start_time  < new.end_time
       and new.start_time < a.end_time
     limit 1;
    if v_other is not null then
      raise exception 'assignment_time_overlap'
        using errcode = '23514',
              detail  = format('conflicts_with=%s', v_other);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function ops_guide_assignment_conflict_guard() from public, anon, authenticated;

drop trigger if exists ops_guide_assignment_conflict_guard_trg on ops_guide_assignments;
create trigger ops_guide_assignment_conflict_guard_trg
  before insert or update on ops_guide_assignments
  for each row execute function ops_guide_assignment_conflict_guard();

comment on function ops_guide_assignment_conflict_guard() is
  '가이드 배정 하드 블록 (관제 W2 규칙 1·3·4). API 검증만으로는 동시 편집·직접 SQL에서 뚫리므로 DB가 최종 방어선이다. 예외 메시지는 라우트가 분기하는 안정 코드다.';

-- ============================================================================
-- End. Verify after apply:
--   1. 휴무일에 배정 insert → 'assignment_guide_unavailable'
--   2. 같은 가이드·날짜·booking NULL·시각 NULL 2건 → unique violation
--   3. conflict_override=true + 사유 → 1이 통과, 사유 없으면 CHECK 위반
-- ============================================================================
