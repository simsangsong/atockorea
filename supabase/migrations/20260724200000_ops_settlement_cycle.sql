-- AtoC 통합 플랜 Phase 3 (§6.1 F-2~F-4, §6.3, §6.4) — 월 정산 사이클
--
-- 배경: F-1(이미 배포됨)이 Stripe 캡처마다 ops_entity_ledger에
--   (us, revenue, +gross) + (us, commission, +gross×margin_rate) 2행을 멱등 기입한다.
-- 이 마이그레이션은 그 원장 위에 "월 마감 → 인터컴퍼니 인보이스 → 실제 송금기록 →
-- 3자 대사"의 사이클을 얹는다.
--
--   [F-2] 월 마감  : ops_settlement_periods (기간당 1행, 금액·rate 스냅샷)
--                    ops_intercompany_invoices (기간당 1장, 한국법인 → 미국 LLC)
--   [F-3] 송금기록 : ops_remittances (사람이 은행에서 실행한 국제송금 사후 등록)
--                    → 정산서 송금분 / 인보이스 금액 / 실제 송금합 3자 대사
--   [F-4] 보관     : ops_remittances.swift_doc_url (외화입금증명 = 영세율 첨부서류)
--   [§6.7] 마감알림: ops_filing_calendar (신고기한 목록 — 조회 전용, 발송 없음)
--
-- 설계 결정 (코디네이터 확정 — 코드와 동일한 계약):
--   1. 🔴 부가세 라인 없음. 플랜 §6.2/§9-1이 "여행업 영세율 배제 가능성"을 미해결
--      게이트로 남겨두었다. 세무사 확정 전까지 정산서·인보이스에 세액 컬럼을 만들지
--      않는다. 문서 하단 고지 문구 1줄로 공백을 명시한다(숫자 창작 금지).
--   2. margin_rate는 마감 시점 스냅샷(ops_settlement_periods.margin_rate NOT NULL).
--      설정(ops_finance_config.margin_rate)이 나중에 바뀌어도 과거 정산서가
--      소급 재계산되면 안 되기 때문. 코드도 5% 하드코딩 없이 getFinanceMarginRate() 경유.
--   3. PDF blob을 보관하지 않는다(신규 npm 의존성 금지). 문서는 DB 데이터에서
--      결정론적으로 재렌더되는 admin 인쇄 뷰(@media print)다. pdf_url은 nullable로
--      자리만 두고 이번 슬라이스에서 채우지 않는다.
--   4. 전문가(미국 CPA·한국 세무사) 확인 전에는 모든 생성 문서에 DRAFT 워터마크.
--      해제 스위치 = ops_finance_config.expert_reviewed (기본 false, additive 1컬럼).
--   5. 고객 인보이스 발행 금지(D11). 발행 문서는 인터컴퍼니 1종뿐 — 고객은
--      Stripe 영수증으로 갈음한다.
--   6. 3자 대사는 마감의 하드 게이트: 정산서 송금분 = 인보이스 금액 = 실제 송금합
--      셋이 전부 일치할 때만 status='reconciled'. 허용오차 0(정수 minor units).
--   7. 멱등: UNIQUE(tenant_id, period) + UNIQUE(period_id) 두 개가 "같은 달을 두 번
--      마감해도 기간 1행·인보이스 1장"을 DB 레벨에서 보장한다.
--   8. 🔴 비가역 대외 액션 없음(D10). 이 스키마 어디에도 "제출/신고/발송" 상태가
--      없다. ops_filing_calendar.status의 'filed'는 사람이 신고한 뒤 손으로 남기는
--      기록이지, 시스템이 신고했다는 뜻이 아니다.
--
-- 금액 표현: ops_entity_ledger와 동일하게 정수 minor units(bigint). 부동소수 금액
-- 연산 없음 — 3자 대사가 '거의 같음'이 아니라 '정확히 같음'으로 판정돼야 하므로.
--
-- 컨벤션은 기존 ops_* 슬라이스와 동일:
--   ops_ prefix(additive만) / tenant_id text NOT NULL DEFAULT 'atockorea' /
--   RLS enabled + 정책 0개 + anon·authenticated 권한 회수(service-role 전용).
--
-- ⚠ 적용 금지 상태로 파일만 커밋. 적용은 사람 검토 후.
--
-- ---------------------------------------------------------------------------
-- 기존 데이터 위반 사전 점검 (적용 전 실행)
-- ---------------------------------------------------------------------------
--
--   -- (a) 같은 이름의 테이블이 이미 있는가? → 4개 전부 NULL이어야 create 성공.
--   select to_regclass('public.ops_settlement_periods')    as t1,
--          to_regclass('public.ops_intercompany_invoices') as t2,
--          to_regclass('public.ops_remittances')           as t3,
--          to_regclass('public.ops_filing_calendar')       as t4;
--
--   -- (b) additive 컬럼이 붙을 ops_finance_config가 존재하고 단일행인가?
--   --     → 1행(id=1)이어야 함. expert_reviewed 컬럼은 아직 없어야 함(0행).
--   select count(*) as config_rows from ops_finance_config;
--   select column_name from information_schema.columns
--    where table_name = 'ops_finance_config' and column_name = 'expert_reviewed';
--
--   -- (c) 마감 대상 원장이 실제로 있는가? 첫 마감이 어떤 달을 잡을지 미리 본다.
--   --     (전부 0행이어도 정상 — 아직 캡처가 없다는 뜻일 뿐 마이그레이션과 무관.)
--   select period, entity, type, count(*) as rows, sum(amount_minor) as sum_minor
--     from ops_entity_ledger
--    group by period, entity, type
--    order by period desc, entity, type;
--
--   -- (d) 이 마이그레이션은 기존 행을 하나도 수정하지 않는다(UPDATE/DELETE 없음).
--   --     ALTER는 ops_finance_config에 NOT NULL DEFAULT false 컬럼 1개 추가뿐 —
--   --     기존 1행은 false로 채워지고(=DRAFT 유지) 이게 의도된 안전한 기본값이다.

-- ============================================================================
-- 0. ops_finance_config — DRAFT 해제 플래그 (설계 결정 4). additive 컬럼 1개.
-- ============================================================================
alter table ops_finance_config
  add column if not exists expert_reviewed boolean not null default false;

comment on column ops_finance_config.expert_reviewed is
  '미국 CPA·한국 세무사 확인 완료 여부. false(기본)면 생성 문서 전부에 DRAFT 워터마크(설계 결정 4). 사람만 true로 바꾼다.';

-- ============================================================================
-- 1. ops_settlement_periods — 월 마감 1행 (§6.1 F-2)
-- ============================================================================
create table ops_settlement_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  -- 'YYYY-MM' (KST 기준 월). ops_entity_ledger.period와 같은 키.
  period text not null check (period ~ '^\d{4}-\d{2}$'),

  -- open      : 아직 마감 안 함(행이 만들어지기 전 상태 — 실제로는 거의 안 쓰임)
  -- closed    : 원장 집계 확정(금액·rate 스냅샷 완료)
  -- invoiced  : 인터컴퍼니 인보이스 발행
  -- remitted  : 송금기록 1건 이상 등록
  -- reconciled: 3자 금액 일치 확인 완료 (마감의 종점)
  status text not null default 'open'
    check (status in ('open', 'closed', 'invoiced', 'remitted', 'reconciled')),

  -- 전부 USD 정수 minor units. remit = gross − commission (파생값을 스냅샷 저장).
  gross_minor bigint not null default 0 check (gross_minor >= 0),
  commission_minor bigint not null default 0 check (commission_minor >= 0),
  remit_minor bigint not null default 0 check (remit_minor >= 0),

  -- 설계 결정 2: 마감 시점의 커미션율 스냅샷. 설정이 바뀌어도 과거는 불변.
  margin_rate numeric(5,4) not null
    check (margin_rate >= 0 and margin_rate <= 1),

  order_count int not null default 0 check (order_count >= 0),
  -- Stripe 수수료는 참고값 — 원장에 fee 행이 쌓이기 전까지는 null(모르면 비워둔다).
  stripe_fee_minor bigint,

  currency text not null default 'USD',
  note text,

  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 설계 결정 7 — 멱등의 뿌리. 같은 달을 두 번 마감해도 행은 1개.
  constraint ops_settlement_periods_period_uniq unique (tenant_id, period),
  -- 커미션+송금분 = 총매출. 정수 연산이므로 '정확히' 성립해야 한다(3자 대사 전제).
  constraint ops_settlement_periods_split_sums
    check (commission_minor + remit_minor = gross_minor)
);

create index ops_settlement_periods_status_idx
  on ops_settlement_periods (tenant_id, status, period desc);

comment on table ops_settlement_periods is
  '월 정산 마감 1행 (§6.1 F-2). ops_entity_ledger(us) 집계 스냅샷 + 마감 시점 margin_rate. UNIQUE(tenant_id,period)가 재마감 멱등을 보장.';
comment on column ops_settlement_periods.margin_rate is
  '마감 시점 커미션율 스냅샷(설계 결정 2). 설정 변경이 과거 정산서를 소급 재계산하지 못하게 한다.';
comment on column ops_settlement_periods.remit_minor is
  '한국법인 송금 대상액 = gross − commission. 3자 대사의 첫 번째 값.';
comment on column ops_settlement_periods.stripe_fee_minor is
  'Stripe 수수료 참고값. 원장에 fee 행이 없으면 null(추정치를 지어내지 않는다).';

-- ============================================================================
-- 2. ops_intercompany_invoices — 한국법인 → 미국 LLC 인보이스 (§6.4)
--    기간당 1장. 고객 인보이스는 발행하지 않는다(D11).
-- ============================================================================
create table ops_intercompany_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',
  period_id uuid not null references ops_settlement_periods(id) on delete cascade,

  -- 'AK-IC-2026-001' — 연도 단위 연번(무결번 목표). 전역 UNIQUE.
  invoice_no text not null,

  issue_date date not null default (now() at time zone 'Asia/Seoul')::date,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'USD',

  -- 원화 환산 참고(영세율 첨부·한국 장부용). 모르면 null — 추정 환율 금지.
  fx_rate numeric(18,6),
  fx_rate_date date,

  status text not null default 'draft' check (status in ('draft', 'issued')),

  -- 설계 결정 3: 이번 슬라이스에서 채우지 않는다(문서는 인쇄 뷰에서 재렌더).
  pdf_url text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ops_intercompany_invoices_no_uniq unique (invoice_no),
  -- 설계 결정 7 — 기간당 인보이스 1장.
  constraint ops_intercompany_invoices_period_uniq unique (period_id)
);

create index ops_intercompany_invoices_tenant_idx
  on ops_intercompany_invoices (tenant_id, issue_date desc);

comment on table ops_intercompany_invoices is
  '인터컴퍼니 인보이스 (§6.4). 한국법인(용역 제공) → 미국 LLC(용역 수취), 기간당 1장. 고객 인보이스는 발행하지 않음(D11).';
comment on column ops_intercompany_invoices.invoice_no is
  'AK-IC-YYYY-### 연도 단위 연번. 전역 UNIQUE — 동시 마감 시 충돌하면 재시도, 그래도 안 되면 실패(조용한 결번 금지).';
comment on column ops_intercompany_invoices.pdf_url is
  '설계 결정 3: 이번 슬라이스 미사용(항상 null). 문서는 DB에서 결정론적으로 재렌더되는 인쇄 뷰다.';

-- ============================================================================
-- 3. ops_remittances — 실제 국제송금 사후 등록 (§6.1 F-3, F-4)
--    송금 실행은 사람이 은행에서 한다. 시스템은 사실을 받아 적고 대사할 뿐이다(D10).
-- ============================================================================
create table ops_remittances (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',
  period_id uuid not null references ops_settlement_periods(id) on delete cascade,

  wire_date date not null,
  amount_usd_minor bigint not null check (amount_usd_minor > 0),
  -- 실제 입금된 원화(수수료 차감 후일 수 있음). 모르면 null.
  amount_krw bigint,
  fx_rate numeric(18,6),

  -- F-4: 외화입금증명 파일(영세율 첨부서류) 보관 위치. private 스토리지 경로 또는 URL.
  swift_doc_url text,
  bank_ref text,
  note text,

  created_at timestamptz not null default now()
);

create index ops_remittances_period_idx
  on ops_remittances (period_id, wire_date);

comment on table ops_remittances is
  '국제송금 기록 (§6.1 F-3). 송금 실행은 사람이 은행에서 — 시스템은 사후 등록·대사만 한다(D10 비가역 대외 액션 금지).';
comment on column ops_remittances.amount_usd_minor is
  '실제 송금액(USD 정수 minor units). 3자 대사의 세 번째 값 — 여러 건이면 합산해서 비교한다.';
comment on column ops_remittances.swift_doc_url is
  'F-4 외화입금증명(영세율 첨부서류) 사본 위치. 파일 보관은 사람 업로드, 자동 제출 없음.';

-- ============================================================================
-- 4. ops_filing_calendar — 신고기한 목록 (§6.7). 조회 전용, 발송·제출 없음(D10).
-- ============================================================================
create table ops_filing_calendar (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  entity text not null check (entity in ('us', 'kr')),
  -- 안정 식별자(코드가 참조). 예: 'us_form_5472', 'kr_vat_1st_final'
  filing_key text not null,
  title text not null,
  due_date date not null,
  -- 대상 기간('YYYY-MM' 또는 'YYYY'). 기간과 무관한 연차 신고는 null.
  period text,

  -- pending  : 아직 준비 안 함
  -- prepared : 서류 준비 완료(제출 전)
  -- filed    : 사람이 신고 완료 후 손으로 남기는 기록. 시스템이 신고했다는 뜻이 아니다.
  -- na       : 해당 없음(예: 영세율 확정 전 보류 항목)
  status text not null default 'pending'
    check (status in ('pending', 'prepared', 'filed', 'na')),

  docs_url text,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ops_filing_calendar_uniq unique (tenant_id, entity, filing_key, due_date)
);

create index ops_filing_calendar_due_idx
  on ops_filing_calendar (tenant_id, due_date, status);

comment on table ops_filing_calendar is
  '신고기한 캘린더 (§6.7). 조회 전용 — 자동 제출·자동 발송 없음(D10). status=filed는 사람이 신고한 뒤 남기는 사후 기록.';
comment on column ops_filing_calendar.status is
  'filed = 사람이 신고를 마쳤다는 기록. 시스템은 어떤 신고도 제출하지 않는다(D10).';

-- ---------------------------------------------------------------------------
-- 4-1. 시드 — 2026년 항목.
--
-- ⚠ 아래 due_date는 표준 법정기한을 옮겨 적은 "초안"이며, 미국 CPA·한국 세무사
--    확인 전이다. 특히 부가가치세 항목은 플랜 §6.2(여행업 영세율 배제 가능성)가
--    미해결이라 status='na'(보류)로 시드한다 — 확정되면 사람이 상태를 바꾼다.
--    시스템은 이 표로 아무것도 자동 실행하지 않는다.
-- ---------------------------------------------------------------------------
insert into ops_filing_calendar (entity, filing_key, title, due_date, period, status, note) values
  ('us', 'us_form_5472_1120_pro_forma', 'Form 5472 + pro forma 1120 (외국인 100% 소유 LLC 관계자거래 보고)',
   '2027-04-15', '2026', 'pending', '표준 법정기한 초안 — 미국 CPA 확인 필요. 인터컴퍼니 거래 총액 = ops_settlement_periods 합계와 대사.'),
  ('us', 'us_wy_annual_report', 'Wyoming LLC 연차보고서(Annual Report)',
   '2026-12-01', '2026', 'pending', '표준 법정기한 초안 — 실제 기한은 설립 기념월. 등록대리인 통지로 확인 필요.'),
  ('kr', 'kr_corporate_tax_2026', '법인세 신고 (12월 결산 법인)',
   '2027-03-31', '2026', 'pending', '표준 법정기한 초안 — 한국 세무사 확인 필요.'),
  ('kr', 'kr_vat_2026_h1_final', '부가가치세 1기 확정신고',
   '2026-07-25', '2026-06', 'na', '§6.2 미해결 게이트(여행업 영세율 배제 가능성) — 세무사 확정 전까지 보류. 시스템은 세액을 계산하지 않는다.'),
  ('kr', 'kr_vat_2026_h2_final', '부가가치세 2기 확정신고',
   '2027-01-25', '2026-12', 'na', '§6.2 미해결 게이트 — 세무사 확정 전까지 보류. 시스템은 세액을 계산하지 않는다.')
on conflict (tenant_id, entity, filing_key, due_date) do nothing;

-- ============================================================================
-- 5. RLS — service-role 전용. RLS enabled + 정책 0개 + 클라이언트 role 권한 회수.
--    정산 금액·법인 법적정보·송금 증빙은 anon에게 절대 새어 나가면 안 된다.
-- ============================================================================
alter table ops_settlement_periods enable row level security;
alter table ops_intercompany_invoices enable row level security;
alter table ops_remittances enable row level security;
alter table ops_filing_calendar enable row level security;

revoke all on ops_settlement_periods from anon, authenticated;
revoke all on ops_intercompany_invoices from anon, authenticated;
revoke all on ops_remittances from anon, authenticated;
revoke all on ops_filing_calendar from anon, authenticated;

-- ============================================================================
-- End. Verify after apply:
--   1. 4개 테이블 존재, RLS enabled, policies = 0 (각 테이블)
--   2. ops_finance_config.expert_reviewed = false (기존 1행이 DRAFT 유지)
--   3. anon/authenticated가 4개 테이블 전부 select 불가
--   4. ops_filing_calendar 시드 5행 (kr VAT 2건은 status='na' — §6.2 보류)
--   5. 첫 마감 스모크:
--        POST /api/admin/ops-finance/periods {"period":"2026-08"}  → 1행
--        같은 호출 한 번 더                                        → 여전히 1행(멱등)
--        POST .../periods/2026-08/invoice                          → 1장
--        같은 호출 한 번 더                                        → 같은 invoice_no(멱등)
--        POST .../periods/2026-08/reconcile (송금 미등록)          → 400 + 차액
-- ============================================================================
