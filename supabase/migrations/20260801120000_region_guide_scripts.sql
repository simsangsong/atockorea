-- 지역 공통 해설 스크립트 — 스마트앱 "오늘 일정" 탭 상단 섹션.
--
-- 배경: 해설 콘텐츠는 지금까지 전부 **장소 단위**였다(curated → poi_kb →
-- generated_spot_content). 그래서 "제주도가 어떤 섬인가" — 면적·해녀·돌하르방·
-- 삼다삼무처럼 **특정 좌표에 도착하지 않아도 통하는 이야기**를 담을 그릇이 없었다.
-- 손님은 이동 시간의 절반 이상을 차 안에서 보내는데 그 시간에 읽을 것이 없다.
--
-- 설계 결정:
--   1. `region_key`로 지역을 나눈다 — 'jeju'로 시작하지만 부산 크루즈 상품이 이미
--      있어서 'busan'이 곧 온다. 테이블 이름에 jeju를 박지 않는 이유가 이것뿐이다.
--   2. 메타(사진·정렬·민감도)와 본문(로케일별)을 **두 테이블로 나눈다**. 한 테이블에
--      jsonb로 10로케일을 넣으면 한 언어만 고칠 때 read-modify-write가 되고, 병렬
--      갱신에서 다른 언어를 덮어쓴다(2026-07 유료번역 70건 소실 사고와 같은 형태).
--   3. `locale` CHECK로 ROOM_LOCALES 10종을 강제한다. TypeScript의
--      Record<string, …>는 오타를 못 잡고, 잘못된 로케일 행은 조용히 렌더되지 않는
--      상태로 남는다 — DB가 잡는 편이 낫다.
--   4. `sources`는 장식이 아니다. "정보 정확하고 검증 거쳐서"가 요구사항이라,
--      각 문단의 근거 URL을 행에 붙여 두어야 1년 뒤에 수치를 갱신할 수 있다.
--      (해녀 인원처럼 매년 바뀌는 숫자가 여럿 있다.)
--   5. `sensitive` = 4·3처럼 손님이 선택해서 열어야 하는 주제. 목록에는 있되
--      배지가 붙는다 — 숨기지도, 불쑥 들이밀지도 않는다.
--
-- 컨벤션: additive만 / RLS enabled + 정책 0개(서버 라우트가 service-role로 읽는다).
-- 손님 앱은 인증된 룸 세션을 거쳐 서버 라우트로만 접근한다.

create table region_scripts (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  -- 'jeju' | 'busan' | 'seoul' … 상품이 아니라 **지역**이다(같은 지역의 모든 투어가 공유).
  region_key text not null,
  -- 'overview' | 'haenyeo' | 'dolhareubang' … 코드에서 참조하는 안정 키.
  topic_key text not null,

  sort_order int not null default 0,

  -- 카드 머리의 이모지. 사진이 없는 주제도 빈 회색 상자가 되지 않게 하는 폴백이다.
  icon text,
  image_url text,
  image_credit text,

  -- 4·3 같은 역사적 비극. 목록에 남되 배지가 붙고, 카드가 본문을 미리 펼치지 않는다.
  sensitive boolean not null default false,

  -- [{label, url}] — 수치의 출처. 갱신 주기가 있는 통계는 여기가 유일한 단서다.
  sources jsonb not null default '[]'::jsonb,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, region_key, topic_key)
);

create index region_scripts_serve_idx
  on region_scripts (tenant_id, region_key, active, sort_order);

comment on table region_scripts is
  '지역 공통 해설 주제(장소 비의존). 스마트앱 오늘 일정 탭 상단 섹션의 원장. 본문은 region_script_locales.';
comment on column region_scripts.sources is
  '수치 근거 URL. 해녀 인원·돌고래 개체수처럼 매년 바뀌는 값이 있어 갱신 단서로 필수.';
comment on column region_scripts.sensitive is
  '손님이 선택해서 여는 주제(4·3 등). 숨기지 않되 미리 펼치지도 않는다.';

-- ============================================================================
-- 로케일별 본문 — 1주제 × 1언어 = 1행. ROOM_LOCALES 10종.
-- ============================================================================
create table region_script_locales (
  script_id uuid not null references region_scripts(id) on delete cascade,
  locale text not null,

  title text not null,
  -- 카드에 보이는 한 줄. 여기서 흥미가 안 생기면 본문은 안 열린다.
  teaser text not null,
  -- 전문. 문단 구분은 빈 줄 두 개(렌더러가 <p>로 쪼갠다).
  body text not null,
  -- "이건 몰랐죠?" 한 줄 — 손님이 일행에게 옮겨 말하게 되는 문장.
  fun_fact text,

  updated_at timestamptz not null default now(),

  primary key (script_id, locale),

  -- ROOM_LOCALES와 동일. 오타 로케일 행은 조용히 안 보이는 채로 남으므로 DB가 막는다.
  constraint region_script_locales_locale_check
    check (locale in ('en','ko','ja','es','zh','zh-TW','fr','de','ru','it'))
);

comment on table region_script_locales is
  '지역 해설 본문(로케일별 1행). 한 언어 갱신이 다른 언어를 덮어쓰지 않도록 jsonb가 아니라 행으로 나눴다.';
comment on column region_script_locales.teaser is
  '카드 한 줄 요약. 본문을 여는 유일한 동기라 번역에서 가장 공들여야 하는 필드.';

-- ============================================================================
-- RLS — service-role 전용. 손님은 인증된 룸 세션 → 서버 라우트로만 읽는다.
-- ============================================================================
alter table region_scripts        enable row level security;
alter table region_script_locales enable row level security;

revoke all on region_scripts        from anon, authenticated;
revoke all on region_script_locales from anon, authenticated;
