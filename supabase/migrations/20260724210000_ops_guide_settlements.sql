-- AtoC 통합 플랜 §6.9 — 가이드 배정 원장 + 월 정산(3.3% 원천징수) + 세무 서식
--
-- 배경 (이 마이그레이션이 존재하는 진짜 이유):
--   앞 슬라이스가 가이드 프로필·단가·휴무 원장을 만들었지만, **"이 가이드가 이 달에
--   어떤 투어를 했는가"의 소스가 어디에도 없었다.** tour_rooms에는 guide_id가 없고
--   (booking_id/tour_id/tour_date만), 가이드는 지금까지 tour_room_invites로 링크를
--   발급받는 존재였을 뿐이다. 배정은 사람 머릿속에서만 일어났고, 그래서 월 정산
--   배치를 만들 수 없었다. 이 마이그레이션이 그 빠진 원장(ops_guide_assignments)을
--   만들고, 그 위에 월 정산 스냅샷(ops_guide_settlements)을 얹는다.
--
-- 설계 결정 (코디네이터 확정 — 코드와 동일한 계약):
--   1. 3.3% 산식은 kursoflow(`src/lib/tax/withholding.ts`)에서 **포팅**한 것이다.
--      소득세 = floor(gross × 3 / 100), 지방소득세 = floor(소득세 / 10), 전부 정수
--      연산. 재계산·재작성 금지 — 부동소수로 다시 쓰면 원단위가 틀어진다.
--   2. **실비변상은 원천징수 대상이 아니다.** gross(용역대가)에 합산하지 않고
--      reimbursement_krw 별도 컬럼으로 지급만 한다. 정산 화면·서식도 두 줄로 나눈다.
--      ⚠ tour_room_extras는 이 컬럼의 소스가 **아니다** — 그 테이블은 손님이 당일
--      가이드에게 현금으로 갚는 rail(캡슐 문구 "당일 가이드에게 현금 정산해요")이라
--      회사→가이드 실비변상으로 옮겨 적으면 가이드가 이중으로 받는다. 그래서 배치는
--      reimbursement_krw를 건드리지 않고, 사람이 정산 화면에서 직접 입력한다.
--   3. 업종코드 940927(관광통역안내사). 940916이 아니다 — kursoflow 확정 사항.
--   4. status='worked'인 배정만 정산 대상. "실제로 일했다"를 사람이 확인한 것만
--      돈이 된다. planned/cancelled는 집계에서 빠진다.
--   5. 멱등의 뿌리는 UNIQUE(tenant_id, guide_id, period) 하나다. 같은 달을 몇 번
--      정산해도 가이드당 1행이며, 금액은 갱신되되 행이 늘지 않는다.
--   6. 금액은 전부 정수 KRW(원). 반올림·평균 없음. 세 개의 CHECK가 항등식
--      (소득세+지방세=원천징수 / gross−원천징수=net / net+실비=실지급)을 DB에서
--      강제한다 — 애플리케이션 버그가 장부를 조용히 어긋나게 두지 않는다.
--   7. 🔴 D10: 비가역 대외 액션 없음. 이 스키마 어디에도 "제출/신고/이체"가 없다.
--      ops_guide_settlements.status='paid'는 사람이 지급을 마친 뒤 남기는 **사후
--      기록**이지, 시스템이 돈을 보냈다는 뜻이 아니다.
--
-- 컨벤션은 기존 ops_* 슬라이스와 동일:
--   ops_ prefix(additive만) / tenant_id text NOT NULL DEFAULT 'atockorea' /
--   RLS enabled + 정책 0개 + anon·authenticated 권한 회수(service-role 전용).
--
-- ⚠ 적용 금지 상태로 파일만 커밋. 적용은 사람 검토 후.
--
-- ---------------------------------------------------------------------------
-- 기존 데이터 위반 사전 점검 (적용 전 실행 — 기대값을 각 줄에 적어둔다)
-- ---------------------------------------------------------------------------
--
--   -- (a) 같은 이름의 테이블이 이미 있는가? → 2개 전부 NULL이어야 create 성공.
--   select to_regclass('public.ops_guide_assignments') as t_assignments,
--          to_regclass('public.ops_guide_settlements') as t_settlements;
--
--   -- (b) FK 대상이 전부 존재하는가? → 4개 전부 non-NULL이어야 함.
--   select to_regclass('public.ops_guides')        as t_guides,
--          to_regclass('public.bookings')          as t_bookings,
--          to_regclass('public.tour_rooms')        as t_rooms,
--          to_regclass('public.ops_entity_ledger') as t_ledger;
--
--   -- (c) 원장 type 어휘 확인 — 가이드 지급은 기존 'expense'를 재사용한다.
--   --     ('revenue','commission','remit','fee','expense')가 나와야 함.
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'ops_entity_ledger'::regclass and conname like '%type%';
--
--   -- (d) 정산 첫 달의 모집단 미리보기 — 지금은 0행이 정상이다(배정 원장이
--   --     이 마이그레이션으로 처음 생기므로). 적용 후 배정을 입력하면 채워진다.
--   select count(*) as rooms_this_month from tour_rooms
--    where tour_date >= date_trunc('month', (now() at time zone 'Asia/Seoul')::date)::date;
--
--   -- (e) 이 마이그레이션은 기존 행을 하나도 수정하지 않는다(UPDATE/DELETE 없음).
--   --     쓰기는 ops_filing_calendar 시드 insert … on conflict do nothing 뿐.
--   select count(*) as existing_filings from ops_filing_calendar;
--
--   -- (f) 적용 후 검증: 정책 0개 + RLS on 이어야 함.
--   select relname, relrowsecurity,
--          (select count(*) from pg_policies p where p.tablename = c.relname) as policies
--     from pg_class c
--    where relname in ('ops_guide_assignments','ops_guide_settlements');

-- ============================================================================
-- 1. ops_guide_assignments — 가이드 × 투어 배정 원장 (이 슬라이스의 선결 과제)
-- ============================================================================
create table ops_guide_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  -- 🔴 on delete restrict: 정산 증빙이다. 가이드 프로필을 지웠다고 "누구에게
  -- 얼마를 왜 지급했는가"가 사라지면 세무 대응이 불가능해진다. 은퇴는 삭제가
  -- 아니라 ops_guides.active = false로 한다(가이드 DELETE 라우트의 기본 동작).
  guide_id uuid not null references ops_guides(id) on delete restrict,

  -- 예약/룸 참조는 있으면 좋고 없어도 되는 부가정보다(현장 배정·대체 투입 등
  -- 예약과 1:1로 안 떨어지는 배정이 실제로 있다). 원장의 본체는 아래 3개
  -- (guide_id, tour_date, tour_type)이고 그것만으로 정산이 성립한다.
  booking_id uuid references bookings(id) on delete set null,
  room_id uuid references tour_rooms(id) on delete set null,

  -- KST 투어일. 단가 해석(effective_from <= tour_date 중 최신)의 기준이자
  -- 월 정산 기간 산정의 기준.
  tour_date date not null,

  -- ops_guide_rates.tour_type과 같은 어휘('private' / 'bus' / 'cruise' …).
  -- 단가를 이 값으로 푼다 — 어휘가 어긋나면 단가 미해석으로 보고된다(0원 아님).
  tour_type text not null,

  role text not null default 'guide' check (role in ('guide', 'driver', 'both')),

  -- 확정 단가 스냅샷. NULL이면 정산 시 ops_guide_rates에서 해석한다.
  -- 값이 들어 있으면(0 포함) 그것이 이긴다 — 단가표와 다른 금액으로 합의한
  -- 건이 실제로 있고, 그 합의가 나중의 단가표 변경으로 흔들리면 안 되기 때문.
  amount_krw int check (amount_krw is null or amount_krw >= 0),

  -- planned   : 배정만 해둔 상태
  -- worked    : 실제로 일했음을 사람이 확인 → **정산 대상은 이것뿐이다**(결정 4)
  -- cancelled : 취소됨(기록은 남기되 집계에서 제외)
  status text not null default 'planned'
    check (status in ('planned', 'worked', 'cancelled')),

  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 같은 날 같은 예약에 같은 가이드를 두 번 꽂지 못하게 한다.
  -- ⚠ booking_id가 NULL인 행은 Postgres UNIQUE에서 서로 구별되므로(nulls
  --    distinct) "예약 없는 배정"은 같은 날 여러 건 가능하다 — 하루 2탕이
  --    실제로 있으므로 의도된 허용이다.
  constraint ops_guide_assignments_uniq unique (guide_id, tour_date, booking_id)
);

-- 월 정산 배치의 주 조회 = (테넌트, 상태, 날짜 범위).
create index ops_guide_assignments_period_idx
  on ops_guide_assignments (tenant_id, status, tour_date);
-- 가이드 상세 화면의 "이 사람의 이번 달 배정".
create index ops_guide_assignments_guide_idx
  on ops_guide_assignments (guide_id, tour_date desc);
-- 배정 추천의 "이 날짜에 이미 배정된 사람".
create index ops_guide_assignments_date_idx
  on ops_guide_assignments (tenant_id, tour_date);
create index ops_guide_assignments_booking_idx
  on ops_guide_assignments (booking_id);
create index ops_guide_assignments_room_idx
  on ops_guide_assignments (room_id);

comment on table ops_guide_assignments is
  '가이드 × 투어 배정 원장 (§6.9). tour_rooms에 guide_id가 없어 존재하지 않던 "이 가이드가 이 달에 무엇을 했는가"의 단일 소스. status=worked 행만 월 정산 대상.';
comment on column ops_guide_assignments.guide_id is
  'ON DELETE RESTRICT — 정산 증빙이므로 가이드 삭제로 사라지면 안 된다. 은퇴는 ops_guides.active=false.';
comment on column ops_guide_assignments.amount_krw is
  '확정 단가 스냅샷. NULL이면 ops_guide_rates에서 해석. 값이 있으면(0 포함) 단가표보다 우선한다.';
comment on column ops_guide_assignments.status is
  'worked = 사람이 "실제로 일했다"고 확인한 배정. 월 정산은 이 상태만 집계한다(설계 결정 4).';

-- ============================================================================
-- 2. ops_guide_settlements — 가이드 × 월 = 1행 (3.3% 원천징수 스냅샷)
-- ============================================================================
create table ops_guide_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  -- 배정과 같은 이유로 RESTRICT: 지급명세서의 소득자 행이 사라지면 안 된다.
  guide_id uuid not null references ops_guides(id) on delete restrict,

  -- 'YYYY-MM' (KST 지급 귀속월). ops_settlement_periods.period와 같은 형식.
  period text not null check (period ~ '^\d{4}-\d{2}$'),

  -- 용역대가 합계(실비 제외). 원천징수의 과세표준.
  gross_krw int not null default 0 check (gross_krw >= 0),

  -- 소득세 = floor(gross × 3 / 100), 지방소득세 = floor(소득세 / 10) — 포팅 산식.
  income_tax_krw int not null default 0 check (income_tax_krw >= 0),
  local_tax_krw int not null default 0 check (local_tax_krw >= 0),
  withheld_krw int not null default 0 check (withheld_krw >= 0),
  net_krw int not null default 0 check (net_krw >= 0),

  -- 실비변상(설계 결정 2) — 원천징수 대상이 아니다. 배치가 아니라 사람이 넣는다.
  reimbursement_krw int not null default 0 check (reimbursement_krw >= 0),

  -- 실지급 = net + 실비.
  payout_krw int not null default 0 check (payout_krw >= 0),

  assignment_count int not null default 0 check (assignment_count >= 0),

  -- draft     : 배치가 계산한 초안(재실행 시 금액 갱신됨)
  -- confirmed : 사람이 금액을 확인함(재실행해도 금액 갱신은 되지만 의미가 다름)
  -- paid      : 사람이 지급을 마쳤다는 **사후 기록**. 이후 금액은 잠긴다(결정 7).
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'paid')),
  paid_at timestamptz,
  paid_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 설계 결정 5 — 멱등의 뿌리. 같은 달을 두 번 정산해도 가이드당 1행.
  constraint ops_guide_settlements_period_uniq unique (tenant_id, guide_id, period),

  -- 항등식 3개. 정수 연산이므로 '정확히' 성립해야 한다.
  constraint ops_guide_settlements_withheld_sums
    check (income_tax_krw + local_tax_krw = withheld_krw),
  constraint ops_guide_settlements_net_sums
    check (gross_krw - withheld_krw = net_krw),
  constraint ops_guide_settlements_payout_sums
    check (net_krw + reimbursement_krw = payout_krw)
);

create index ops_guide_settlements_period_idx
  on ops_guide_settlements (tenant_id, period, status);
create index ops_guide_settlements_guide_idx
  on ops_guide_settlements (guide_id, period desc);

comment on table ops_guide_settlements is
  '가이드 월 정산 1행 (§6.9). status=worked 배정 집계 → 3.3% 원천징수(정수 절사) 스냅샷. UNIQUE(tenant_id,guide_id,period)가 재정산 멱등을 보장.';
comment on column ops_guide_settlements.gross_krw is
  '용역대가 합계 — 실비변상은 포함하지 않는다(설계 결정 2). 원천징수의 과세표준이자 간이지급명세서의 지급액.';
comment on column ops_guide_settlements.reimbursement_krw is
  '실비변상(원천징수 대상 아님). 배치가 자동으로 채우지 않는다 — tour_room_extras는 손님→가이드 현금 rail이라 회사→가이드 실비로 옮겨 적으면 이중 지급이 된다. 사람이 정산 화면에서 입력한다.';
comment on column ops_guide_settlements.status is
  'paid = 사람이 지급을 마친 뒤 남기는 사후 기록. 시스템은 어떤 이체도 실행하지 않는다(D10).';

-- ============================================================================
-- 3. ops_entity_ledger — 가이드 지급의 한국법인(kr) 비용 행 멱등 키
--
--    기존 dedup 인덱스는 (booking_id, entity, type, source)인데 가이드 지급 행은
--    booking_id가 NULL(가이드 × 월 단위)이라 nulls-distinct로 서로 충돌하지 않는다
--    = 재정산할 때마다 행이 쌓인다. 그래서 정산행 id를 external_ref에 각인하고
--    그 위에 부분 유니크 인덱스를 둔다 — "가이드 × 월 = 원장 1행"이 DB 레벨 불변식.
--    type은 새 어휘를 만들지 않고 기존 CHECK의 'expense'를 재사용한다.
-- ============================================================================
create unique index ops_entity_ledger_guide_settlement_uniq
  on ops_entity_ledger (external_ref)
  where source = 'guide_settlement';

comment on index ops_entity_ledger_guide_settlement_uniq is
  '가이드 월 정산 비용 행의 멱등 키. external_ref = ops_guide_settlements.id. 재정산은 금액을 update할 뿐 행을 늘리지 않는다.';

-- ============================================================================
-- 4. ops_filing_calendar 시드 — 매월 원천징수 서식 2종 (2026년 잔여 8~12월분)
--
--    · 원천징수이행상황신고서 : 지급월 다음 달 10일
--    · 간이지급명세서(사업소득): 지급월 다음 달 **말일**
--      → 인적용역 사업소득은 2024.7월 지급분부터 매월 제출이고, 미제출 가산세
--        (미제출금액 × 0.25%, 1개월 이내 지연제출 0.125%)가 있다. 기한을 놓치면
--        바로 돈이 나가는 항목이라 캘린더에 반드시 등재한다.
--    지방소득세(특별징수)는 위택스 별도 신고라 국세 서식과 함께 묶지 않는다.
--
--    ⚠ due_date는 **표준 법정기한을 그대로 적은 초안**이다. 기한일이 공휴일·주말이면
--      실제 기한은 다음 영업일로 밀리는데, 이 마이그레이션은 달력을 지어내지 않고
--      법정 날짜만 적는다 — 세무사 확인 시 사람이 실제 날짜로 교정한다.
-- ============================================================================
insert into ops_filing_calendar (entity, filing_key, title, due_date, period, status, note) values
  ('kr', 'kr_withholding_report_2026_08', '원천징수이행상황신고서 (2026-08 지급분)', '2026-09-10', '2026-08', 'pending',
   '표준 법정기한 초안 — 세무사 확인 필요. 지방소득세는 위택스 특별징수로 별도 신고.'),
  ('kr', 'kr_simple_payment_stmt_2026_08', '간이지급명세서(거주자 사업소득) (2026-08 지급분)', '2026-09-30', '2026-08', 'pending',
   '표준 법정기한 초안 — 세무사 확인 필요. 미제출 가산세 0.25%(1개월 내 지연제출 0.125%).'),
  ('kr', 'kr_withholding_report_2026_09', '원천징수이행상황신고서 (2026-09 지급분)', '2026-10-10', '2026-09', 'pending',
   '표준 법정기한 초안 — 세무사 확인 필요.'),
  ('kr', 'kr_simple_payment_stmt_2026_09', '간이지급명세서(거주자 사업소득) (2026-09 지급분)', '2026-10-31', '2026-09', 'pending',
   '표준 법정기한 초안 — 세무사 확인 필요. 미제출 가산세 0.25%.'),
  ('kr', 'kr_withholding_report_2026_10', '원천징수이행상황신고서 (2026-10 지급분)', '2026-11-10', '2026-10', 'pending',
   '표준 법정기한 초안 — 세무사 확인 필요.'),
  ('kr', 'kr_simple_payment_stmt_2026_10', '간이지급명세서(거주자 사업소득) (2026-10 지급분)', '2026-11-30', '2026-10', 'pending',
   '표준 법정기한 초안 — 세무사 확인 필요. 미제출 가산세 0.25%.'),
  ('kr', 'kr_withholding_report_2026_11', '원천징수이행상황신고서 (2026-11 지급분)', '2026-12-10', '2026-11', 'pending',
   '표준 법정기한 초안 — 세무사 확인 필요.'),
  ('kr', 'kr_simple_payment_stmt_2026_11', '간이지급명세서(거주자 사업소득) (2026-11 지급분)', '2026-12-31', '2026-11', 'pending',
   '표준 법정기한 초안 — 세무사 확인 필요. 미제출 가산세 0.25%.'),
  ('kr', 'kr_withholding_report_2026_12', '원천징수이행상황신고서 (2026-12 지급분)', '2027-01-10', '2026-12', 'pending',
   '표준 법정기한 초안 — 세무사 확인 필요.'),
  ('kr', 'kr_simple_payment_stmt_2026_12', '간이지급명세서(거주자 사업소득) (2026-12 지급분)', '2027-01-31', '2026-12', 'pending',
   '표준 법정기한 초안 — 세무사 확인 필요. 미제출 가산세 0.25%.'),
  ('kr', 'kr_annual_payment_stmt_2026', '사업소득 지급명세서(연간, 2026년 귀속)', '2027-03-10', '2026', 'pending',
   '표준 법정기한 초안 — 세무사 확인 필요. 연간 총지급액 = 소득자별 합계와 일치해야 한다(작성원칙).')
on conflict (tenant_id, entity, filing_key, due_date) do nothing;

-- ============================================================================
-- 5. RLS — service-role 전용. RLS enabled + 정책 0개 + 클라이언트 role 권한 회수.
--    배정은 사람의 근무 이력이고 정산은 소득 정보다. anon/authenticated에게
--    노출할 이유가 하나도 없다.
-- ============================================================================
alter table ops_guide_assignments enable row level security;
alter table ops_guide_settlements enable row level security;

revoke all on ops_guide_assignments from anon, authenticated;
revoke all on ops_guide_settlements from anon, authenticated;

-- ============================================================================
-- End. Verify after apply:
--   1. 2개 테이블 존재, RLS enabled, policies = 0 (위 점검 쿼리 (f))
--   2. anon/authenticated 로는 select 불가
--   3. ops_filing_calendar에 kr_withholding_report_* 5행 + kr_simple_payment_stmt_* 5행
--      + kr_annual_payment_stmt_2026 1행 = 11행 추가
--   4. 항등식 CHECK 스모크 (실패해야 정상):
--        insert into ops_guide_settlements (guide_id, period, gross_krw,
--          income_tax_krw, local_tax_krw, withheld_krw, net_krw, payout_krw)
--        values (<guide>, '2026-08', 1000000, 30000, 3000, 33000, 900000, 900000);
--        → ops_guide_settlements_net_sums 위반으로 거부되어야 한다.
--   5. 정산 스모크 (배정 1건을 worked로 만든 뒤):
--        POST /api/admin/guide-settlements {"period":"2026-08"}  → 가이드당 1행
--        같은 호출 한 번 더                                      → 여전히 1행(멱등)
--        select count(*) from ops_entity_ledger
--          where source = 'guide_settlement' and period = '2026-08';  → 정산행 수와 동일
--   6. 🔴 이 슬라이스는 어떤 서식도 제출하지 않는다. 서식은 인쇄 뷰 + CSV 다운로드
--      까지이고, 홈택스 업로드·제출은 사람이 한다(D10).
-- ============================================================================
