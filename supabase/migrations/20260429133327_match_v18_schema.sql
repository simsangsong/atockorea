-- =============================================================================
-- Tour Matching v1.8 — Catalog snapshot tables for the matching engine
-- =============================================================================
-- The matching engine (`lib/tour-match-v2/`) reads its own denormalized snapshot
-- of the v17 catalog. We do not mutate `tours`/`tour_product_pages`/
-- `tour_matching_profiles` (those drive marketing/detail/pricing). Instead we
-- write a parallel `match_*` set populated by `scripts/import-match-v18.mjs`.
--
--   match_tours              — full v17 .en.json doc + JSON-derived index columns
--   match_pois               — POI knowledge base v1.30
--   match_itinerary_stops    — flattened (tour_slug, stop_index) → poi_key
--   match_queries            — every parser+matcher call (audit + cost telemetry)
--
-- pgvector embedding columns are placeholders (NULL) — populated by a separate
-- script when semantic search is activated.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- match_tours
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.match_tours (
  slug                       TEXT PRIMARY KEY,
  product_id                 TEXT,
  locale                     TEXT NOT NULL DEFAULT 'en',
  schema_version             INTEGER NOT NULL,

  -- v17 source-of-truth (JSON original; matching_metadata preserved verbatim)
  full_document              JSONB NOT NULL,
  matching_profile           JSONB NOT NULL,
  matching_metadata          JSONB,

  -- Denormalized index columns (DERIVED from full_document at import time)
  available_months           INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::INTEGER[],
  primary_themes             TEXT[]    NOT NULL DEFAULT '{}',
  secondary_themes           TEXT[]    NOT NULL DEFAULT '{}',
  best_for                   TEXT[]    NOT NULL DEFAULT '{}',
  not_recommended_for        TEXT[]    NOT NULL DEFAULT '{}',
  anchor_poi_keys            TEXT[]    NOT NULL DEFAULT '{}',
  competing_products         TEXT[]    NOT NULL DEFAULT '{}',
  destination_region         TEXT,
  pickup_region              TEXT,
  duration_hours             NUMERIC(4,1),
  vehicle_type               TEXT,

  headline_line1             TEXT,
  headline_line2             TEXT,
  seo_title                  TEXT,

  enrichment_batch           TEXT,
  kb_version                 TEXT,
  profile_version            INTEGER,
  a_grade                    BOOLEAN NOT NULL DEFAULT FALSE,
  is_cruise_excursion        BOOLEAN NOT NULL DEFAULT FALSE,
  is_charter_route_options   BOOLEAN NOT NULL DEFAULT FALSE,

  -- Future semantic-search placeholder
  embedding                  vector(1536),

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_tours_mp_gin            ON public.match_tours USING GIN (matching_profile jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_match_tours_primary_themes    ON public.match_tours USING GIN (primary_themes);
CREATE INDEX IF NOT EXISTS idx_match_tours_secondary_themes  ON public.match_tours USING GIN (secondary_themes);
CREATE INDEX IF NOT EXISTS idx_match_tours_anchor_pois       ON public.match_tours USING GIN (anchor_poi_keys);
CREATE INDEX IF NOT EXISTS idx_match_tours_best_for          ON public.match_tours USING GIN (best_for);
CREATE INDEX IF NOT EXISTS idx_match_tours_available_months  ON public.match_tours USING GIN (available_months);
CREATE INDEX IF NOT EXISTS idx_match_tours_destination       ON public.match_tours (destination_region);
CREATE INDEX IF NOT EXISTS idx_match_tours_locale            ON public.match_tours (locale);
CREATE INDEX IF NOT EXISTS idx_match_tours_a_grade           ON public.match_tours (a_grade) WHERE a_grade = TRUE;
CREATE INDEX IF NOT EXISTS idx_match_tours_cruise            ON public.match_tours (is_cruise_excursion);
CREATE INDEX IF NOT EXISTS idx_match_tours_charter           ON public.match_tours (is_charter_route_options);

CREATE OR REPLACE FUNCTION public.match_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_match_tours_updated_at ON public.match_tours;
CREATE TRIGGER trg_match_tours_updated_at
BEFORE UPDATE ON public.match_tours
FOR EACH ROW EXECUTE FUNCTION public.match_set_updated_at();

-- ---------------------------------------------------------------------------
-- match_pois
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.match_pois (
  poi_key            TEXT PRIMARY KEY,
  name_en            TEXT,
  name_ko            TEXT,

  poi_meta           JSONB NOT NULL,
  visit_basics       JSONB,
  convenience        JSONB,
  smart_notes        JSONB,

  -- v1.30 schema extension (optional — matcher works without)
  default_image_url  TEXT,
  stop_role          TEXT,

  is_attraction      BOOLEAN,
  is_operational     BOOLEAN GENERATED ALWAYS AS (poi_key LIKE 'OPS_%') STORED,
  region             TEXT,
  kb_version         TEXT,

  embedding          vector(1536),

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_pois_meta_gin  ON public.match_pois USING GIN (poi_meta jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_match_pois_region    ON public.match_pois (region);

DROP TRIGGER IF EXISTS trg_match_pois_updated_at ON public.match_pois;
CREATE TRIGGER trg_match_pois_updated_at
BEFORE UPDATE ON public.match_pois
FOR EACH ROW EXECUTE FUNCTION public.match_set_updated_at();

-- ---------------------------------------------------------------------------
-- match_itinerary_stops
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.match_itinerary_stops (
  id                   BIGSERIAL PRIMARY KEY,
  tour_slug            TEXT NOT NULL REFERENCES public.match_tours(slug) ON DELETE CASCADE,
  stop_index           INTEGER NOT NULL,
  poi_key              TEXT,
  title                TEXT,
  description_length   INTEGER,
  highlights_count     INTEGER,
  why_on_route_length  INTEGER,
  time_used_count      INTEGER,
  sources_count        INTEGER,
  is_operational       BOOLEAN GENERATED ALWAYS AS (poi_key LIKE 'OPS_%') STORED,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tour_slug, stop_index)
);

CREATE INDEX IF NOT EXISTS idx_match_stops_tour ON public.match_itinerary_stops (tour_slug);
CREATE INDEX IF NOT EXISTS idx_match_stops_poi  ON public.match_itinerary_stops (poi_key);

-- ---------------------------------------------------------------------------
-- match_queries — audit + Haiku token cost telemetry
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.match_queries (
  id                          BIGSERIAL PRIMARY KEY,
  raw_query                   TEXT NOT NULL,
  raw_query_locale            TEXT,
  parsed_query                JSONB NOT NULL,
  top_matches                 JSONB NOT NULL,
  matched_tour_count          INTEGER,
  parser_model                TEXT,
  parser_input_tokens         INTEGER,
  parser_cache_read_tokens    INTEGER,
  parser_cache_create_tokens  INTEGER,
  parser_output_tokens        INTEGER,
  parser_cost_usd             NUMERIC(10,6),
  parse_elapsed_ms            INTEGER,
  match_elapsed_ms            INTEGER,
  user_session_id             TEXT,
  user_locale                 TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mq_created_at ON public.match_queries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mq_session    ON public.match_queries (user_session_id);

-- ---------------------------------------------------------------------------
-- Helper: catalog_match_candidates() — server-side hard filter pre-pass
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.match_catalog_candidates(
  p_months           INTEGER[] DEFAULT NULL,
  p_region           TEXT      DEFAULT NULL,
  p_required_themes  TEXT[]    DEFAULT NULL,
  p_excluded_themes  TEXT[]    DEFAULT NULL,
  p_locale           TEXT      DEFAULT 'en'
)
RETURNS TABLE (
  slug                 TEXT,
  matching_profile     JSONB,
  primary_themes       TEXT[],
  secondary_themes     TEXT[],
  best_for             TEXT[],
  not_recommended_for  TEXT[],
  anchor_poi_keys      TEXT[],
  available_months     INTEGER[],
  destination_region   TEXT,
  a_grade              BOOLEAN,
  is_cruise_excursion  BOOLEAN,
  is_charter_route_options BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT t.slug, t.matching_profile, t.primary_themes, t.secondary_themes,
         t.best_for, t.not_recommended_for, t.anchor_poi_keys,
         t.available_months, t.destination_region, t.a_grade,
         t.is_cruise_excursion, t.is_charter_route_options
  FROM public.match_tours t
  WHERE t.locale = p_locale
    AND (p_months IS NULL OR t.available_months && p_months)
    AND (p_region IS NULL OR t.destination_region = p_region OR p_region = ANY(t.primary_themes))
    AND (p_required_themes IS NULL OR t.primary_themes && p_required_themes OR t.secondary_themes && p_required_themes)
    AND (p_excluded_themes IS NULL OR NOT (t.primary_themes && p_excluded_themes));
END;
$$ LANGUAGE plpgsql STABLE;

-- ---------------------------------------------------------------------------
-- RLS — anon read on match_tours / match_pois / match_itinerary_stops; service-role write.
-- match_queries is service-role only (PII potential).
-- ---------------------------------------------------------------------------

ALTER TABLE public.match_tours              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_pois               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_itinerary_stops    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_queries            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_match_tours_anon_read    ON public.match_tours;
CREATE POLICY p_match_tours_anon_read ON public.match_tours FOR SELECT TO anon USING (TRUE);
DROP POLICY IF EXISTS p_match_pois_anon_read     ON public.match_pois;
CREATE POLICY p_match_pois_anon_read ON public.match_pois FOR SELECT TO anon USING (TRUE);
DROP POLICY IF EXISTS p_match_stops_anon_read    ON public.match_itinerary_stops;
CREATE POLICY p_match_stops_anon_read ON public.match_itinerary_stops FOR SELECT TO anon USING (TRUE);
-- match_queries: no anon policy → service_role only (default)
