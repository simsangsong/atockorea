-- Language-agnostic driver↔guest bridge (사용자 확정 2026-07-18).
--
-- chat_locale = the raw detected base language of the participant's most
-- recent typed/spoken chat message ('fr', 'de', 'th', …) — unlike `locale`,
-- which stays folded to the 5 room UI locales. The messages API unions
-- distinct chat_locales into every fan-out's translation targets, so a
-- driver's Korean reply comes back as a bubble in whatever language the
-- guest actually wrote. POI/tour content capsules keep the fixed room-locale
-- bundles (P-D10) — this column only widens the live-chat plane.

alter table public.tour_room_participants
  add column if not exists chat_locale text;

comment on column public.tour_room_participants.chat_locale is
  'Detected base language of the participant''s last chat message (language-agnostic bridge). NULL until they write; distinct from the 5-locale folded `locale`.';
