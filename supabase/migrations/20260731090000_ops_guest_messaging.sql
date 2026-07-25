-- 손님 안내 메시지 체인 M1~M3
-- (`docs/ops-center-settlement-upgrade-plan-2026-07-25.md` §13)
--
-- 배경: 왓츠앱 순차 발송(wa.me 딥링크 + opened 로그 + [발송 완료] 체크)과 예약별
-- 개인 링크는 **이미 구현돼 있다**(`OpsManifestView`). 없던 것은 세 가지다:
--   ① 템플릿이 (preset_key × locale) 전역 1벌이라 투어별로 다르게 못 쓴다
--   ② 다음날 날씨·착장 안내를 넣을 자리가 없다 (예보 조회 결과를 둘 곳도 없다)
--   ③ 이메일은 고정 초대문구뿐이라 제목·본문을 미리 채워 보고 고칠 수 없다
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 적용 전 점검:
--   select to_regclass('public.ops_tour_message_templates') as t_templates,
--          to_regclass('public.ops_weather_cache')          as t_weather;   -- 둘 다 NULL
--   select count(*) from ops_whatsapp_send_logs;   -- 기존 로그 (컬럼 추가만, 백필 없음)
-- ─────────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- ① 투어별 템플릿 오버라이드 (M2)
--    해석 순서: 이 표 → ops_whatsapp_templates(전역) → 코드 프리셋.
--    tour_id IS NULL 행은 두지 않는다 — 전역은 이미 ops_whatsapp_templates 다.
-- ============================================================================
create table ops_tour_message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  tour_id uuid not null references tours(id) on delete cascade,
  -- confirm_d7 | pickup_d1 | room_invite | day_pass | thanks (WA_PRESET_KEYS)
  preset_key text not null,
  -- en | ko | zh | zh-TW | es | ja
  locale text not null,
  -- 이메일은 제목이 필요하고 wa.me 는 아니다. 그래서 채널이 키의 일부다.
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'email')),

  -- channel='email' 일 때만 의미가 있다.
  subject text,
  body text not null,

  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, tour_id, preset_key, locale, channel)
);

create index ops_tour_message_templates_lookup_idx
  on ops_tour_message_templates (tenant_id, tour_id, preset_key, channel);

comment on table ops_tour_message_templates is
  '투어별 안내 문구 오버라이드 (M2). 해석 순서 = 이 표 → ops_whatsapp_templates(전역) → 코드 프리셋. 전역 행은 여기 두지 않는다.';
comment on column ops_tour_message_templates.channel is
  '이메일은 제목이 필요하고 wa.me 는 아니라서 채널이 키의 일부다.';

-- ============================================================================
-- ② 날씨 예보 캐시 (M1)
--    손님 수만큼 외부 API를 부르지 않기 위한 것. 예보는 하루 단위라 (city, date)가 키다.
--    🔴 예보를 못 가져온 경우는 **행을 만들지 않는다** — "조회 실패"를 캐시하면
--    그 다음 시도까지 막히고, 안내 문구에서 날씨가 조용히 사라진 채로 굳는다.
-- ============================================================================
create table ops_weather_cache (
  id uuid primary key default gen_random_uuid(),
  -- 'Seoul' | 'Busan' | 'Jeju' (lib/ops/weather/forecast.ts CITY_COORDS.label)
  city text not null,
  date date not null,
  -- DailyForecast 그대로. 스키마가 늘어도 컬럼을 늘리지 않는다.
  payload jsonb not null,
  fetched_at timestamptz not null default now(),

  unique (city, date)
);

create index ops_weather_cache_date_idx on ops_weather_cache (date);

comment on table ops_weather_cache is
  '다음날 예보 캐시 (M1). 실패는 캐시하지 않는다 — 실패를 저장하면 날씨가 조용히 사라진 채로 굳는다.';

-- ============================================================================
-- ③ 발송 로그 채널 확장 (M3)
--    이메일용 로그를 새로 만들지 않는다. 두 벌이 되면 "이 손님에게 무엇을
--    보냈나"의 답이 채널마다 갈라지고, 화면은 둘 중 하나만 보게 된다.
--    기존 행은 전부 왓츠앱이므로 default 'whatsapp' 이 곧 올바른 백필이다.
-- ============================================================================
alter table ops_whatsapp_send_logs
  add column if not exists channel text not null default 'whatsapp'
    check (channel in ('whatsapp', 'email')),
  add column if not exists subject text,
  -- 이메일은 서버가 실제로 보내므로 성패가 있다. wa.me 는 사람이 보내므로
  -- 'opened'(탭을 열었다) 뒤에 marked_sent_at 이 온다 — 그래서 상태가 다르다.
  add column if not exists status text not null default 'opened'
    check (status in ('opened', 'sent', 'failed', 'skipped')),
  add column if not exists error text,
  add column if not exists tour_id uuid,
  add column if not exists tour_date date;

create index if not exists ops_whatsapp_send_logs_tour_idx
  on ops_whatsapp_send_logs (tenant_id, tour_id, tour_date);

comment on column ops_whatsapp_send_logs.channel is
  '이 로그는 왓츠앱 전용이 아니다 (M3). 이메일 일괄 발송도 여기에 남는다 — 로그가 두 벌이면 "무엇을 보냈나"의 답이 갈라진다.';
comment on column ops_whatsapp_send_logs.status is
  'wa.me: opened(탭 오픈) → marked_sent_at(사람이 보냄 체크). email: sent | failed | skipped.';

-- ============================================================================
-- RLS — service-role 전용 (기존 ops_* 규약).
-- ============================================================================
alter table ops_tour_message_templates enable row level security;
alter table ops_weather_cache          enable row level security;
revoke all on ops_tour_message_templates from anon, authenticated;
revoke all on ops_weather_cache          from anon, authenticated;

-- ============================================================================
-- End. Verify after apply:
--   1. 두 테이블 존재, RLS on, 정책 0
--   2. ops_whatsapp_send_logs 기존 행의 channel='whatsapp', status='opened'
--   3. anon/authenticated 로 select 불가
-- ============================================================================
