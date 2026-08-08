-- 입장 코드 (smart-guide-entry-code-master-plan-2026-08-08 §C) — 345자 토큰 링크를
-- 사람이 다룰 수 있는 코드/짧은 링크로 바꾸는 DB 절반. 전부 additive.
--
-- ① tour_room_invites.short_code — 발송된 초대 1건의 짧은 별칭 (/r/{code} 문).
--    행이 revoke 되면 짧은 링크도 죽는다: 재발송 폐기-후-재발급(B0-D1c)·예약 취소
--    훅(§O-1 ⑧)의 기존 revoke 규칙이 그대로 짧은 링크에 적용된다. 레거시 행은 NULL.
--
-- ② sent_via CHECK 확장 — 'entry-code'(새 문) + 배포된 코드가 이미 쓰는데 CHECK 가
--    라이브에서 조용히 거부하던 2개:
--      'onsite-qr'        → app/api/tour-rooms/[bookingId]/reinvite (insert 실패 → 500)
--      'ops-bulk-message' → bulk-message mintRoomLink (insert 실패 → null 링크 →
--                           {room_link} 필수 템플릿에서 수신자 전원 skip)
--    실측 2026-08-08: 라이브 원장에 두 값 모두 0행 — 기능이 나간 적이 없다.
--
-- ③ bookings.booking_reference 백필 — 타이핑 입장용 상설 코드(A2C-XXXXXXXX).
--    빌더 예약만 채우고 있었다(61건 중 2건). 형식은 createBuilderBooking 의
--    bookingReferenceSlug 와 동일(A2C- + 대문자 hex 8자).

alter table public.tour_room_invites
  add column if not exists short_code text;

comment on column public.tour_room_invites.short_code is
  '짧은 링크(/r/{code}) 별칭 — 이 초대가 revoke/만료되면 별칭도 죽는다. 발급: lib/tour-room/entryCode.ts';

create unique index if not exists idx_tour_room_invites_short_code
  on public.tour_room_invites (short_code)
  where short_code is not null;

alter table public.tour_room_invites
  drop constraint if exists tour_room_invites_sent_via_check;
alter table public.tour_room_invites
  add constraint tour_room_invites_sent_via_check
  check (sent_via = any (array[
    'email'::text, 'sms'::text, 'manual'::text, 'ops-link'::text, 'qr'::text,
    'onsite-qr'::text, 'ops-bulk-message'::text, 'entry-code'::text
  ]));

update public.bookings
  set booking_reference = 'A2C-' || upper(substr(md5(gen_random_uuid()::text || id::text), 1, 8))
  where booking_reference is null;
