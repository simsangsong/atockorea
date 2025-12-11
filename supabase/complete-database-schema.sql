-- ============================================
-- AtoCKorea 完整数据库Schema
-- Complete Database Schema for AtoCKorea Platform
-- ============================================
-- 
-- 此脚本包含整个平台所需的所有数据表：
-- - 用户和认证相关表
-- - 商家相关表
-- - 产品/旅游相关表
-- - 订单/预订相关表
-- - 支付相关表
-- - 评价/评论相关表
-- - 收藏/购物车相关表
-- - 结算相关表
-- - 邮件系统表
-- - 系统辅助表
--
-- ⚠️ 重要：执行此脚本前，请先清空现有数据表
-- 
-- 使用方法：
-- 1. 在 Supabase Dashboard 中打开 SQL Editor
-- 2. 复制并执行此脚本
-- 3. 脚本会自动创建所有表和关系
--
-- ============================================

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 第一部分：用户和认证相关表
-- ============================================

-- 1. 用户资料表
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'merchant', 'admin')),
  language_preference TEXT DEFAULT 'ko' CHECK (language_preference IN ('en', 'zh', 'ko')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON user_profiles(phone);

-- ============================================
-- 第二部分：商家相关表
-- ============================================

-- 2. 商家表
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 商家基本信息
  company_name TEXT NOT NULL,
  business_registration_number TEXT UNIQUE,
  contact_person TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  
  -- 地址信息
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'South Korea',
  
  -- 银行账户信息（用于结算）
  bank_name TEXT,
  bank_account_number TEXT,
  account_holder_name TEXT,
  
  -- 状态信息
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'suspended', 'inactive')) DEFAULT 'pending',
  is_verified BOOLEAN DEFAULT false,
  
  -- 通知设置
  notification_email TEXT,
  notification_phone TEXT,
  
  -- 备注
  notes TEXT,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_merchant_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_merchants_user_id ON merchants(user_id);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);
CREATE INDEX IF NOT EXISTS idx_merchants_business_registration ON merchants(business_registration_number);
CREATE INDEX IF NOT EXISTS idx_merchants_contact_email ON merchants(contact_email);

-- 3. 商家设置表
CREATE TABLE IF NOT EXISTS merchant_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL UNIQUE REFERENCES merchants(id) ON DELETE CASCADE,
  
  -- 通知设置
  email_notifications_enabled BOOLEAN DEFAULT true,
  sms_notifications_enabled BOOLEAN DEFAULT false,
  new_order_notification BOOLEAN DEFAULT true,
  cancellation_notification BOOLEAN DEFAULT true,
  review_notification BOOLEAN DEFAULT true,
  
  -- 业务设置
  auto_confirm_orders BOOLEAN DEFAULT false,
  cancellation_policy_hours INTEGER DEFAULT 24,
  refund_policy_percentage DECIMAL(5, 2) DEFAULT 100.00,
  
  -- 显示设置
  currency TEXT DEFAULT 'KRW',
  timezone TEXT DEFAULT 'Asia/Seoul',
  language TEXT DEFAULT 'ko',
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_settings_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_settings_merchant_id ON merchant_settings(merchant_id);

-- ============================================
-- 第三部分：产品/旅游相关表
-- ============================================

-- 4. 旅游产品表
CREATE TABLE IF NOT EXISTS tours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  
  -- 基本信息
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  subtitle TEXT,
  description TEXT,
  city TEXT NOT NULL CHECK (city IN ('Seoul', 'Busan', 'Jeju')),
  location TEXT,
  tag TEXT,
  
  -- 价格信息
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  price_type TEXT DEFAULT 'person' CHECK (price_type IN ('person', 'group')),
  
  -- 图片信息
  image_url TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  gallery_images JSONB DEFAULT '[]'::jsonb,
  
  -- 产品详情
  duration TEXT, -- e.g., "09:00–17:00 · 8 hours"
  difficulty TEXT,
  group_size TEXT,
  highlight TEXT,
  lunch_included BOOLEAN DEFAULT false,
  ticket_included BOOLEAN DEFAULT false,
  pickup_info TEXT,
  notes TEXT,
  
  -- 内容信息
  highlights JSONB DEFAULT '[]'::jsonb, -- Array of strings
  includes JSONB DEFAULT '[]'::jsonb, -- Array of strings
  excludes JSONB DEFAULT '[]'::jsonb, -- Array of strings
  schedule JSONB DEFAULT '[]'::jsonb, -- Array of {time, title, description}
  faqs JSONB DEFAULT '[]'::jsonb, -- Array of {question, answer}
  badges JSONB DEFAULT '[]'::jsonb, -- Array of badge strings
  
  -- 评分和统计
  rating DECIMAL(3, 2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  pickup_points_count INTEGER DEFAULT 0,
  dropoff_points_count INTEGER DEFAULT 0,
  
  -- 状态
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tours_merchant_id ON tours(merchant_id);
CREATE INDEX IF NOT EXISTS idx_tours_city ON tours(city);
CREATE INDEX IF NOT EXISTS idx_tours_slug ON tours(slug);
CREATE INDEX IF NOT EXISTS idx_tours_is_active ON tours(is_active);
CREATE INDEX IF NOT EXISTS idx_tours_is_featured ON tours(is_featured);
CREATE INDEX IF NOT EXISTS idx_tours_price ON tours(price);

-- 5. 接送点表
CREATE TABLE IF NOT EXISTS pickup_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  pickup_time TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickup_points_tour_id ON pickup_points(tour_id);

-- 6. 产品库存表（按日期管理名额）
CREATE TABLE IF NOT EXISTS product_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  
  -- 日期库存
  tour_date DATE NOT NULL,
  available_spots INTEGER NOT NULL DEFAULT 0,
  reserved_spots INTEGER DEFAULT 0,
  max_capacity INTEGER,
  
  -- 价格覆盖（可以覆盖基础价格）
  price_override DECIMAL(10, 2),
  
  -- 状态
  is_available BOOLEAN DEFAULT true,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_tour_date UNIQUE (tour_id, tour_date),
  CONSTRAINT fk_inventory_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inventory_tour_id ON product_inventory(tour_id);
CREATE INDEX IF NOT EXISTS idx_inventory_merchant_id ON product_inventory(merchant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tour_date ON product_inventory(tour_date);
CREATE INDEX IF NOT EXISTS idx_inventory_is_available ON product_inventory(is_available);

-- ============================================
-- 第四部分：订单/预订相关表
-- ============================================

-- 7. 订单表
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tour_id UUID REFERENCES tours(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  
  -- 预订信息
  booking_date DATE NOT NULL,
  tour_date DATE,
  tour_time TIME,
  number_of_guests INTEGER NOT NULL DEFAULT 1,
  number_of_people INTEGER DEFAULT 1,
  pickup_point_id UUID REFERENCES pickup_points(id) ON DELETE SET NULL,
  
  -- 价格信息
  unit_price DECIMAL(10, 2),
  total_price DECIMAL(10, 2),
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  final_price DECIMAL(10, 2) NOT NULL,
  
  -- 状态信息
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'partially_refunded')),
  settlement_status TEXT DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'settled', 'cancelled')),
  
  -- 支付信息
  payment_method TEXT, -- 'stripe', 'paypal', 'bank_transfer', etc.
  payment_reference TEXT, -- Payment gateway transaction ID
  payment_date TIMESTAMP WITH TIME ZONE,
  
  -- 联系信息
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  special_requests TEXT,
  
  -- 取消信息
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  refund_eligible BOOLEAN DEFAULT false,
  refund_processed BOOLEAN DEFAULT false,
  refund_amount DECIMAL(10, 2),
  refund_date TIMESTAMP WITH TIME ZONE,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tour_id ON bookings(tour_id);
CREATE INDEX IF NOT EXISTS idx_bookings_merchant_id ON bookings(merchant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_settlement_status ON bookings(settlement_status);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_tour_date ON bookings(tour_date);

-- ============================================
-- 第五部分：支付相关表
-- ============================================

-- 8. 支付记录表
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- 支付信息
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_method TEXT NOT NULL, -- 'stripe', 'paypal', 'bank_transfer'
  payment_provider TEXT, -- 'stripe', 'paypal'
  
  -- 支付网关信息
  provider_transaction_id TEXT UNIQUE,
  provider_payment_intent_id TEXT,
  provider_order_id TEXT,
  
  -- 状态
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')) DEFAULT 'pending',
  
  -- 退款信息
  refund_amount DECIMAL(10, 2),
  refund_reason TEXT,
  refund_date TIMESTAMP WITH TIME ZONE,
  refund_transaction_id TEXT,
  
  -- 元数据
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_transaction_id ON payments(provider_transaction_id);

-- ============================================
-- 第六部分：评价/评论相关表
-- ============================================

-- 9. 评价表
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  
  -- 评价内容
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  
  -- 状态
  is_verified BOOLEAN DEFAULT false, -- 是否已验证购买
  is_visible BOOLEAN DEFAULT true,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, tour_id, booking_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_tour_id ON reviews(tour_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_is_visible ON reviews(is_visible);

-- ============================================
-- 第七部分：收藏/购物车相关表
-- ============================================

-- 10. 收藏表（愿望清单）
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tour_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_tour_id ON wishlist(tour_id);

-- 11. 购物车表
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  booking_date DATE,
  tour_date DATE,
  tour_time TIME,
  number_of_guests INTEGER DEFAULT 1,
  quantity INTEGER DEFAULT 1,
  pickup_point_id UUID REFERENCES pickup_points(id) ON DELETE SET NULL,
  unit_price DECIMAL(10, 2),
  total_price DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tour_id, booking_date, tour_date)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_tour_id ON cart_items(tour_id);

-- ============================================
-- 第八部分：结算相关表
-- ============================================

-- 12. 结算表
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  
  -- 结算周期
  settlement_period_start DATE NOT NULL,
  settlement_period_end DATE NOT NULL,
  
  -- 结算金额
  total_revenue DECIMAL(10, 2) NOT NULL DEFAULT 0, -- 总收入
  platform_fee DECIMAL(10, 2) NOT NULL DEFAULT 0, -- 平台手续费（10%）
  merchant_payout DECIMAL(10, 2) NOT NULL DEFAULT 0, -- 商家应得金额
  
  -- 订单统计
  total_bookings INTEGER NOT NULL DEFAULT 0,
  settled_bookings INTEGER NOT NULL DEFAULT 0,
  
  -- 结算状态
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  
  -- 支付信息
  payout_method TEXT, -- 'bank_transfer', 'paypal', etc.
  payout_reference TEXT,
  payout_date DATE,
  
  -- 备注
  notes TEXT,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- 确保每个商家在同一结算周期只有一条记录
  CONSTRAINT unique_merchant_settlement_period 
    UNIQUE(merchant_id, settlement_period_start, settlement_period_end)
);

CREATE INDEX IF NOT EXISTS idx_settlements_merchant_id ON settlements(merchant_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_period ON settlements(settlement_period_start, settlement_period_end);

-- 13. 结算订单关联表
CREATE TABLE IF NOT EXISTS settlement_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- 订单金额信息（快照）
  booking_revenue DECIMAL(10, 2) NOT NULL,
  platform_fee_amount DECIMAL(10, 2) NOT NULL,
  merchant_payout_amount DECIMAL(10, 2) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 确保每个订单只能被结算一次
  CONSTRAINT unique_booking_settlement UNIQUE(booking_id)
);

CREATE INDEX IF NOT EXISTS idx_settlement_bookings_settlement_id ON settlement_bookings(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_bookings_booking_id ON settlement_bookings(booking_id);

-- ============================================
-- 第九部分：邮件系统表
-- ============================================

-- 14. 接收邮件表
CREATE TABLE IF NOT EXISTS received_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id TEXT UNIQUE NOT NULL,
  
  -- 邮件基本信息
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  subject TEXT,
  text_content TEXT,
  html_content TEXT,
  
  -- 状态
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  category TEXT, -- 'support', 'inquiry', 'complaint', 'booking', 'other'
  
  -- 附件
  attachments JSONB DEFAULT '[]'::jsonb,
  
  -- 时间戳
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_received_emails_from_email ON received_emails(from_email);
CREATE INDEX IF NOT EXISTS idx_received_emails_to_email ON received_emails(to_email);
CREATE INDEX IF NOT EXISTS idx_received_emails_is_read ON received_emails(is_read);
CREATE INDEX IF NOT EXISTS idx_received_emails_is_archived ON received_emails(is_archived);
CREATE INDEX IF NOT EXISTS idx_received_emails_category ON received_emails(category);
CREATE INDEX IF NOT EXISTS idx_received_emails_received_at ON received_emails(received_at DESC);

-- 15. 邮件回复表
CREATE TABLE IF NOT EXISTS email_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_email_id UUID NOT NULL REFERENCES received_emails(id) ON DELETE CASCADE,
  
  -- 回复信息
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  html_content TEXT,
  
  -- 状态
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_replies_original_email_id ON email_replies(original_email_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_status ON email_replies(status);

-- ============================================
-- 第十部分：系统辅助表
-- ============================================

-- 16. 验证码表
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  phone TEXT,
  code TEXT NOT NULL,
  code_type TEXT NOT NULL CHECK (code_type IN ('email_verification', 'phone_verification', 'password_reset', 'login')),
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone ON verification_codes(phone);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at);

-- 17. 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 18. 优惠码/促销码表
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  
  -- 折扣类型
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value DECIMAL(10, 2) NOT NULL,
  
  -- 使用限制
  max_uses INTEGER, -- NULL = unlimited
  used_count INTEGER DEFAULT 0,
  min_purchase_amount DECIMAL(10, 2),
  max_discount_amount DECIMAL(10, 2),
  
  -- 有效期
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  
  -- 状态
  is_active BOOLEAN DEFAULT true,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_is_active ON promo_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_promo_codes_valid_until ON promo_codes(valid_until);

-- 19. 优惠码使用记录表
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  discount_amount DECIMAL(10, 2) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_code_usage_promo_code_id ON promo_code_usage(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_user_id ON promo_code_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_booking_id ON promo_code_usage(booking_id);

-- ============================================
-- 第十一部分：触发器和函数
-- ============================================

-- 自动更新 updated_at 的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 自动更新订单的 merchant_id（从 tour 获取）
CREATE OR REPLACE FUNCTION update_booking_merchant_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT merchant_id INTO NEW.merchant_id
  FROM tours
  WHERE id = NEW.tour_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 自动更新产品评分（当有新评价时）
CREATE OR REPLACE FUNCTION update_tour_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tours
  SET 
    rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM reviews
      WHERE tour_id = NEW.tour_id AND is_visible = true
    ),
    review_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE tour_id = NEW.tour_id AND is_visible = true
    )
  WHERE id = NEW.tour_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 结算完成时自动更新订单的 settlement_status
CREATE OR REPLACE FUNCTION update_booking_settlement_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE bookings
    SET settlement_status = 'settled'
    WHERE id IN (
      SELECT booking_id 
      FROM settlement_bookings 
      WHERE settlement_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 第十二部分：创建触发器
-- ============================================

-- 更新 updated_at 的触发器
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_merchants_updated_at 
  BEFORE UPDATE ON merchants
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at 
  BEFORE UPDATE ON merchant_settings
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tours_updated_at 
  BEFORE UPDATE ON tours
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at 
  BEFORE UPDATE ON bookings
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at 
  BEFORE UPDATE ON payments
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at 
  BEFORE UPDATE ON reviews
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at 
  BEFORE UPDATE ON cart_items
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlement_updated_at_trigger
  BEFORE UPDATE ON settlements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_received_emails_updated_at
  BEFORE UPDATE ON received_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_replies_updated_at
  BEFORE UPDATE ON email_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promo_codes_updated_at
  BEFORE UPDATE ON promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 自动更新 merchant_id 的触发器
CREATE TRIGGER update_booking_merchant_id_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_merchant_id();

-- 自动更新产品评分的触发器
CREATE TRIGGER update_tour_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_tour_rating();

-- 结算完成时更新订单状态
CREATE TRIGGER update_booking_settlement_status_trigger
  AFTER UPDATE ON settlements
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_settlement_status();

-- ============================================
-- 第十三部分：Row Level Security (RLS) 策略
-- ============================================

-- 启用 RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE received_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 用户资料策略
-- ============================================

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 商家策略
-- ============================================

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

-- ============================================
-- 产品策略
-- ============================================

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

-- ============================================
-- 订单策略
-- ============================================

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

-- ============================================
-- 支付策略
-- ============================================

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users can create own payments" ON payments;
CREATE POLICY "Users can create own payments"
  ON payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 评价策略
-- ============================================

DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  USING (is_visible = true);

DROP POLICY IF EXISTS "Users can create own reviews" ON reviews;
CREATE POLICY "Users can create own reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- 收藏和购物车策略
-- ============================================

DROP POLICY IF EXISTS "Users can manage own wishlist" ON wishlist;
CREATE POLICY "Users can manage own wishlist"
  ON wishlist FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own cart" ON cart_items;
CREATE POLICY "Users can manage own cart"
  ON cart_items FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- 结算策略
-- ============================================

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
-- 邮件策略（仅管理员）
-- ============================================

DROP POLICY IF EXISTS "Admins can manage emails" ON received_emails;
CREATE POLICY "Admins can manage emails"
  ON received_emails FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage email replies" ON email_replies;
CREATE POLICY "Admins can manage email replies"
  ON email_replies FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 审计日志策略（仅管理员）
-- ============================================

DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 优惠码策略
-- ============================================

DROP POLICY IF EXISTS "Anyone can view active promo codes" ON promo_codes;
CREATE POLICY "Anyone can view active promo codes"
  ON promo_codes FOR SELECT
  USING (is_active = true AND (valid_until IS NULL OR valid_until > NOW()));

DROP POLICY IF EXISTS "Admins can manage promo codes" ON promo_codes;
CREATE POLICY "Admins can manage promo codes"
  ON promo_codes FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 完成提示
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 数据库Schema创建完成！';
  RAISE NOTICE '✅ Database Schema Created Successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '已创建的表 (Created Tables):';
  RAISE NOTICE '  1. user_profiles (用户资料表)';
  RAISE NOTICE '  2. merchants (商家表)';
  RAISE NOTICE '  3. merchant_settings (商家设置表)';
  RAISE NOTICE '  4. tours (旅游产品表)';
  RAISE NOTICE '  5. pickup_points (接送点表)';
  RAISE NOTICE '  6. product_inventory (产品库存表)';
  RAISE NOTICE '  7. bookings (订单表)';
  RAISE NOTICE '  8. payments (支付记录表)';
  RAISE NOTICE '  9. reviews (评价表)';
  RAISE NOTICE '  10. wishlist (收藏表)';
  RAISE NOTICE '  11. cart_items (购物车表)';
  RAISE NOTICE '  12. settlements (结算表)';
  RAISE NOTICE '  13. settlement_bookings (结算订单关联表)';
  RAISE NOTICE '  14. received_emails (接收邮件表)';
  RAISE NOTICE '  15. email_replies (邮件回复表)';
  RAISE NOTICE '  16. verification_codes (验证码表)';
  RAISE NOTICE '  17. audit_logs (审计日志表)';
  RAISE NOTICE '  18. promo_codes (优惠码表)';
  RAISE NOTICE '  19. promo_code_usage (优惠码使用记录表)';
  RAISE NOTICE '';
  RAISE NOTICE '已创建的触发器 (Created Triggers):';
  RAISE NOTICE '  ✓ 自动更新 updated_at';
  RAISE NOTICE '  ✓ 自动更新 booking.merchant_id';
  RAISE NOTICE '  ✓ 自动更新 tour.rating';
  RAISE NOTICE '  ✓ 自动更新 booking.settlement_status';
  RAISE NOTICE '';
  RAISE NOTICE '已创建的RLS策略 (Created RLS Policies):';
  RAISE NOTICE '  ✓ 用户数据隔离';
  RAISE NOTICE '  ✓ 商家数据隔离';
  RAISE NOTICE '  ✓ 管理员权限';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

