-- Itinerary Builder Phase 5 — auto-quote engine schema.
-- See docs/itinerary-builder-plan.md sec.F Phase 5.

-- quote_presets: per-(region, track) pricing knobs. Ops-editable in Studio.
CREATE TABLE IF NOT EXISTS public.quote_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL,
  track text NOT NULL CHECK (track IN ('private', 'cruise')),
  base_krw int NOT NULL,
  vehicle_tier_table jsonb NOT NULL,
  per_hour_krw int NOT NULL,
  hours_baseline_h numeric(4,2) NOT NULL,
  per_km_krw int NOT NULL,
  km_baseline_km int NOT NULL,
  per_poi_krw int NOT NULL,
  poi_baseline_count int NOT NULL,
  language_premium jsonb NOT NULL,
  in_scope_rules jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (region, track)
);

CREATE OR REPLACE FUNCTION public.tg_quote_presets_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS quote_presets_set_updated_at ON public.quote_presets;
CREATE TRIGGER quote_presets_set_updated_at
  BEFORE UPDATE ON public.quote_presets
  FOR EACH ROW EXECUTE FUNCTION public.tg_quote_presets_set_updated_at();

ALTER TABLE public.quote_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_presets no public access" ON public.quote_presets;
CREATE POLICY "quote_presets no public access"
  ON public.quote_presets FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- quote_memory: precedent log of manual quotes (ops responses). Future
-- requests with the same fingerprint will reference this for an estimate.
CREATE TABLE IF NOT EXISTS public.quote_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_fingerprint text NOT NULL,
  region text NOT NULL,
  track text NOT NULL CHECK (track IN ('private', 'cruise')),
  intake jsonb NOT NULL DEFAULT '{}'::jsonb,
  cart_poi_keys text[] NOT NULL DEFAULT '{}',
  manual_amount_krw int NOT NULL,
  notes text,
  source_quote_request_id uuid REFERENCES public.tour_quote_requests(id) ON DELETE SET NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_memory_fingerprint
  ON public.quote_memory (condition_fingerprint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_memory_region_track
  ON public.quote_memory (region, track, created_at DESC);

ALTER TABLE public.quote_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_memory no public access" ON public.quote_memory;
CREATE POLICY "quote_memory no public access"
  ON public.quote_memory FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Extend tour_quote_requests with auto-quote columns + precedent FK.
ALTER TABLE public.tour_quote_requests
  ADD COLUMN IF NOT EXISTS auto_quote_amount_krw int NULL,
  ADD COLUMN IF NOT EXISTS auto_quote_breakdown jsonb NULL,
  ADD COLUMN IF NOT EXISTS precedent_quote_id uuid NULL
    REFERENCES public.quote_memory(id) ON DELETE SET NULL;
