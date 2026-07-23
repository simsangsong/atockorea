-- AtoC 통합 F-슬라이스 — 법인별 원장 (plan §6.3 ops_entity_ledger, §6.1 F-1)
-- 미국 LLC × 한국 종합여행업 이중 체계의 단일 거래 원장.
-- 캡처 시점(F-1) 기입 = 5472 대사 + 월 정산서(F-2)의 원천.
--
-- 금액 표현: amount_minor = 정수 minor units(예: USD 센트). 부동소수 오차 없이
-- 3자 대사(정산서·인터컴퍼니 인보이스·송금증) 금액 일치를 보장(§6.4). currency는
-- ISO 4217 대문자. type=commission/remit는 revenue에서 파생(월 정산에서 재계산 가능).
--
-- additive: 신규 테이블. bookings(id) FK는 ON DELETE SET NULL(원장은 예약 삭제와 무관하게
-- 회계 기록으로 보존). service-role 전용(RLS on + 정책 0 + revoke).

CREATE TABLE IF NOT EXISTS ops_entity_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'atockorea',
  entity text NOT NULL CHECK (entity IN ('us', 'kr')),
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  period text,                       -- 'YYYY-MM' (KST 정산기간). 캡처 기입 시 자동 각인.
  type text NOT NULL CHECK (type IN ('revenue', 'commission', 'remit', 'fee', 'expense')),
  amount_minor bigint NOT NULL,      -- 정수 minor units, 부호 있음(유출은 음수)
  currency text NOT NULL,            -- ISO 4217 대문자 (예: 'USD')
  fx_rate numeric(18,6),             -- 송금 시점 매매기준율(F-3). 캡처 시엔 null.
  source text,                       -- 'stripe_capture' | 'settlement' | 'remittance' | 'manual'
  external_ref text,                 -- payment_intent id / 인보이스 연번 / SWIFT ref
  note text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 멱등 디듀프: 캡처 기입은 (booking_id, entity, type, source)로 유일.
-- 크론 캡처와 webhook succeeded가 같은 캡처에 대해 이중 발화해도 1행으로 수렴.
-- (null booking_id 수기 기입행은 nulls-distinct라 서로 충돌하지 않음 — 의도된 동작.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ops_entity_ledger_dedup
  ON ops_entity_ledger (booking_id, entity, type, source);

CREATE INDEX IF NOT EXISTS ix_ops_entity_ledger_period
  ON ops_entity_ledger (entity, period);

ALTER TABLE ops_entity_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ops_entity_ledger FROM anon, authenticated;

COMMENT ON TABLE ops_entity_ledger IS
  '법인별 거래 원장 (plan §6.1 F-1 캡처 기입 → 5472 대사 + 월 정산 원천). amount_minor=정수 minor units. service-role 전용.';
