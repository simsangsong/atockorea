-- ============================================
-- AtoCKorea 完整数据库初始化脚本
-- Complete Database Initialization Script
-- ============================================
-- 
-- 使用方法：
-- 1. 在 Supabase Dashboard 中打开 SQL Editor
-- 2. 复制并执行此脚本
-- 3. 这将创建所有必要的表，包括商家账户表
--
-- ============================================

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 用户资料表
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'merchant', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- ============================================
-- 2. 商家表 (MERCHANTS TABLE)
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

CREATE INDEX IF NOT EXISTS idx_merchants_user_id ON merchants(user_id);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);
CREATE INDEX IF NOT EXISTS idx_merchants_business_registration ON merchants(business_registration_number);

-- ============================================
-- 3. 商家设置表
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

CREATE INDEX IF NOT EXISTS idx_settings_merchant_id ON merchant_settings(merchant_id);

-- ============================================
-- 4. 旅游产品表
-- ============================================
CREATE TABLE IF NOT EXISTS tours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  city TEXT NOT NULL,
  location TEXT,
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  price_type TEXT DEFAULT 'person' CHECK (price_type IN ('person', 'group')),
  image_url TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  rating DECIMAL(3, 2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  duration TEXT,
  difficulty TEXT,
  group_size TEXT,
  highlight TEXT,
  badges JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tours_merchant_id ON tours(merchant_id);
CREATE INDEX IF NOT EXISTS idx_tours_city ON tours(city);
CREATE INDEX IF NOT EXISTS idx_tours_is_active ON tours(is_active);
CREATE INDEX IF NOT EXISTS idx_tours_slug ON tours(slug);

-- ============================================
-- 5. 订单表
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tour_id UUID REFERENCES tours(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  booking_date DATE NOT NULL,
  number_of_guests INTEGER NOT NULL DEFAULT 1,
  pickup_point_id UUID,
  final_price DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  settlement_status TEXT DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'settled', 'cancelled')),
  payment_method TEXT,
  special_requests TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tour_id ON bookings(tour_id);
CREATE INDEX IF NOT EXISTS idx_bookings_merchant_id ON bookings(merchant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_settlement_status ON bookings(settlement_status);

-- ============================================
-- 6. 自动更新 updated_at 的函数
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. 触发器：自动更新 merchant_id
-- ============================================
CREATE OR REPLACE FUNCTION update_booking_merchant_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT merchant_id INTO NEW.merchant_id
  FROM tours
  WHERE id = NEW.tour_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_booking_merchant_id_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_merchant_id();

-- ============================================
-- 8. 触发器：自动更新 updated_at
-- ============================================
CREATE TRIGGER update_merchants_updated_at 
  BEFORE UPDATE ON merchants
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at 
  BEFORE UPDATE ON merchant_settings
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at 
  BEFORE UPDATE ON bookings
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tours_updated_at 
  BEFORE UPDATE ON tours
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own data
CREATE POLICY "Merchants can view their own data"
  ON merchants FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM auth.users WHERE id = auth.uid()
    )
  );

-- Admins can view all merchants
CREATE POLICY "Admins can view all merchants"
  ON merchants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Merchants can update their own data
CREATE POLICY "Merchants can update their own data"
  ON merchants FOR UPDATE
  USING (
    user_id IN (
      SELECT id FROM auth.users WHERE id = auth.uid()
    )
  );

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Database tables created successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  ✓ user_profiles';
  RAISE NOTICE '  ✓ merchants (商家表)';
  RAISE NOTICE '  ✓ merchant_settings';
  RAISE NOTICE '  ✓ tours';
  RAISE NOTICE '  ✓ bookings';
  RAISE NOTICE '';
  RAISE NOTICE 'You can now create merchant accounts!';
  RAISE NOTICE '========================================';
END $$;


