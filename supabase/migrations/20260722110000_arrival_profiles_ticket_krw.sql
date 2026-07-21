-- J1 — sticky per-POI ticket price for ticketless join tours
-- (docs/join-tour-ticketless-rich-itinerary-master-plan-2026-07-22.md).
-- The bundle's ticket line upgrades from "tickets are needed here" to
-- "admission is ₩5,000 per adult — buy at the booth" once the price is set.

ALTER TABLE public.tour_poi_arrival_profiles
  ADD COLUMN IF NOT EXISTS ticket_krw integer
    CHECK (ticket_krw IS NULL OR (ticket_krw >= 0 AND ticket_krw <= 1000000));
