-- AtoC 통합 Phase 2 — WhatsApp prefill 발송 스택 (plan §4.2)
-- ⚠ 적용 금지 상태로 파일만 커밋 (적용은 사람 확인 후 별도 진행).
--
-- ops_whatsapp_templates: preset_key × locale 템플릿 원장. 시드는
--   scripts/seed-ops-whatsapp-templates.ts (lib/ops/whatsapp/presets.ts가 소스).
--   변수: {guest_name} {tour_date} {pickup_time} {room_link} {pass_link}
--         (+ {tour_name} {pickup_point} {operator})
-- ops_whatsapp_send_logs: wa.me는 1:1 수동 발송이므로 로그가 곧 "연락 현황"
--   데이터 (plan §11.E 보고서 섹션4의 원천). opened_at = 운영자가 wa.me 탭을
--   연 시각(자동), marked_sent_at = [발송 완료] 수동 체크 시각.
--
-- RLS: slice 1과 동일 패턴 — service-role 전용 (RLS on, 정책 0, 권한 회수).

create table ops_whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  -- confirm_d7 | pickup_d1 | room_invite | day_pass | thanks (presets.ts)
  preset_key text not null,
  -- en | ko | zh | zh-TW | es | ja (기존 content_locales 키 체계, 6 locale 우선)
  locale text not null,
  -- admin 표시용 한국어 라벨 + 발송 권장 시점
  label text not null,
  timing text,
  body text not null,

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ops_whatsapp_templates_key_idx
  on ops_whatsapp_templates (tenant_id, preset_key, locale);

comment on table ops_whatsapp_templates is
  'WhatsApp prefill 템플릿 (plan §4.2). preset_key × locale unique. 시드: scripts/seed-ops-whatsapp-templates.ts';

create table ops_whatsapp_send_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  booking_id uuid not null references bookings(id) on delete cascade,
  preset_key text not null,
  locale text,
  -- 렌더된 wa.me URL (프리필 텍스트 포함) + 렌더 본문 (감사/재발송용)
  wa_url text,
  rendered_message text,

  -- 운영자가 wa.me 탭을 연 시각 (열람 ≠ 발송 — Jason 클릭 기반 자율 기록)
  opened_at timestamptz not null default now(),
  -- [발송 완료] 수동 체크 시각
  marked_sent_at timestamptz,
  created_by text,

  created_at timestamptz not null default now()
);

create index ops_whatsapp_send_logs_booking_idx
  on ops_whatsapp_send_logs (booking_id, created_at desc);
create index ops_whatsapp_send_logs_tenant_idx
  on ops_whatsapp_send_logs (tenant_id, created_at desc);

comment on table ops_whatsapp_send_logs is
  'wa.me 발송 로그 (plan §4.2). opened_at=탭 오픈, marked_sent_at=수동 발송완료 체크. §11.E 연락현황 원천.';

-- service-role 전용 RLS (slice 1 ops_parse_stack과 동일 패턴)
alter table ops_whatsapp_templates enable row level security;
alter table ops_whatsapp_send_logs enable row level security;

revoke all on ops_whatsapp_templates from anon, authenticated;
revoke all on ops_whatsapp_send_logs from anon, authenticated;
