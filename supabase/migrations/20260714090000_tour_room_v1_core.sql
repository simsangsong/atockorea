-- Tour Mode v1 (realtime tour room) — core tables M-1..M-5 + translation cache.
-- Master plan: docs/tour-mode-master-plan-2026-07-14.md §C. All additive/idempotent;
-- safe to apply while the feature flag (NEXT_PUBLIC_TOUR_MODE_V1) is OFF.
-- NOT applied live yet — live apply is ticket T0.3 (requires explicit user approval).

------------------------------------------------------------------------------
-- M-2. tour_room_invites — signed invite-token ledger (send/revoke audit).
-- Created before participants because participants.invite_id references it.
-- Token scopes (§B D-2 / §O-3):
--   customer invite → booking scope   (booking_id set, tour_id/tour_date NULL)
--   guide invite    → tour-date scope (tour_id + tour_date set, booking_id NULL)
-- The plan's original sketch had booking_id NOT NULL; §O-3 rescoped guide
-- tokens to tour-date after that sketch, so a guide invite must not die with
-- any single booking's cancellation — hence the split CHECK below.
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_room_invites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES public.tours(id) ON DELETE CASCADE,
  tour_date date,
  role text NOT NULL CHECK (role IN ('guide', 'customer')),
  token_hash text NOT NULL UNIQUE,          -- sha256(token); raw token is never stored
  display_name text,
  sent_to text,
  sent_via text CHECK (sent_via IN ('email', 'sms', 'manual')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tour_room_invites_scope_check CHECK (
    (role = 'customer' AND booking_id IS NOT NULL)
    OR (role = 'guide' AND tour_id IS NOT NULL AND tour_date IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_tour_room_invites_booking_id
  ON public.tour_room_invites(booking_id)
  WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tour_room_invites_tour_date
  ON public.tour_room_invites(tour_id, tour_date)
  WHERE tour_id IS NOT NULL;

------------------------------------------------------------------------------
-- M-1. tour_room_participants — presence, locale targeting, invite tracking.
-- UNIQUE(room_id, device_key), NOT display_name — two "John"s must not merge
-- and a rename must not fork a participant (§O-4). device_key is a client
-- generated uuid kept in localStorage.
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_room_participants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id uuid NOT NULL REFERENCES public.tour_rooms(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer', 'guide', 'admin')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  invite_id uuid REFERENCES public.tour_room_invites(id) ON DELETE SET NULL,
  device_key uuid NOT NULL,
  tts_capable boolean,                      -- device speechSynthesis capability report (§O-2)
  location_sharing boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, device_key)
);

CREATE INDEX IF NOT EXISTS idx_tour_room_participants_room_id
  ON public.tour_room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_tour_room_participants_booking_id
  ON public.tour_room_participants(booking_id);
CREATE INDEX IF NOT EXISTS idx_tour_room_participants_user_id
  ON public.tour_room_participants(user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tour_room_participants_invite_id
  ON public.tour_room_participants(invite_id)
  WHERE invite_id IS NOT NULL;

------------------------------------------------------------------------------
-- M-3. tour_room_locations — last-known location snapshot, one row per
-- participant (high-frequency pings ride the Broadcast channel only, D-4).
-- Retention: rows older than tour date +7 days are purged by an admin job (R-17).
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_room_locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id uuid NOT NULL REFERENCES public.tour_rooms(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL UNIQUE REFERENCES public.tour_room_participants(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer', 'guide', 'admin')),
  latitude numeric(10, 8) NOT NULL,
  longitude numeric(11, 8) NOT NULL,
  accuracy_m integer,
  heading numeric,
  speed_mps numeric,
  recorded_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tour_room_locations_room_id
  ON public.tour_room_locations(room_id);
CREATE INDEX IF NOT EXISTS idx_tour_room_locations_booking_id
  ON public.tour_room_locations(booking_id);

------------------------------------------------------------------------------
-- M-4. tour_guide_spots extension — geofence → full-description content layer
-- (D-5) and exit-radius hysteresis (R-9).
--   content: { [locale]: TourStopDrawerStop-compatible object }
--   poi_key: key into data/poi_kb (fallback content source)
--   exit_radius_m: NULL means trigger_radius_m * 1.5 at evaluation time
------------------------------------------------------------------------------
ALTER TABLE public.tour_guide_spots
  ADD COLUMN IF NOT EXISTS poi_key text,
  ADD COLUMN IF NOT EXISTS content jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS exit_radius_m integer;

------------------------------------------------------------------------------
-- M-5. tour_room_tts_cache — server TTS is cache-only (D-6): one generation
-- per (message, locale), shared by the whole room.
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_room_tts_cache (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id uuid NOT NULL REFERENCES public.tour_room_messages(id) ON DELETE CASCADE,
  locale text NOT NULL,
  storage_path text NOT NULL,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_tour_room_tts_cache_message_id
  ON public.tour_room_tts_cache(message_id);

------------------------------------------------------------------------------
-- Translation memory (§M-2 ④, consumed by lib/ai/router.ts, T0.9) — identical
-- source text + target locale is never re-translated.
-- source_hash = sha256 of trimmed source text.
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_translation_cache (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_hash text NOT NULL,
  locale text NOT NULL,
  source_locale text,
  translated_text text NOT NULL,
  provider text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_hash, locale)
);
