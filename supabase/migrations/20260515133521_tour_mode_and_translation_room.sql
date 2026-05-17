-- 2026-05-15: Tour mode, translation rooms, generated course/audio assets.

CREATE TABLE IF NOT EXISTS public.tour_guide_spots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  audio_url text,
  latitude numeric(10, 8) NOT NULL,
  longitude numeric(11, 8) NOT NULL,
  trigger_radius_m integer NOT NULL DEFAULT 80,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tour_guide_spots_tour_id
  ON public.tour_guide_spots(tour_id);

CREATE TABLE IF NOT EXISTS public.tour_facilities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('restroom', 'ticket_office', 'convenience', 'restaurant', 'other')),
  name text NOT NULL,
  latitude numeric(10, 8) NOT NULL,
  longitude numeric(11, 8) NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tour_facilities_tour_id
  ON public.tour_facilities(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_facilities_type
  ON public.tour_facilities(type);

CREATE TABLE IF NOT EXISTS public.tour_bus_details (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  tour_date date NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tour_id, tour_date)
);

CREATE INDEX IF NOT EXISTS idx_tour_bus_details_tour_id
  ON public.tour_bus_details(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_bus_details_tour_date
  ON public.tour_bus_details(tour_date);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_reference text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_bookings_booking_reference
  ON public.bookings(booking_reference)
  WHERE booking_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.tour_rooms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES public.tours(id) ON DELETE SET NULL,
  tour_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tour_rooms_booking_id
  ON public.tour_rooms(booking_id);

CREATE TABLE IF NOT EXISTS public.tour_room_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id uuid NOT NULL REFERENCES public.tour_rooms(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('customer', 'guide', 'admin', 'system')),
  input_kind text NOT NULL DEFAULT 'text' CHECK (input_kind IN ('text', 'audio')),
  source_text text NOT NULL,
  source_locale text,
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_locales text[] NOT NULL DEFAULT '{}'::text[],
  audio_input_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tour_room_messages_room_id_created_at
  ON public.tour_room_messages(room_id, created_at);

CREATE TABLE IF NOT EXISTS public.tour_content_jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id uuid REFERENCES public.tours(id) ON DELETE SET NULL,
  source_slug text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_locales text[] NOT NULL DEFAULT '{}'::text[],
  text_only_locales text[] NOT NULL DEFAULT '{}'::text[],
  audio_locales text[] NOT NULL DEFAULT '{}'::text[],
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tour_generated_courses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid REFERENCES public.tour_content_jobs(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES public.tours(id) ON DELETE SET NULL,
  locale text NOT NULL,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_course jsonb NOT NULL DEFAULT '{}'::jsonb,
  description_presets jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(job_id, locale)
);

CREATE TABLE IF NOT EXISTS public.tour_audio_assets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid REFERENCES public.tour_content_jobs(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES public.tours(id) ON DELETE SET NULL,
  locale text NOT NULL,
  course_stop_key text NOT NULL,
  text text NOT NULL,
  audio_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'skipped')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tour_guide_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_bus_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_content_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_generated_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_audio_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_public_tour_guide_spots_select ON public.tour_guide_spots;
CREATE POLICY p_public_tour_guide_spots_select
  ON public.tour_guide_spots FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS p_public_tour_facilities_select ON public.tour_facilities;
CREATE POLICY p_public_tour_facilities_select
  ON public.tour_facilities FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS p_admin_tour_mode_tables_all ON public.tour_bus_details;
CREATE POLICY p_admin_tour_mode_tables_all
  ON public.tour_bus_details FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

