-- Add event metadata for translated tour room messages and spot-triggered guide events.

ALTER TABLE public.tour_room_messages
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tour_room_messages_metadata_kind
  ON public.tour_room_messages ((metadata->>'kind'));

CREATE TABLE IF NOT EXISTS public.tour_room_spot_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.tour_rooms(id) ON DELETE CASCADE,
  spot_id uuid NOT NULL REFERENCES public.tour_guide_spots(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.tour_room_messages(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('arrived', 'audio_played', 'meeting_notice_sent')),
  triggered_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  distance_m integer,
  current_latitude numeric(10, 8),
  current_longitude numeric(11, 8),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, spot_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_tour_room_spot_events_booking_id
  ON public.tour_room_spot_events(booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tour_room_spot_events_room_id
  ON public.tour_room_spot_events(room_id, created_at DESC);

ALTER TABLE public.tour_room_spot_events ENABLE ROW LEVEL SECURITY;
