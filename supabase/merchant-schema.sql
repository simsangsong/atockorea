-- ============================================
-- AtoCKorea Merchant Management Schema Extension
-- ============================================

-- ============================================
-- 1. MERCHANTS TABLE (商家表)
-- ============================================
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Merchant Info
  company_name TEXT NOT NULL,
  business_registration_number TEXT UNIQUE,
  contact_person TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  
  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'South Korea',
  
  -- Bank Account (for settlements)
  bank_name TEXT,
  bank_account_number TEXT,
  account_holder_name TEXT,
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'suspended', 'inactive')) DEFAULT 'pending',
  is_verified BOOLEAN DEFAULT false,
  
  -- Settings
  notification_email TEXT,
  notification_phone TEXT,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_merchant_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_merchants_user_id ON merchants(user_id);
CREATE INDEX idx_merchants_status ON merchants(status);
CREATE INDEX idx_merchants_business_registration ON merchants(business_registration_number);

-- ============================================
-- 2. USER ROLES (扩展user_profiles表)
-- ============================================
-- Add role column to user_profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'merchant', 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- ============================================
-- 3. UPDATE TOURS TABLE - Add merchant_id
-- ============================================
-- Add merchant_id to tours table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tours' AND column_name = 'merchant_id'
  ) THEN
    ALTER TABLE tours ADD COLUMN merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL;
    CREATE INDEX idx_tours_merchant_id ON tours(merchant_id);
  END IF;
END $$;

-- ============================================
-- 4. UPDATE BOOKINGS TABLE - Add merchant_id for quick access
-- ============================================
-- Add merchant_id to bookings table if not exists (denormalized for performance)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'merchant_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL;
    CREATE INDEX idx_bookings_merchant_id ON bookings(merchant_id);
    
    -- Create trigger to auto-update merchant_id from tour
    CREATE OR REPLACE FUNCTION update_booking_merchant_id()
    RETURNS TRIGGER AS $$
    BEGIN
      SELECT merchant_id INTO NEW.merchant_id
      FROM tours
      WHERE id = NEW.tour_id;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
    
    CREATE TRIGGER update_booking_merchant_id_trigger
      BEFORE INSERT OR UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION update_booking_merchant_id();
  END IF;
END $$;

-- ============================================
-- 5. PRODUCT_INVENTORY TABLE (产品库存/名额管理)
-- ============================================
CREATE TABLE IF NOT EXISTS product_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  
  -- Date-based inventory
  tour_date DATE NOT NULL,
  available_spots INTEGER NOT NULL DEFAULT 0,
  reserved_spots INTEGER DEFAULT 0,
  max_capacity INTEGER,
  
  -- Pricing (can override base price)
  price_override DECIMAL(10, 2),
  
  -- Status
  is_available BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_tour_date UNIQUE (tour_id, tour_date),
  CONSTRAINT fk_inventory_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE INDEX idx_inventory_tour_id ON product_inventory(tour_id);
CREATE INDEX idx_inventory_merchant_id ON product_inventory(merchant_id);
CREATE INDEX idx_inventory_tour_date ON product_inventory(tour_date);
CREATE INDEX idx_inventory_is_available ON product_inventory(is_available);

-- ============================================
-- 6. MERCHANT_SETTINGS TABLE (商家设置)
-- ============================================
CREATE TABLE IF NOT EXISTS merchant_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL UNIQUE REFERENCES merchants(id) ON DELETE CASCADE,
  
  -- Notification Settings
  email_notifications_enabled BOOLEAN DEFAULT true,
  sms_notifications_enabled BOOLEAN DEFAULT false,
  new_order_notification BOOLEAN DEFAULT true,
  cancellation_notification BOOLEAN DEFAULT true,
  review_notification BOOLEAN DEFAULT true,
  
  -- Business Settings
  auto_confirm_orders BOOLEAN DEFAULT false,
  cancellation_policy_hours INTEGER DEFAULT 24,
  refund_policy_percentage DECIMAL(5, 2) DEFAULT 100.00,
  
  -- Display Settings
  currency TEXT DEFAULT 'KRW',
  timezone TEXT DEFAULT 'Asia/Seoul',
  language TEXT DEFAULT 'ko',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_settings_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE INDEX idx_settings_merchant_id ON merchant_settings(merchant_id);

-- ============================================
-- 7. TRIGGERS
-- ============================================
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON product_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON merchant_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on new tables
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_settings ENABLE ROW LEVEL SECURITY;

-- Merchants: Only admins can view all, merchants can view their own
CREATE POLICY "Admins can view all merchants"
  ON merchants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Merchants can view their own merchant record"
  ON merchants FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert merchants"
  ON merchants FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can update merchants"
  ON merchants FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Product Inventory: Merchants can only see their own
CREATE POLICY "Merchants can view their own inventory"
  ON product_inventory FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can manage their own inventory"
  ON product_inventory FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- Merchant Settings: Merchants can only see their own
CREATE POLICY "Merchants can view their own settings"
  ON merchant_settings FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can update their own settings"
  ON merchant_settings FOR UPDATE
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- Update Tours RLS to support merchant isolation
DROP POLICY IF EXISTS "Tours are viewable by everyone" ON tours;
CREATE POLICY "Tours are viewable by everyone"
  ON tours FOR SELECT
  USING (is_active = true);

-- Merchants can view their own tours (even if inactive)
CREATE POLICY "Merchants can view their own tours"
  ON tours FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- Merchants can insert their own tours
CREATE POLICY "Merchants can insert their own tours"
  ON tours FOR INSERT
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- Merchants can update their own tours
CREATE POLICY "Merchants can update their own tours"
  ON tours FOR UPDATE
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- Admins can do everything
CREATE POLICY "Admins can manage all tours"
  ON tours FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Update Bookings RLS to support merchant access
-- Merchants can view bookings for their products
CREATE POLICY "Merchants can view bookings for their products"
  ON bookings FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- Merchants can update bookings for their products
CREATE POLICY "Merchants can update bookings for their products"
  ON bookings FOR UPDATE
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

