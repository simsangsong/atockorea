-- A2 — a message can now have MORE THAN ONE spoken track.
--
-- Until now the TTS cache was keyed (message_id, locale), which silently
-- assumed one message = one thing to say. That held while the only spoken text
-- was the message body. It stops holding for arrival cards: the body is the
-- one-line template ("You have arrived near Seongsan") while the actual
-- guiding — the briefing a live guide would speak — lives in the card content.
--
-- `part` splits the two tracks:
--   'body'      — the message text (every pre-existing row).
--   'narration' — the spot briefing composed from the arrival card content.
--
-- The locale column stores the language the audio is REALLY in, so the eight
-- room locales that fall back to English share one generated mp3 instead of
-- paying for eight identical ones.

alter table public.tour_room_tts_cache
  add column if not exists part text not null default 'body';

alter table public.tour_room_tts_cache
  drop constraint if exists tour_room_tts_cache_message_id_locale_key;

create unique index if not exists tour_room_tts_cache_message_locale_part_key
  on public.tour_room_tts_cache (message_id, locale, part);

comment on column public.tour_room_tts_cache.part is
  'Which spoken track this row caches: body (message text) or narration (spot briefing).';
