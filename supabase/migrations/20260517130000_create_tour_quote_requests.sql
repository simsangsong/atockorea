-- Itinerary Builder Phase 4d — quote request inbox.
-- Manual quote tier first (status='pending_manual'); Phase 5 will layer
-- auto-quote columns (auto_quote_amount_krw, auto_quote_breakdown,
-- precedent_quote_id) and a quote_memory precedent table.

CREATE TABLE IF NOT EXISTS public.tour_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_keys text[] NOT NULL DEFAULT '{}',
  region text NOT NULL,
  track text NOT NULL CHECK (track IN ('private', 'cruise')),
  requested_date date NULL,
  party_size int NULL,
  contact_name text NULL,
  contact_email text NOT NULL,
  language text NULL,
  notes text NULL,
  locale text NULL,
  intake jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_url text NULL,
  status text NOT NULL DEFAULT 'pending_manual' CHECK (status IN ('pending_manual', 'auto_quoted', 'responded', 'closed', 'cancelled')),
  manual_quote_amount_krw int NULL,
  manual_quote_response jsonb NULL,
  manual_responded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tour_quote_requests_status
  ON public.tour_quote_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tour_quote_requests_contact_email
  ON public.tour_quote_requests (contact_email);

CREATE INDEX IF NOT EXISTS idx_tour_quote_requests_region_track
  ON public.tour_quote_requests (region, track);

-- updated_at auto-bump on UPDATE
CREATE OR REPLACE FUNCTION public.tg_tour_quote_requests_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tour_quote_requests_set_updated_at ON public.tour_quote_requests;
CREATE TRIGGER tour_quote_requests_set_updated_at
  BEFORE UPDATE ON public.tour_quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_tour_quote_requests_set_updated_at();

-- RLS: only service-role writes; reads via signed admin context only.
ALTER TABLE public.tour_quote_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tour_quote_requests no public access" ON public.tour_quote_requests;
CREATE POLICY "tour_quote_requests no public access"
  ON public.tour_quote_requests
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
