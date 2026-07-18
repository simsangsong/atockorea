-- Ops Freedom fix (2026-07-18) — pre-existing live bug: the ops console's
-- mint-and-copy link buttons write sent_via='ops-link', but the invites CHECK
-- only allowed email|sms|manual → every 손님/가이드 링크 button 500'd since the
-- ops PWA wave. Widen the constraint (additive; 'qr' reserved for future).

alter table public.tour_room_invites
  drop constraint if exists tour_room_invites_sent_via_check;

alter table public.tour_room_invites
  add constraint tour_room_invites_sent_via_check
  check (sent_via = any (array['email'::text, 'sms'::text, 'manual'::text, 'ops-link'::text, 'qr'::text]));
