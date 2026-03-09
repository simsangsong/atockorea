-- ============================================
-- Tour Mode: guide spots, facilities, bus details
-- For app: audio spots, restrooms, ticket offices, bus info, departure alarms
-- ============================================

-- 1. Tour guide spots (audio spots per tour) – for location-triggered audio
CREATE TABLE IF NOT EXISTS tour_guide_spots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  audio_url TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  trigger_radius_m INTEGER NOT NULL DEFAULT 80,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_guide_spots_tour_id ON tour_guide_spots(tour_id);

-- 2. Tour facilities (restrooms, ticket offices, convenience, etc.)
CREATE TABLE IF NOT EXISTS tour_facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('restroom', 'ticket_office', 'convenience', 'restaurant', 'other')),
  name TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_facilities_tour_id ON tour_facilities(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_facilities_type ON tour_facilities(type);

-- 3. Bus details per tour date (sent by admin the day before)
CREATE TABLE IF NOT EXISTS tour_bus_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  tour_date DATE NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tour_id, tour_date)
);

CREATE INDEX IF NOT EXISTS idx_tour_bus_details_tour_id ON tour_bus_details(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_bus_details_tour_date ON tour_bus_details(tour_date);

-- 4. Optional: short booking reference for guest lookup (e.g. A2C-XXXX)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_reference TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_bookings_booking_reference ON bookings(booking_reference) WHERE booking_reference IS NOT NULL;

-- Comment: schedule in tours table can include departure_time per stop for bus alarms:
-- e.g. schedule: [ { "time": "09:00", "title": "Pickup", "description": "...", "departure_time": "09:00" }, ... ]
-- App will use tour.schedule + tour_date to compute exact datetime and set 10/5/2 min alarms.

-- RLS: guide spots and facilities are public read (tour content). Bus details read via API only.
ALTER TABLE tour_guide_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_bus_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tour_guide_spots" ON tour_guide_spots FOR SELECT USING (true);
CREATE POLICY "Public read tour_facilities" ON tour_facilities FOR SELECT USING (true);
CREATE POLICY "Authenticated read tour_bus_details" ON tour_bus_details FOR SELECT TO authenticated USING (true);
-- Insert/Update/Delete for these tables is done via API with admin auth (service role bypasses RLS).
