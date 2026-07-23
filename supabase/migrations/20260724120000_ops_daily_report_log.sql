-- AtoC 통합 §11.E — 일일 보고서 발송 원장 (멱등 마커)
-- Consolidation plan §11.E: "멱등: 같은 날 중복 트리거 시 재발송 안 함
--   (단 force 파라미터로 수동 재발송 허용)".
--
-- report_date UNIQUE = 하루 1행. 09:00 UTC vercel cron이 하루에 여러 번
-- 재시도해도(또는 수동 트리거가 겹쳐도) 이 행의 존재로 재발송을 막는다.
-- 수동 [지금 보고서 발송]은 force=true 로 이 게이트를 우회하고 last_forced_at
-- 만 갱신한다(원장은 계속 1행 유지).
--
-- RLS: 다른 ops_* 슬라이스와 동일 — service-role 전용(RLS on, 정책 0, 회수).
-- 서버 크론/admin 라우트가 service-role 클라이언트로만 접근한다.
--
-- ⚠ 적용 금지 상태로 파일만 커밋 (배포 후 사람 검토). 미적용이어도 발송 코드는
--   graceful degrade — 테이블 부재(42P01) 시 멱등 스킵(항상 발송)하고 마커 기록만
--   건너뛴다. 적용되면 완전 멱등이 켜진다.

create table ops_daily_report_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  -- 보고 기준일 (KST). 하루 1행 = 멱등 키.
  report_date date not null,
  recipient text,
  subject text,
  -- 요주의 종합 합계 (스냅샷 — 재발송 판단·통계용).
  attention_total int,
  -- 자동(cron) 최초 발송 시각.
  sent_at timestamptz not null default now(),
  -- force 재발송 최신 시각 (수동 원버튼).
  last_forced_at timestamptz,
  -- 발송 트리거 수 (감사).
  send_count int not null default 1,

  created_at timestamptz not null default now()
);

create unique index ops_daily_report_log_date_idx
  on ops_daily_report_log (tenant_id, report_date);

comment on table ops_daily_report_log is
  '일일 보고서 발송 원장 (plan §11.E). report_date UNIQUE = 멱등 마커. force 재발송은 send_count/last_forced_at만 갱신.';

alter table ops_daily_report_log enable row level security;
revoke all on ops_daily_report_log from anon, authenticated;
