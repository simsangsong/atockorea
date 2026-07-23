-- AtoC 통합 Phase 2 slice 2 — room-claim invite ledger rows (plan §5.1/§5.2).
--
-- 룸 초대 링크(조인투어 일괄 발송용, scope = tour_id + tour_date)의 폐기 원장은
-- 기존 tour_room_invites를 그대로 쓴다 (§5.1: "tour_room_invites에
-- role='room_claim' 행으로 원장 기록"). 현재 role CHECK가
-- ('guide','customer','driver')라 행 삽입이 막히므로 화이트리스트만 넓힌다.
-- 스코프 규칙: room_claim은 guide/driver처럼 tour_id + tour_date 필수.
--
-- 기존 데이터·기존 role 의미는 전부 무변경 (additive constraint widening —
-- 20260716120000 ⑤ / 20260718150000과 동일 패턴).
--
-- ⚠ 적용 금지 상태로 파일만 커밋 (슬라이스 프로토콜). 적용은 사람 검토 후.

alter table public.tour_room_invites
  drop constraint if exists tour_room_invites_role_check;
alter table public.tour_room_invites
  add constraint tour_room_invites_role_check
  check (role in ('guide', 'customer', 'driver', 'room_claim'));

alter table public.tour_room_invites
  drop constraint if exists tour_room_invites_scope_check;
alter table public.tour_room_invites
  add constraint tour_room_invites_scope_check
  check (
    (role = 'customer' and booking_id is not null)
    or (role in ('guide', 'driver', 'room_claim') and tour_id is not null and tour_date is not null)
  );

comment on constraint tour_room_invites_role_check on public.tour_room_invites is
  'guide/customer/driver + room_claim (조인투어 룸 초대 링크 원장 — plan §5.1).';
