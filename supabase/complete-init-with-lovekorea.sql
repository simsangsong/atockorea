-- ============================================
-- AtoCKorea 完整数据库初始化脚本（包含LoveKorea商家账户）
-- Complete Database Initialization Script with LoveKorea Merchant Account
-- ============================================
-- 
-- 使用方法：
-- 1. 在 Supabase Dashboard 中打开 SQL Editor
-- 2. 复制并执行此脚本
-- 3. 这将创建所有必要的表，并自动创建LoveKorea商家账户
-- 4. 账户信息：
--    Email: lovekorea@gmail.com
--    Password: lovekorea
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
  tour_date DATE,
  number_of_guests INTEGER NOT NULL DEFAULT 1,
  number_of_people INTEGER DEFAULT 1,
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
-- 6. 结算相关表（从settlement-schema.sql）
-- ============================================
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  settlement_period_start DATE NOT NULL,
  settlement_period_end DATE NOT NULL,
  total_revenue DECIMAL(10, 2) NOT NULL DEFAULT 0,
  platform_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  merchant_payout DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_bookings INTEGER NOT NULL DEFAULT 0,
  settled_bookings INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  payout_method TEXT,
  payout_reference TEXT,
  payout_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_merchant_settlement_period 
    UNIQUE(merchant_id, settlement_period_start, settlement_period_end)
);

CREATE INDEX IF NOT EXISTS idx_settlements_merchant_id ON settlements(merchant_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);

CREATE TABLE IF NOT EXISTS settlement_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  booking_revenue DECIMAL(10, 2) NOT NULL,
  platform_fee_amount DECIMAL(10, 2) NOT NULL,
  merchant_payout_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_booking_settlement UNIQUE(booking_id)
);

CREATE INDEX IF NOT EXISTS idx_settlement_bookings_settlement_id ON settlement_bookings(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_bookings_booking_id ON settlement_bookings(booking_id);

-- ============================================
-- 7. 自动更新 updated_at 的函数
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. 触发器：自动更新 merchant_id
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
-- 9. 触发器：自动更新 updated_at
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

CREATE TRIGGER update_settlement_updated_at_trigger
  BEFORE UPDATE ON settlements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_bookings ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Merchants Policies
DROP POLICY IF EXISTS "Merchants can view own merchant record" ON merchants;
CREATE POLICY "Merchants can view own merchant record"
  ON merchants FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Merchants can update own merchant record" ON merchants;
CREATE POLICY "Merchants can update own merchant record"
  ON merchants FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage merchants" ON merchants;
CREATE POLICY "Admins can manage merchants"
  ON merchants FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Tours Policies
DROP POLICY IF EXISTS "Anyone can view active tours" ON tours;
CREATE POLICY "Anyone can view active tours"
  ON tours FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Merchants can view own tours" ON tours;
CREATE POLICY "Merchants can view own tours"
  ON tours FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Merchants can manage own tours" ON tours;
CREATE POLICY "Merchants can manage own tours"
  ON tours FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Bookings Policies
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  USING (
    auth.uid() = user_id OR
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users can create own bookings" ON bookings;
CREATE POLICY "Users can create own bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Merchants can update own product bookings" ON bookings;
CREATE POLICY "Merchants can update own product bookings"
  ON bookings FOR UPDATE
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Settlements Policies
DROP POLICY IF EXISTS "Merchants can view their own settlements" ON settlements;
CREATE POLICY "Merchants can view their own settlements"
  ON settlements FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all settlements" ON settlements;
CREATE POLICY "Admins can view all settlements"
  ON settlements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Settlement Bookings Policies
DROP POLICY IF EXISTS "Merchants can view their own settlement bookings" ON settlement_bookings;
CREATE POLICY "Merchants can view their own settlement bookings"
  ON settlement_bookings FOR SELECT
  USING (
    settlement_id IN (
      SELECT id FROM settlements 
      WHERE merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================
-- 11. 创建LoveKorea商家账户
-- ============================================
DO $$
DECLARE
  v_user_id UUID;
  v_merchant_id UUID;
  v_email TEXT := 'lovekorea@gmail.com';
  v_password TEXT := 'lovekorea';
BEGIN
  -- 检查用户是否已存在
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    -- 注意：在Supabase中，需要通过Auth API创建用户
    -- 这里我们假设用户已经通过Supabase Dashboard创建
    -- 或者使用Supabase Management API
    RAISE NOTICE '========================================';
    RAISE NOTICE '⚠️  重要提示：需要先在Supabase Dashboard中创建用户';
    RAISE NOTICE '========================================';
    RAISE NOTICE '1. 打开 Supabase Dashboard → Authentication → Users';
    RAISE NOTICE '2. 点击 "Add user" → "Create new user"';
    RAISE NOTICE '3. Email: lovekorea@gmail.com';
    RAISE NOTICE '4. Password: lovekorea';
    RAISE NOTICE '5. Auto Confirm User: ✅';
    RAISE NOTICE '6. 创建后，再次执行此脚本的剩余部分';
    RAISE NOTICE '========================================';
    RAISE EXCEPTION 'User not found. Please create user first in Authentication → Users';
  END IF;
  
  RAISE NOTICE 'Found user ID: %', v_user_id;
  
  -- 检查是否已存在商家记录
  SELECT id INTO v_merchant_id
  FROM merchants
  WHERE user_id = v_user_id;
  
  IF v_merchant_id IS NOT NULL THEN
    RAISE NOTICE 'Merchant already exists. Updating...';
    -- 更新现有记录
    UPDATE merchants SET
      company_name = 'LoveKorea Travel',
      business_registration_number = 'LOVE-KOREA-2024',
      contact_person = 'LoveKorea Admin',
      contact_email = v_email,
      contact_phone = '010-0000-0000',
      address_line1 = '123 Travel Street',
      city = 'Seoul',
      province = 'Seoul',
      postal_code = '00000',
      country = 'South Korea',
      status = 'active',
      is_verified = true
    WHERE id = v_merchant_id;
  ELSE
    -- 创建新的商家记录
    INSERT INTO merchants (
      user_id,
      company_name,
      business_registration_number,
      contact_person,
      contact_email,
      contact_phone,
      address_line1,
      city,
      province,
      postal_code,
      country,
      status,
      is_verified
    ) VALUES (
      v_user_id,
      'LoveKorea Travel',
      'LOVE-KOREA-2024',
      'LoveKorea Admin',
      v_email,
      '010-0000-0000',
      '123 Travel Street',
      'Seoul',
      'Seoul',
      '00000',
      'South Korea',
      'active',
      true
    )
    RETURNING id INTO v_merchant_id;
  END IF;
  
  RAISE NOTICE 'Merchant ID: %', v_merchant_id;
  
  -- 创建或更新用户profile
  INSERT INTO user_profiles (id, full_name, role)
  VALUES (v_user_id, 'LoveKorea Admin', 'merchant')
  ON CONFLICT (id) DO UPDATE SET
    full_name = 'LoveKorea Admin',
    role = 'merchant';
  
  RAISE NOTICE 'User profile created/updated';
  
  -- 创建默认设置
  INSERT INTO merchant_settings (merchant_id)
  VALUES (v_merchant_id)
  ON CONFLICT (merchant_id) DO NOTHING;
  
  RAISE NOTICE 'Default settings created';
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ LoveKorea merchant account created!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Login Credentials:';
  RAISE NOTICE '  Email: %', v_email;
  RAISE NOTICE '  Password: %', v_password;
  RAISE NOTICE '  Login URL: http://localhost:3000/merchant/login';
  RAISE NOTICE '  Merchant ID: %', v_merchant_id;
  RAISE NOTICE '========================================';
  
END $$;

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Database initialization completed!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  ✓ user_profiles';
  RAISE NOTICE '  ✓ merchants (商家表)';
  RAISE NOTICE '  ✓ merchant_settings';
  RAISE NOTICE '  ✓ tours';
  RAISE NOTICE '  ✓ bookings';
  RAISE NOTICE '  ✓ settlements';
  RAISE NOTICE '  ✓ settlement_bookings';
  RAISE NOTICE '';
  RAISE NOTICE 'If LoveKorea account was not created,';
  RAISE NOTICE 'please create the user in Authentication → Users first,';
  RAISE NOTICE 'then re-run the merchant creation section.';
  RAISE NOTICE '========================================';
END $$;


