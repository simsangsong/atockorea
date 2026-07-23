-- AtoC 통합 F-슬라이스 — 파이낸스 설정 단일행 (plan §6.3 ops_finance_config, D6)
-- margin_rate = LLC 커미션율(결제 gross의 5%, D6). 나머지 95%가 한국법인 송금 대상.
-- 법인 법적정보(LLC EIN·한국 사업자번호 등)는 인터컴퍼니 인보이스(Phase 3)용 —
-- 지금은 nullable 자리만. intercompany_seq = AK-IC-2026-### 연번 시퀀스(F-2).
--
-- additive: 신규 테이블. 기존 스키마 무변경. service-role 전용(RLS on + 정책 0 + revoke).

CREATE TABLE IF NOT EXISTS ops_finance_config (
  id smallint PRIMARY KEY DEFAULT 1,
  tenant_id text NOT NULL DEFAULT 'atockorea',
  margin_rate numeric(5,4) NOT NULL DEFAULT 0.0500,  -- D6: LLC commission = gross × 5%
  -- 미국 LLC 법적정보 (Form 5472/1120 + 인터컴퍼니 인보이스)
  llc_legal_name text,
  llc_address text,
  llc_ein text,
  -- 한국 종합여행업 법인
  kr_legal_name text,
  kr_address text,
  kr_biz_reg_no text,
  -- 인터컴퍼니 인보이스 연번 (F-2 — AK-IC-2026-###)
  intercompany_prefix text NOT NULL DEFAULT 'AK-IC',
  intercompany_seq int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_finance_config_singleton CHECK (id = 1),
  CONSTRAINT ops_finance_config_margin_range CHECK (margin_rate >= 0 AND margin_rate <= 1)
);

-- 단일 시드행 (5% 기본). 법적정보는 Jason이 admin에서 채움(현재 DRAFT 전제).
INSERT INTO ops_finance_config (id, margin_rate)
VALUES (1, 0.0500)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE ops_finance_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ops_finance_config FROM anon, authenticated;

COMMENT ON TABLE ops_finance_config IS
  '파이낸스 단일행 설정 (plan §6.3). margin_rate=LLC 커미션 5%(D6). service-role 전용.';
