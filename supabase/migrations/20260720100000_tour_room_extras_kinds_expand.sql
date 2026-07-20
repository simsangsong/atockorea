-- TIER 1 (real-world settlement) — expand tour_room_extras.kind so dedicated
-- ticket / overtime / pickup expenses are first-class instead of being silently
-- downgraded to 'other'. Additive (widens the allowed set); applied live
-- 2026-07-20.
ALTER TABLE tour_room_extras DROP CONSTRAINT IF EXISTS tour_room_extras_kind_check;
ALTER TABLE tour_room_extras ADD CONSTRAINT tour_room_extras_kind_check
  CHECK (kind = ANY (ARRAY['advance', 'ticket', 'overtime', 'extension', 'parking', 'pickup', 'other']));
