-- AtoC 통합 플랜 §6.9 (가이드 관리 + 원천징수 기반) / §11.F (kursoflow 가이드관리 import)
--
-- 배경: 지금까지 "가이드"는 tour_room_participants의 표시명과 발급된 링크뿐이었다.
-- 누가 우리 가이드인지, 어떤 언어를 하는지, 하루 단가가 얼마인지, 언제 쉬는지에
-- 대한 원장이 없어서 배정은 사람 머릿속에서만 일어났고, 원천징수(3.3%)·지급명세서
-- 제출에 필요한 인적사항(주민번호·계좌)은 어디에도 없었다.
--
-- 이 슬라이스는 그 원장의 "데이터"까지만 만든다. 세무 서식 생성(원천징수영수증·
-- 지급명세서)과 월 정산 배치는 다음 슬라이스다 — 여기서는 서식이 요구하는 필드를
-- 정확한 형태로 확보하는 것이 목적이다. 🔴 D10: 세무 서류의 자동 제출·외부 발송은
-- 이 트랙 어디에서도 하지 않는다.
--
-- 설계 결정 (코디네이터 확정):
--   1. 주민번호·계좌번호는 평문 컬럼이 없다. 애플리케이션 레벨 AES-256-GCM 봉투
--      (`v1.<iv>.<tag>.<ct>`)만 저장한다 — 개인정보보호법 §24-2 ③(주민등록번호
--      암호화 의무)의 이행 수단. 키(OPS_GUIDE_PII_ENC_KEY)가 없으면 애플리케이션이
--      저장을 거부한다(fail-closed). DB는 봉투 포맷을 CHECK로 한 번 더 강제해서
--      실수로 평문이 흘러들어와도 INSERT가 깨지게 한다.
--   2. *_masked는 화면·API 응답 전용(900101-1****** / ••••1234). 목록·상세 API는
--      마스킹 값만 반환하고, 복호화는 서식 생성(다음 슬라이스) 또는 admin 전용
--      명시적 [원문 보기] 라우트에서만 일어난다 — 후자는 호출마다
--      ops_guide_pii_access_log에 1행을 남긴다(결정 2의 감사 장치).
--   3. 휴무일은 배정을 차단하지 않는다(§11.F trust-based NOTICE). 추천에서 제외하고
--      배정 화면에 경고만 띄운다 — 현장에서 "오늘 쉬는 날이지만 내가 나간다"는
--      의사결정은 사람이 한다.
--   4. 단가는 (가이드, 투어타입, 시행일)의 이력 테이블이다. guide_id IS NULL 행이
--      테넌트 기본단가 — 가이드별 오버라이드가 없으면 그 값이 적용된다. 과거 정산을
--      다시 계산해도 그때의 단가가 나오도록 UPDATE가 아니라 새 effective_from 행을
--      쌓는다.
--
-- 컨벤션은 기존 ops_* 슬라이스와 동일:
--   ops_ prefix(additive만) / tenant_id text NOT NULL DEFAULT 'atockorea' /
--   RLS enabled + 정책 0개 + anon·authenticated 권한 회수(service-role 전용).
--
-- ⚠ 적용 금지 상태로 파일만 커밋. 적용은 사람 검토 후.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 기존 데이터 위반 사전 점검 (적용 전 실행 — 전부 신규 테이블이라 백필·제약 소급이
-- 없다는 것을 보이는 쿼리들. 기대값을 각 줄에 적어둔다):
--
--   -- (a) 같은 이름의 테이블이 이미 있는가? → 4개 전부 NULL이어야 create 성공.
--   select to_regclass('public.ops_guides')                 as t_guides,
--          to_regclass('public.ops_guide_rates')            as t_rates,
--          to_regclass('public.ops_guide_unavailable_dates') as t_unavailable,
--          to_regclass('public.ops_guide_pii_access_log')   as t_access_log;
--
--   -- (b) 이 마이그레이션은 기존 행을 하나도 건드리지 않는다(ALTER/UPDATE 없음).
--   --     참고로 현재 "가이드"라는 개념이 흩어져 있는 곳의 규모 — 이관 대상이
--   --     아니라 앞으로 원장과 대조할 모집단이다(자동 백필하지 않는다):
--   select count(*) as guide_participant_rows
--     from tour_room_participants where role in ('guide','driver');
--
--   -- (c) pgcrypto의 gen_random_uuid()가 쓸 수 있는가? → 1행(uuid) 나와야 함.
--   select gen_random_uuid() as uuid_ok;
--
--   -- (d) 적용 후 검증: 정책 0개 + RLS on 이어야 함.
--   select relname, relrowsecurity,
--          (select count(*) from pg_policies p where p.tablename = c.relname) as policies
--     from pg_class c
--    where relname in ('ops_guides','ops_guide_rates',
--                      'ops_guide_unavailable_dates','ops_guide_pii_access_log');
-- ─────────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- ops_guides — 가이드/기사 1명 = 1행 (§6.9 프로필 원장)
-- ============================================================================
create table ops_guides (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  name text not null,
  phone text,
  email text,

  -- ko/en/ja/zh/zh-TW/es/fr/de/it/ru … 배정 추천의 1순위 신호.
  languages text[] not null default '{}',

  -- driver = 운전만, bus_guide = 안내만, both = 겸업(제주 프라이빗 다수).
  guide_type text check (guide_type in ('driver', 'bus_guide', 'both')),

  -- 설계 결정 1: 평문 컬럼은 존재하지 않는다. AES-256-GCM 봉투만.
  rrn_enc text,
  -- 표시용 마스크 (900101-1******). 평문이 아니다 — 뒤 6자리는 복원 불가.
  rrn_masked text,

  bank_name text,
  bank_holder text,
  bank_account_enc text,
  -- 표시용 마스크 (••••1234).
  bank_account_masked text,

  -- 관광통역안내사 자격증 보유 (유상 통역안내는 자격자만 — 관광진흥법 §38 ⑥).
  certified boolean not null default false,

  active boolean not null default true,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 봉투 포맷 강제: 평문 주민번호("900101-1234567")가 실수로 들어오면 INSERT 실패.
  constraint ops_guides_rrn_enc_envelope
    check (rrn_enc is null or rrn_enc ~ '^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$'),
  constraint ops_guides_bank_account_enc_envelope
    check (bank_account_enc is null or bank_account_enc ~ '^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$'),
  -- 마스크만 있고 봉투가 없는 상태 = 평문이 어딘가에 있다는 뜻 → 금지.
  constraint ops_guides_rrn_masked_needs_enc
    check (rrn_masked is null or rrn_enc is not null),
  constraint ops_guides_bank_masked_needs_enc
    check (bank_account_masked is null or bank_account_enc is not null)
);

-- 목록 기본 정렬 = 활성 가이드 이름순.
create index ops_guides_active_idx on ops_guides (tenant_id, active, name);

comment on table ops_guides is
  '가이드/기사 프로필 원장 (§6.9). 주민번호·계좌는 AES-256-GCM 봉투로만 저장 — 평문 컬럼 없음(개인정보보호법 §24-2 ③).';
comment on column ops_guides.rrn_enc is
  '주민등록번호 AES-256-GCM 봉투 v1.<iv>.<tag>.<ct>. 키 = OPS_GUIDE_PII_ENC_KEY. 복호화는 서식 생성·reveal 라우트에서만.';
comment on column ops_guides.rrn_masked is
  '표시용 마스크(900101-1******). API 응답에 실리는 유일한 주민번호 표현.';
comment on column ops_guides.certified is
  '관광통역안내사 자격 보유 여부. 배정 추천의 가점이자 법정 요건 체크 지점.';

-- ============================================================================
-- ops_guide_rates — 투어타입별 단가 이력 (일당/건별, 설계 결정 4)
--   guide_id IS NULL = 테넌트 기본단가. 가이드별 행이 있으면 그것이 우선한다.
-- ============================================================================
create table ops_guide_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  guide_id uuid references ops_guides(id) on delete cascade,

  -- 'private' / 'bus' / 'cruise' / 'jeju_private' … 룸의 tour_type과 같은 어휘.
  tour_type text not null,
  amount_krw int not null check (amount_krw >= 0),

  -- 이 단가가 유효해지는 날. 정산은 "투어일 <= effective_from 중 최신"으로 푼다.
  effective_from date not null default current_date,
  note text,

  created_at timestamptz not null default now(),

  -- 같은 (가이드, 타입, 시행일) 중복 금지. NULL guide_id는 Postgres UNIQUE에서
  -- 서로 구별되므로 기본단가용 부분 유니크 인덱스를 아래에 따로 만든다.
  unique (tenant_id, guide_id, tour_type, effective_from)
);

-- 테넌트 기본단가(guide_id IS NULL)의 중복 방지 — UNIQUE가 NULL을 안 잡는 구멍.
create unique index ops_guide_rates_default_uniq
  on ops_guide_rates (tenant_id, tour_type, effective_from)
  where guide_id is null;

create index ops_guide_rates_lookup_idx
  on ops_guide_rates (tenant_id, tour_type, effective_from desc);

comment on table ops_guide_rates is
  '가이드 단가 이력 (§6.9). guide_id IS NULL = 테넌트 기본단가. UPDATE가 아니라 새 effective_from 행을 쌓아 과거 정산 재계산이 그때의 단가를 내도록 한다.';

-- ============================================================================
-- ops_guide_unavailable_dates — 휴무 달력 (하루 = 1행)
--   source: admin = 관리자 등록, self = 가이드가 셀프 스케줄 링크로 등록.
-- ============================================================================
create table ops_guide_unavailable_dates (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  guide_id uuid not null references ops_guides(id) on delete cascade,
  date date not null,
  reason text,
  source text not null default 'admin' check (source in ('admin', 'self')),

  created_at timestamptz not null default now(),

  -- 같은 가이드의 같은 날짜는 1행 — 등록/해제가 멱등해진다.
  unique (guide_id, date)
);

-- 달력·추천의 주 조회 = (테넌트, 날짜) 범위.
create index ops_guide_unavailable_dates_date_idx
  on ops_guide_unavailable_dates (tenant_id, date);

comment on table ops_guide_unavailable_dates is
  '가이드 휴무 달력 (§11.F). 배정을 차단하지 않는다 — 추천에서 제외 + 배정 화면 경고(trust-based NOTICE).';
comment on column ops_guide_unavailable_dates.source is
  'admin = 관리자 등록, self = 가이드가 /g/schedule 셀프 링크로 등록.';

-- ============================================================================
-- ops_guide_pii_access_log — 결정 2의 감사로그
--   [원문 보기] 1회 = 1행. 목적(purpose) 없이는 라우트가 복호화를 거부한다.
-- ============================================================================
create table ops_guide_pii_access_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  guide_id uuid not null,
  -- 'rrn' | 'bank_account' — 어떤 필드를 열어봤는가.
  field text not null,
  -- 열람자 식별자(admin 이메일 또는 user id). 사람이 읽을 수 있어야 감사가 된다.
  actor text,
  -- 왜 열었는가 (예: "2026-07 지급명세서 작성"). 필수 입력.
  purpose text,

  created_at timestamptz not null default now()
);

create index ops_guide_pii_access_log_guide_idx
  on ops_guide_pii_access_log (guide_id, created_at desc);

comment on table ops_guide_pii_access_log is
  '가이드 PII 원문 열람 감사로그. reveal 라우트 호출 1회 = 1행. 로그 기입 실패 시 복호화도 하지 않는다(fail-closed).';

-- ============================================================================
-- RLS — service-role 전용. RLS enabled + 정책 0개 + 클라이언트 role 권한 회수.
-- 봉투라 해도 anon에게 노출할 이유가 없고, 마스크·전화·이메일도 PII다.
-- ============================================================================
alter table ops_guides                    enable row level security;
alter table ops_guide_rates               enable row level security;
alter table ops_guide_unavailable_dates   enable row level security;
alter table ops_guide_pii_access_log      enable row level security;

revoke all on ops_guides                  from anon, authenticated;
revoke all on ops_guide_rates             from anon, authenticated;
revoke all on ops_guide_unavailable_dates from anon, authenticated;
revoke all on ops_guide_pii_access_log    from anon, authenticated;

-- ============================================================================
-- End. Verify after apply:
--   1. 4 tables exist, RLS enabled, policies = 0 (위 점검 쿼리 (d))
--   2. anon/authenticated 로는 select 불가
--   3. env OPS_GUIDE_PII_ENC_KEY 미설정 상태로도 프로필(이름·언어·단가·휴무)은
--      저장된다. 주민번호/계좌 입력만 400 pii_key_missing 으로 거부된다 —
--      의도된 fail-closed다. 키를 넣기 전에는 그 두 칸을 비워두면 된다.
--   4. env OPS_GUIDE_SCHEDULE_TOKEN_SECRET 설정 후에야 셀프 스케줄 링크가
--      프로덕션 경고 없이 발급된다(미설정 시 dev 폴백 + 콘솔 경고).
-- ============================================================================
