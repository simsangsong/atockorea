-- Add optional schedule hero image URL for itinerary/schedule page banner (16:9).
-- When set, used as the hero banner at top of schedule section; otherwise first gallery image is used.
ALTER TABLE tours
  ADD COLUMN IF NOT EXISTS schedule_hero_image_url TEXT;

COMMENT ON COLUMN tours.schedule_hero_image_url IS 'Optional image URL for the schedule/itinerary hero banner (16:9). Used on tour detail schedule section.';
