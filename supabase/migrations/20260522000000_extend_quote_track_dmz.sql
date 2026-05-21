-- Phase 9 (pricing policy overhaul): allow the DMZ fixed-price track.
-- Additive + idempotent — existing 'private'/'cruise' rows stay valid.
ALTER TABLE public.tour_quote_requests
  DROP CONSTRAINT IF EXISTS tour_quote_requests_track_check;

ALTER TABLE public.tour_quote_requests
  ADD CONSTRAINT tour_quote_requests_track_check
  CHECK (track = ANY (ARRAY['private'::text, 'cruise'::text, 'dmz'::text]));
