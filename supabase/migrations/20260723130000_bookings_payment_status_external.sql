-- AtoC 통합 Phase 1 slice 2 — payment_status 'external' 허용 (plan §3 A-7a)
-- OTA 인박스 자동커밋 예약은 Stripe 홀드 플로우와 절대 혼선되면 안 된다:
-- payment_status='external' = "결제는 OTA 플랫폼에서 정산됨, Stripe 미개입".
-- 기존 결제 크론은 payment_intent_id NOT NULL / setup_intent_then_hold 조건으로
-- 이미 구조적으로 안전하지만(manual-booking route 주석 참조), 상태값 자체를
-- 구분해 두는 것이 A-7a의 요구다.
--
-- additive: CHECK 목록에 값 1개 추가만. 기존 5개 값 전부 유지.

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check CHECK (
  payment_status = ANY (ARRAY[
    'pending'::text,
    'authorized'::text,
    'paid'::text,
    'refunded'::text,
    'partially_refunded'::text,
    'external'::text
  ])
);
