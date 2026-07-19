-- Kakao-grade chat foundation: attachments, reply anchor, read cursor, reactions.
-- (Track: docs/tour-room-chat-kakao-guide-console-redesign-master-plan-2026-07-19.md, Phase 1)

-- 1) Attachment message kinds (image / file) alongside text / audio.
ALTER TABLE public.tour_room_messages
  DROP CONSTRAINT IF EXISTS tour_room_messages_input_kind_check;
ALTER TABLE public.tour_room_messages
  ADD CONSTRAINT tour_room_messages_input_kind_check
  CHECK (input_kind IN ('text', 'audio', 'image', 'file'));

-- 2) Reply anchor (the display snapshot lives in metadata.reply_to; this column
--    is the scroll/highlight anchor and survives windowing).
ALTER TABLE public.tour_room_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid
  REFERENCES public.tour_room_messages(id) ON DELETE SET NULL;

-- 3) Read cursor per participant (read receipts).
ALTER TABLE public.tour_room_participants
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

-- 4) Emoji reactions. Service-role-only (all writes go through authenticated API
--    routes with the service client; clients receive updates via Realtime
--    broadcast, never direct table reads) — RLS on, no anon policies, matching
--    the rest of the tour_room_* family (pins / extras / events / spot_events).
CREATE TABLE IF NOT EXISTS public.tour_room_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.tour_room_messages(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.tour_rooms(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.tour_room_participants(id) ON DELETE SET NULL,
  role text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (message_id, participant_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_trm_reactions_message
  ON public.tour_room_message_reactions(message_id);
ALTER TABLE public.tour_room_message_reactions ENABLE ROW LEVEL SECURITY;
