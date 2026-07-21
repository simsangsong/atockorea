-- J0 — ticket-booth facility pins
-- (docs/join-tour-ticketless-rich-itinerary-master-plan-2026-07-22.md).
--
-- Ticketless join tours make "where do I buy my ticket?" the FIRST question
-- at every paid attraction — the booth pin answers it in every language.

ALTER TABLE public.poi_facility_pins DROP CONSTRAINT poi_facility_pins_kind_check;
ALTER TABLE public.poi_facility_pins
  ADD CONSTRAINT poi_facility_pins_kind_check
  CHECK (kind IN ('restroom', 'photo', 'restaurant', 'ticket_booth'));
