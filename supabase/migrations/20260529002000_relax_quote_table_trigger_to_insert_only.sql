-- Phase 10.5.1 audit fix — relax the quote-pipe trigger.
-- The original 20260529001000_block_quote_table_writes.sql trigger fired on
-- BEFORE INSERT OR UPDATE, which (1) defeated the planner's promise of a
-- 90-day audit window since ops couldn't archive, mark resolved, or annotate
-- the 1 retained `auto_quoted` row, and (2) caught GDPR redactions / backfills.
-- We only need to block NEW writes — UPDATE on existing rows is legitimate
-- audit / cleanup activity that must remain possible until the tables drop.

DROP TRIGGER IF EXISTS block_writes_tour_quote_requests ON public.tour_quote_requests;
CREATE TRIGGER block_writes_tour_quote_requests
  BEFORE INSERT ON public.tour_quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.block_quote_table_write();

DROP TRIGGER IF EXISTS block_writes_quote_memory ON public.quote_memory;
CREATE TRIGGER block_writes_quote_memory
  BEFORE INSERT ON public.quote_memory
  FOR EACH ROW EXECUTE FUNCTION public.block_quote_table_write();

DROP TRIGGER IF EXISTS block_writes_quote_presets ON public.quote_presets;
CREATE TRIGGER block_writes_quote_presets
  BEFORE INSERT ON public.quote_presets
  FOR EACH ROW EXECUTE FUNCTION public.block_quote_table_write();

-- Also tighten search_path on the function so the Supabase advisor stops
-- flagging it as `function_search_path_mutable` (would otherwise mask any
-- new RLS/SQL warnings raised during the 90-day window).
CREATE OR REPLACE FUNCTION public.block_quote_table_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'tour_quote_requests / quote_memory / quote_presets INSERTs are blocked. The itinerary-builder now creates rows directly in bookings (Phase 10.5). UPDATE on existing rows is allowed for audit/redaction.'
    USING HINT = 'Use POST /api/itinerary/book instead.';
END;
$$;

COMMENT ON FUNCTION public.block_quote_table_write() IS
  'Phase 10.5c safety net (10.5.1 relaxed to INSERT-only) — raises on any INSERT to the retired quote-pipe tables. UPDATE still allowed for audit/redaction during the 90-day retention.';
