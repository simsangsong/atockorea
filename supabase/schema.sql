-- ============================================
-- AtoCKorea Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. TOURS TABLE (旅游产品表)
-- ============================================
CREATE TABLE IF NOT EXISTS tours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  city TEXT NOT NULL CHECK (city IN ('Seoul', 'Busan', 'Jeju')),
  tag TEXT,
  subtitle TEXT,
  description TEXT,
  
  -- Pricing
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  price_type TEXT NOT NULL CHECK (price_type IN ('person', 'group')),
  
  -- Images
  image_url TEXT NOT NULL,
  gallery_images JSONB DEFAULT '[]'::jsonb,
  
  -- Tour Details
  duration TEXT, -- e.g., "09:00–17:00 · 8 hours"
  lunch_included BOOLEAN DEFAULT false,
  ticket_included BOOLEAN DEFAULT false,
  pickup_info TEXT,
  notes TEXT,
  
  -- Content
  highlights JSONB DEFAULT '[]'::jsonb, -- Array of strings
  includes JSONB DEFAULT '[]'::jsonb, -- Array of strings
  excludes JSONB DEFAULT '[]'::jsonb, -- Array of strings
  schedule JSONB DEFAULT '[]'::jsonb, -- Array of {time, title, description}
  faqs JSONB DEFAULT '[]'::jsonb, -- Array of {question, answer}
  
  -- Metadata
  rating DECIMAL(3, 2) DEFAULT 0.0,
  review_count INTEGER DEFAULT 0,
  pickup_points_count INTEGER DEFAULT 0,
  dropoff_points_count INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for tours
CREATE INDEX idx_tours_city ON tours(city);
CREATE INDEX idx_tours_slug ON tours(slug);
CREATE INDEX idx_tours_is_active ON tours(is_active);
CREATE INDEX idx_tours_is_featured ON tours(is_featured);
CREATE INDEX idx_tours_price_type ON tours(price_type);

-- ============================================
-- 2. PICKUP_POINTS TABLE (接送点表)
-- ============================================
CREATE TABLE IF NOT EXISTS pickup_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  pickup_time TIME,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_pickup_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE
);

CREATE INDEX idx_pickup_points_tour_id ON pickup_points(tour_id);

-- ============================================
-- 3. BOOKINGS TABLE (预订表)
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE RESTRICT,
  
  -- Booking Details
  tour_date DATE NOT NULL,
  tour_time TIME,
  number_of_people INTEGER NOT NULL CHECK (number_of_people > 0),
  pickup_point_id UUID REFERENCES pickup_points(id),
  
  -- Pricing
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  final_price DECIMAL(10, 2) NOT NULL,
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')) DEFAULT 'pending',
  
  -- Cancellation
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  refund_eligible BOOLEAN DEFAULT true,
  refund_processed BOOLEAN DEFAULT false,
  
  -- Contact Info (for booking)
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  
  -- Timestamps
  booking_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE RESTRICT
);

CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_tour_id ON bookings(tour_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_tour_date ON bookings(tour_date);

-- ============================================
-- 4. REVIEWS TABLE (评价表)
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  
  -- Review Content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  photos JSONB DEFAULT '[]'::jsonb, -- Array of image URLs
  
  -- Status
  is_verified BOOLEAN DEFAULT false, -- Verified purchase
  is_visible BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one review per booking
  CONSTRAINT unique_booking_review UNIQUE (booking_id),
  CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_review_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE
);

CREATE INDEX idx_reviews_tour_id ON reviews(tour_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);

-- ============================================
-- 5. WISHLIST TABLE (收藏表)
-- ============================================
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one wishlist entry per user-tour combination
  CONSTRAINT unique_user_tour_wishlist UNIQUE (user_id, tour_id),
  CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE
);

CREATE INDEX idx_wishlist_user_id ON wishlist(user_id);
CREATE INDEX idx_wishlist_tour_id ON wishlist(tour_id);

-- ============================================
-- 6. CART_ITEMS TABLE (购物车表)
-- ============================================
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  
  -- Cart Item Details
  tour_date DATE,
  tour_time TIME,
  quantity INTEGER NOT NULL CHECK (quantity > 0) DEFAULT 1,
  pickup_point_id UUID REFERENCES pickup_points(id),
  
  -- Pricing (snapshot at time of adding to cart)
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE
);

CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX idx_cart_items_tour_id ON cart_items(tour_id);

-- ============================================
-- 7. USER_PROFILES TABLE (用户扩展信息表)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  language_preference TEXT DEFAULT 'en' CHECK (language_preference IN ('en', 'zh', 'ko')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  PRIMARY KEY (id)
);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_tours_updated_at BEFORE UPDATE ON tours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update tour rating and review count when review is added/updated/deleted
CREATE OR REPLACE FUNCTION update_tour_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE tours
    SET 
      rating = COALESCE((
        SELECT AVG(rating)::DECIMAL(3,2)
        FROM reviews
        WHERE tour_id = OLD.tour_id AND is_visible = true
      ), 0.0),
      review_count = (
        SELECT COUNT(*)
        FROM reviews
        WHERE tour_id = OLD.tour_id AND is_visible = true
      )
    WHERE id = OLD.tour_id;
    RETURN OLD;
  ELSE
    UPDATE tours
    SET 
      rating = COALESCE((
        SELECT AVG(rating)::DECIMAL(3,2)
        FROM reviews
        WHERE tour_id = NEW.tour_id AND is_visible = true
      ), 0.0),
      review_count = (
        SELECT COUNT(*)
        FROM reviews
        WHERE tour_id = NEW.tour_id AND is_visible = true
      )
    WHERE id = NEW.tour_id;
    RETURN NEW;
  END IF;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tour_rating_on_review
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_tour_rating();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Tours: Public read, admin write
CREATE POLICY "Tours are viewable by everyone"
  ON tours FOR SELECT
  USING (is_active = true);

CREATE POLICY "Tours are insertable by authenticated users with admin role"
  ON tours FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Tours are updatable by authenticated users with admin role"
  ON tours FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');

-- Pickup Points: Public read
CREATE POLICY "Pickup points are viewable by everyone"
  ON pickup_points FOR SELECT
  USING (is_active = true);

-- Bookings: Users can only see their own bookings
CREATE POLICY "Users can view their own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id);

-- Reviews: Public read, users can write their own
CREATE POLICY "Reviews are viewable by everyone"
  ON reviews FOR SELECT
  USING (is_visible = true);

CREATE POLICY "Users can insert their own reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Wishlist: Users can only see their own
CREATE POLICY "Users can view their own wishlist"
  ON wishlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wishlist items"
  ON wishlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wishlist items"
  ON wishlist FOR DELETE
  USING (auth.uid() = user_id);

-- Cart Items: Users can only see their own
CREATE POLICY "Users can view their own cart items"
  ON cart_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cart items"
  ON cart_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cart items"
  ON cart_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cart items"
  ON cart_items FOR DELETE
  USING (auth.uid() = user_id);

-- User Profiles: Users can view and update their own
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

