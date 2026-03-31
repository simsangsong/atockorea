-- User-saved itineraries (Jeju pipeline); RLS scoped to auth.uid()

CREATE TABLE IF NOT EXISTS public.saved_itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT,
  request_json JSONB NOT NULL,
  itinerary_json JSONB NOT NULL,
  summary TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS saved_itineraries_user_id_created_at_desc_idx
  ON public.saved_itineraries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS saved_itineraries_user_id_favorite_idx
  ON public.saved_itineraries (user_id, is_favorite)
  WHERE is_favorite = true;

COMMENT ON TABLE public.saved_itineraries IS 'User-saved generated itineraries (request + validated response JSON)';

CREATE OR REPLACE FUNCTION public.set_saved_itineraries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_saved_itineraries_updated_at ON public.saved_itineraries;
CREATE TRIGGER trg_saved_itineraries_updated_at
  BEFORE UPDATE ON public.saved_itineraries
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_saved_itineraries_updated_at();

ALTER TABLE public.saved_itineraries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_itineraries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_itineraries TO service_role;

CREATE POLICY "saved_itineraries_select_own"
  ON public.saved_itineraries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "saved_itineraries_insert_own"
  ON public.saved_itineraries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_itineraries_update_own"
  ON public.saved_itineraries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_itineraries_delete_own"
  ON public.saved_itineraries
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
