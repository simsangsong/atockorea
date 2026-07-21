-- A3 — guest drop-off change pin (docs/smart-guide-ops-detail-audit-2026-07-21.md).
-- 'pickup' already exists in the CHECK (used by the pickup-request signal);
-- 'dropoff' is the guest's requested new drop-off point.

ALTER TABLE public.tour_room_pins DROP CONSTRAINT tour_room_pins_kind_check;
ALTER TABLE public.tour_room_pins
  ADD CONSTRAINT tour_room_pins_kind_check
  CHECK (kind IN ('parking', 'rally', 'pickup', 'vehicle_arrived', 'lost_me', 'dropoff'));
