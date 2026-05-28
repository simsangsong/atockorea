-- Phase 10.5c — block any new writes to the retired quote-pipe tables.
-- See docs/itinerary-builder-flow-simplification-master-plan-2026-05-28.md
-- §D Phase 5 task 5g + §C D3/D18.
--
-- The application code that used to INSERT here is deleted in this same
-- commit. The triggers are a defense-in-depth safety net so a future
-- accidental write (e.g., a forgotten cron, a CSV import, a backfill script)
-- fails loudly instead of silently re-opening the proposal workflow that
-- caused the ops pain.
--
-- The tables themselves are retained for 90 days of read-only audit (per D3).
-- A follow-up migration will DROP them after the cut-over has been observed.

CREATE OR REPLACE FUNCTION public.block_quote_table_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'tour_quote_requests / quote_memory / quote_presets writes are blocked. The itinerary-builder now creates rows directly in bookings (Phase 10.5).'
    USING HINT = 'Use POST /api/itinerary/book instead.';
END;
$$;

DROP TRIGGER IF EXISTS block_writes_tour_quote_requests ON public.tour_quote_requests;
CREATE TRIGGER block_writes_tour_quote_requests
  BEFORE INSERT OR UPDATE ON public.tour_quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.block_quote_table_write();

DROP TRIGGER IF EXISTS block_writes_quote_memory ON public.quote_memory;
CREATE TRIGGER block_writes_quote_memory
  BEFORE INSERT OR UPDATE ON public.quote_memory
  FOR EACH ROW EXECUTE FUNCTION public.block_quote_table_write();

DROP TRIGGER IF EXISTS block_writes_quote_presets ON public.quote_presets;
CREATE TRIGGER block_writes_quote_presets
  BEFORE INSERT OR UPDATE ON public.quote_presets
  FOR EACH ROW EXECUTE FUNCTION public.block_quote_table_write();

COMMENT ON FUNCTION public.block_quote_table_write() IS
  'Phase 10.5c safety net — raises on any INSERT/UPDATE to the retired quote-pipe tables. Drop alongside the tables themselves in the 90-day cleanup migration.';
