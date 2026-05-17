-- Phase 6.5 — enrich match_pois with the rich content surfaced in
-- tour-product detail-page itineraryStops (description, highlights,
-- smartNotes, visitBasics, images gallery, whyOnRoute).
--
-- visit_basics / convenience / smart_notes already exist (jsonb) — just
-- never populated. Add description / highlights / images / why_on_route
-- here; enrichment script writes all of them in one pass.

ALTER TABLE public.match_pois
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS highlights jsonb,
  ADD COLUMN IF NOT EXISTS images jsonb,
  ADD COLUMN IF NOT EXISTS why_on_route text;
