-- AtoC 통합 §5.2 C-6 — 동행자 초대 링크 원장 행 (동행자 개별 디바이스 등록).
--
-- lead가 발급하는 "동행자 초대" 링크의 폐기·감사 원장은 기존 tour_room_invites를
-- 그대로 쓴다 (룸 claim 링크와 동일 패턴, 20260724090000). 현재 role CHECK가
-- ('guide','customer','driver','room_claim')라 행 삽입이 막히므로 화이트리스트만
-- 넓힌다.
--
-- 스코프 규칙: companion은 customer처럼 **한 예약**에 묶인다 (booking_id 필수).
-- 링크가 예약 하나만 열 수 있어야 한다는 것이 이 기능의 핵심 가드레일이라,
-- 스코프 CHECK가 그 불변식의 DB 측 마지막 방어선이다.
--
-- 기존 데이터·기존 role 의미는 전부 무변경 (additive constraint widening —
-- 20260716120000 ⑤ / 20260718150000 / 20260724090000과 동일 패턴).
--
-- ⚠ 적용 금지 상태로 파일만 커밋 (슬라이스 프로토콜). 적용은 사람 검토 후.

alter table public.tour_room_invites
  drop constraint if exists tour_room_invites_role_check;
alter table public.tour_room_invites
  add constraint tour_room_invites_role_check
  check (role in ('guide', 'customer', 'driver', 'room_claim', 'companion'));

alter table public.tour_room_invites
  drop constraint if exists tour_room_invites_scope_check;
alter table public.tour_room_invites
  add constraint tour_room_invites_scope_check
  check (
    (role in ('customer', 'companion') and booking_id is not null)
    or (role in ('guide', 'driver', 'room_claim') and tour_id is not null and tour_date is not null)
  );

comment on constraint tour_room_invites_role_check on public.tour_room_invites is
  'guide/customer/driver + room_claim (조인투어 룸 초대, §5.1) + companion (동행자 초대, §5.2 C-6).';
