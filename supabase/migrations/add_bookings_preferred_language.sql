-- Add preferred_language to bookings (guide language: en, zh, ko)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS preferred_language TEXT;

COMMENT ON COLUMN bookings.preferred_language IS 'Guest preferred guide language: en (English), zh (Chinese), ko (Korean)';
