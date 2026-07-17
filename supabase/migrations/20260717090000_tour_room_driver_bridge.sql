-- Smart Guide Private Mode — W3 driver voice bridge (plan P-D15).
-- tour_room_messages must accept the 'driver' sender so the driver's
-- hands-free voice sends ride the ordinary message pipeline
-- (STT → translate → broadcast bubble). Invites/participants already
-- accept 'driver' since W0 (20260716120000).

alter table public.tour_room_messages
  drop constraint if exists tour_room_messages_sender_role_check;
alter table public.tour_room_messages
  add constraint tour_room_messages_sender_role_check
  check (sender_role in ('customer', 'guide', 'admin', 'system', 'driver'));
