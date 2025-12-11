-- ============================================
-- AtoCKorea 完整数据库初始化脚本
-- Complete Database Initialization Script
-- ============================================
-- 
-- 此脚本会创建整个网站所需的所有数据表
-- 包括：用户端、商家端、管理员端的所有功能
--
-- ⚠️ 重要提示：
-- 1. 此脚本会清空所有现有数据表（使用 CASCADE DROP）
-- 2. 请在执行前备份重要数据
-- 3. 用户账户需要在 Supabase Dashboard 中手动创建
--
-- ============================================

-- 删除所有现有表（CASCADE会删除依赖对象）
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 禁用触发器以避免级联问题
    SET session_replication_role = 'replica';
    
    -- 删除所有表
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- 恢复触发器
    SET session_replication_role = 'origin';
    
    RAISE NOTICE '所有现有表已删除';
END $$;

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 用户资料表 (USER PROFILES)
-- ============================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT, -- 用户头像照片URL
  phone TEXT,
  role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'merchant', 'admin')),
  language_preference TEXT DEFAULT 'ko' CHECK (language_preference IN ('ko', 'en', 'zh')),
  
  -- 个人信息扩展
  date_of_birth DATE, -- 出生日期
  address TEXT, -- 地址
  city TEXT, -- 城市
  province TEXT, -- 省份
  postal_code TEXT, -- 邮编
  country TEXT DEFAULT 'South Korea', -- 国家
  timezone TEXT DEFAULT 'Asia/Seoul', -- 时区
  
  -- SNS登录信息
  auth_provider TEXT, -- 登录提供商：email/google/facebook/kakao/line
  provider_user_id TEXT, -- 提供商用户ID（如Google的sub、LINE的userId等）
  provider_metadata JSONB DEFAULT '{}'::jsonb, -- 提供商元数据（存储额外的SNS信息）
  last_login_method TEXT, -- 最后登录方式
  last_login_at TIMESTAMP WITH TIME ZONE, -- 最后登录时间
  
  -- 账户关联（用于关联多个登录方式到同一账户）
  linked_accounts JSONB DEFAULT '[]'::jsonb, -- 关联的账户列表 [{provider, provider_user_id, linked_at}]
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_language ON user_profiles(language_preference);
CREATE INDEX idx_user_profiles_auth_provider ON user_profiles(auth_provider);
CREATE INDEX idx_user_profiles_provider_user_id ON user_profiles(provider_user_id);
CREATE INDEX idx_user_profiles_last_login_at ON user_profiles(last_login_at DESC);

-- ============================================
-- 2. 商家表 (MERCHANTS)
-- ============================================
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 商家信息
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
  
  -- 银行账户（用于结算）
  bank_name TEXT,
  bank_account_number TEXT,
  account_holder_name TEXT,
  
  -- 状态
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'suspended', 'inactive')) DEFAULT 'pending',
  is_verified BOOLEAN DEFAULT false,
  
  -- 通知设置
  notification_email TEXT,
  notification_phone TEXT,
  
  -- 备注
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_merchant_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_merchants_user_id ON merchants(user_id);
CREATE INDEX idx_merchants_status ON merchants(status);
CREATE INDEX idx_merchants_email ON merchants(contact_email);
CREATE INDEX idx_merchants_business_registration ON merchants(business_registration_number);

-- ============================================
-- 3. 商家设置表 (MERCHANT SETTINGS)
-- ============================================
CREATE TABLE merchant_settings (
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
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_settings_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE INDEX idx_settings_merchant_id ON merchant_settings(merchant_id);

-- ============================================
-- 4. 旅游产品表 (TOURS)
-- ============================================
CREATE TABLE tours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  
  -- 基本信息
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  city TEXT NOT NULL CHECK (city IN ('Seoul', 'Busan', 'Jeju')),
  tag TEXT, -- 如 "Jeju · Day tour"
  subtitle TEXT,
  description TEXT,
  location TEXT,
  
  -- 价格信息
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  price_type TEXT DEFAULT 'person' CHECK (price_type IN ('person', 'group')),
  currency TEXT DEFAULT 'USD',
  
  -- 图片
  image_url TEXT, -- 主图片/封面图
  banner_image TEXT, -- 横幅图片（详细页顶部大图，可选，如果为空则使用image_url）
  images JSONB DEFAULT '[]'::jsonb, -- 图片数组（简单URL数组）
  gallery_images JSONB DEFAULT '[]'::jsonb, -- 画廊图片数组（带标题和描述的完整对象数组）
  -- gallery_images 格式: [{"url": "...", "title": "...", "description": "..."}, ...]
  
  -- 评分和评价
  rating DECIMAL(3, 2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  review_count INTEGER DEFAULT 0,
  
  -- 产品详情
  duration TEXT, -- 如 "10 hours", "Full day" 或 "09:00–17:00 · 8 hours"
  difficulty TEXT, -- 难度：Easy/Medium/Hard
  group_size TEXT, -- 团队规模：如 "Max 12", "Small group"
  highlight TEXT, -- 主要亮点（单行文本）
  highlights JSONB DEFAULT '[]'::jsonb, -- 亮点数组（多行）
  badges JSONB DEFAULT '[]'::jsonb, -- 徽章数组：如 ["Top rated", "Best seller"]
  includes JSONB DEFAULT '[]'::jsonb, -- 包含内容数组
  excludes JSONB DEFAULT '[]'::jsonb, -- 不包含内容数组
  
  -- 行程安排
  schedule JSONB DEFAULT '[]'::jsonb, -- 详细行程安排 [{time, title, description, icon?}]
  -- schedule 格式: [{"time": "08:30", "title": "Pickup", "description": "...", "icon": "🚗"}, ...]
  itinerary JSONB DEFAULT '[]'::jsonb, -- 行程地点数组（简化版，仅地点名称）
  -- itinerary 格式: ["Hamdeok Beach", "Haenyeo Museum", ...]
  
  -- 旅游详情（Tour Details）
  tour_details JSONB DEFAULT '{}'::jsonb, -- 完整的旅游详情对象
  -- tour_details 格式: {
  --   "tagline": "...", // 标语/副标题
  --   "quickFacts": ["...", "..."], // 快速事实列表
  --   "meetingPoints": [...], // 集合点信息
  --   "cancellationPolicy": "...", // 取消政策
  --   "importantNotes": "..." // 重要提示
  -- }
  
  -- FAQ（常见问题）
  faqs JSONB DEFAULT '[]'::jsonb, -- [{question, answer}]
  -- faqs 格式: [{"question": "...", "answer": "..."}, ...]
  
  -- 接送点
  pickup_points_count INTEGER DEFAULT 0,
  dropoff_points_count INTEGER DEFAULT 0,
  
  -- 特色标签
  lunch_included BOOLEAN DEFAULT false,
  ticket_included BOOLEAN DEFAULT false,
  pickup_info TEXT,
  notes TEXT,
  
  -- 状态
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tours_merchant_id ON tours(merchant_id);
CREATE INDEX idx_tours_city ON tours(city);
CREATE INDEX idx_tours_slug ON tours(slug);
CREATE INDEX idx_tours_is_active ON tours(is_active);
CREATE INDEX idx_tours_is_featured ON tours(is_featured);
CREATE INDEX idx_tours_rating ON tours(rating DESC);
CREATE INDEX idx_tours_price ON tours(price);

-- ============================================
-- 5. 接送点表 (PICKUP POINTS)
-- ============================================
CREATE TABLE pickup_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  pickup_time TIME,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pickup_points_tour_id ON pickup_points(tour_id);
CREATE INDEX idx_pickup_points_display_order ON pickup_points(tour_id, display_order);

-- ============================================
-- 6. 产品库存表 (PRODUCT INVENTORY)
-- ============================================
CREATE TABLE product_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  
  -- 日期库存
  tour_date DATE NOT NULL,
  available_spots INTEGER NOT NULL DEFAULT 0,
  reserved_spots INTEGER DEFAULT 0,
  total_spots INTEGER NOT NULL DEFAULT 0,
  max_capacity INTEGER,
  
  -- 价格覆盖（可覆盖基础价格）
  price_override DECIMAL(10, 2),
  
  -- 状态
  is_available BOOLEAN DEFAULT true,
  
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
-- 7. 订单表 (BOOKINGS)
-- ============================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tour_id UUID REFERENCES tours(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  
  -- 预订日期和旅游日期
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tour_date DATE NOT NULL,
  tour_time TIME,
  
  -- 人数
  number_of_guests INTEGER NOT NULL DEFAULT 1,
  number_of_people INTEGER DEFAULT 1,
  
  -- 接送点
  pickup_point_id UUID REFERENCES pickup_points(id) ON DELETE SET NULL,
  
  -- 价格信息
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  final_price DECIMAL(10, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  
  -- 优惠券
  promo_code TEXT,
  promo_discount DECIMAL(10, 2) DEFAULT 0,
  
  -- 状态
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'partially_refunded')),
  settlement_status TEXT DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'settled', 'cancelled')),
  
  -- 支付信息
  payment_method TEXT, -- 'stripe', 'paypal', 'card', etc.
  payment_reference TEXT, -- 支付参考号
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- 联系人信息
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  special_requests TEXT,
  
  -- 取消信息
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  refund_eligible BOOLEAN DEFAULT false,
  refund_processed BOOLEAN DEFAULT false,
  refund_amount DECIMAL(10, 2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_tour_id ON bookings(tour_id);
CREATE INDEX idx_bookings_merchant_id ON bookings(merchant_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_settlement_status ON bookings(settlement_status);
CREATE INDEX idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX idx_bookings_tour_date ON bookings(tour_date);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);

-- ============================================
-- 8. 购物车表 (CART ITEMS)
-- ============================================
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  tour_date DATE,
  tour_time TIME,
  quantity INTEGER DEFAULT 1,
  pickup_point_id UUID REFERENCES pickup_points(id) ON DELETE SET NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_user_tour_date UNIQUE (user_id, tour_id, tour_date)
);

CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX idx_cart_items_tour_id ON cart_items(tour_id);
CREATE INDEX idx_cart_items_created_at ON cart_items(created_at DESC);

-- ============================================
-- 9. 收藏表 (WISHLIST)
-- ============================================
CREATE TABLE wishlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_user_tour_wishlist UNIQUE (user_id, tour_id)
);

CREATE INDEX idx_wishlist_user_id ON wishlist(user_id);
CREATE INDEX idx_wishlist_tour_id ON wishlist(tour_id);
CREATE INDEX idx_wishlist_created_at ON wishlist(created_at DESC);

-- ============================================
-- 10. 评价表 (REVIEWS)
-- ============================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  
  -- 评价内容
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  photos JSONB DEFAULT '[]'::jsonb, -- 图片URL数组
  
  -- 状态
  is_verified BOOLEAN DEFAULT false, -- 是否已验证购买
  is_visible BOOLEAN DEFAULT true, -- 是否可见
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_user_tour_booking_review UNIQUE (user_id, tour_id, booking_id)
);

CREATE INDEX idx_reviews_tour_id ON reviews(tour_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_is_visible ON reviews(is_visible);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);

-- ============================================
-- 11. 结算表 (SETTLEMENTS)
-- ============================================
CREATE TABLE settlements (
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
  payout_reference TEXT, -- 转账参考号
  payout_date DATE, -- 实际支付日期
  
  -- 备注
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT unique_merchant_settlement_period 
    UNIQUE(merchant_id, settlement_period_start, settlement_period_end)
);

CREATE INDEX idx_settlements_merchant_id ON settlements(merchant_id);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_period ON settlements(settlement_period_start, settlement_period_end);

-- ============================================
-- 12. 结算订单关联表 (SETTLEMENT BOOKINGS)
-- ============================================
CREATE TABLE settlement_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- 订单金额快照
  booking_revenue DECIMAL(10, 2) NOT NULL,
  platform_fee_amount DECIMAL(10, 2) NOT NULL,
  merchant_payout_amount DECIMAL(10, 2) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_booking_settlement UNIQUE(booking_id)
);

CREATE INDEX idx_settlement_bookings_settlement_id ON settlement_bookings(settlement_id);
CREATE INDEX idx_settlement_bookings_booking_id ON settlement_bookings(booking_id);

-- ============================================
-- 13. 优惠券表 (PROMO CODES)
-- ============================================
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  
  -- 折扣类型
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value DECIMAL(10, 2) NOT NULL,
  
  -- 使用限制
  min_purchase_amount DECIMAL(10, 2),
  max_discount_amount DECIMAL(10, 2),
  max_uses INTEGER, -- 最大使用次数
  used_count INTEGER DEFAULT 0,
  
  -- 有效期
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  
  -- 适用产品
  applicable_tours JSONB DEFAULT '[]'::jsonb, -- tour_id数组，空数组表示所有产品
  applicable_merchants JSONB DEFAULT '[]'::jsonb, -- merchant_id数组
  
  -- 状态
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_is_active ON promo_codes(is_active);
CREATE INDEX idx_promo_codes_valid_dates ON promo_codes(valid_from, valid_until);

-- ============================================
-- 14. 邮件/消息表 (EMAILS/MESSAGES)
-- ============================================
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- 发件人和收件人
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  to_name TEXT,
  
  -- 邮件内容
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  
  -- 关联信息
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  tour_id UUID REFERENCES tours(id) ON DELETE SET NULL,
  
  -- 状态
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- 回复关联
  parent_email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  is_reply BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_emails_to_email ON emails(to_email);
CREATE INDEX idx_emails_user_id ON emails(user_id);
CREATE INDEX idx_emails_booking_id ON emails(booking_id);
CREATE INDEX idx_emails_status ON emails(status);
CREATE INDEX idx_emails_parent_email_id ON emails(parent_email_id);
CREATE INDEX idx_emails_created_at ON emails(created_at DESC);

-- ============================================
-- 15. 用户设置表 (USER SETTINGS)
-- ============================================
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 通知偏好
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  push_notifications BOOLEAN DEFAULT true,
  marketing_emails BOOLEAN DEFAULT false,
  booking_reminders BOOLEAN DEFAULT true,
  promotional_offers BOOLEAN DEFAULT false,
  
  -- 隐私设置
  profile_visibility TEXT DEFAULT 'public' CHECK (profile_visibility IN ('public', 'friends', 'private')),
  show_email BOOLEAN DEFAULT false,
  show_phone BOOLEAN DEFAULT false,
  allow_messages BOOLEAN DEFAULT true,
  
  -- 偏好设置
  currency TEXT DEFAULT 'USD',
  date_format TEXT DEFAULT 'YYYY-MM-DD',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- ============================================
-- 16. 用户活动日志表 (USER ACTIVITY LOGS)
-- ============================================
CREATE TABLE user_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 活动信息
  action_type TEXT NOT NULL, -- 'booked', 'reviewed', 'cancelled', 'wishlist_added', etc.
  resource_type TEXT NOT NULL, -- 'tour', 'booking', 'review', etc.
  resource_id UUID, -- 关联的资源ID
  
  -- 活动详情
  description TEXT, -- 活动描述
  metadata JSONB DEFAULT '{}'::jsonb, -- 额外的元数据
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_action_type ON user_activity_logs(action_type);
CREATE INDEX idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);

-- ============================================
-- 17. 审计日志表 (AUDIT LOGS)
-- ============================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- 操作信息
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL, -- 'tour', 'booking', 'merchant', etc.
  resource_id UUID,
  
  -- 详情
  details JSONB DEFAULT '{}'::jsonb,
  
  -- 请求信息
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================
-- 16. 触发器函数
-- ============================================

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 自动更新订单的 merchant_id（从tour获取）
CREATE OR REPLACE FUNCTION update_booking_merchant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tour_id IS NOT NULL THEN
    SELECT merchant_id INTO NEW.merchant_id
    FROM tours
    WHERE id = NEW.tour_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 更新产品评分（当有新评价时）
CREATE OR REPLACE FUNCTION update_tour_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tours
  SET 
    rating = (
      SELECT COALESCE(AVG(rating)::DECIMAL(3,2), 0)
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

-- 结算完成时自动更新订单的settlement_status
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
-- 17. 触发器
-- ============================================

-- updated_at 触发器
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_merchants_updated_at 
  BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at 
  BEFORE UPDATE ON merchant_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tours_updated_at 
  BEFORE UPDATE ON tours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at 
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at 
  BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at 
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlement_updated_at 
  BEFORE UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promo_codes_updated_at 
  BEFORE UPDATE ON promo_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emails_updated_at 
  BEFORE UPDATE ON emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at 
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- booking merchant_id 自动更新
CREATE TRIGGER update_booking_merchant_id_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_merchant_id();

-- 评价后更新产品评分
CREATE TRIGGER update_tour_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_tour_rating();

-- 结算完成后更新订单状态
CREATE TRIGGER update_booking_settlement_status_trigger
  AFTER UPDATE ON settlements
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_settlement_status();

-- ============================================
-- 18. Row Level Security (RLS) Policies
-- ============================================

-- 启用RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies: User Profiles
-- ============================================
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- RLS Policies: Merchants
-- ============================================
CREATE POLICY "Merchants can view own merchant record"
  ON merchants FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Merchants can update own merchant record"
  ON merchants FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all merchants"
  ON merchants FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- RLS Policies: Tours
-- ============================================
-- 所有人可以查看激活的产品
CREATE POLICY "Anyone can view active tours"
  ON tours FOR SELECT
  USING (is_active = true);

-- 商家可以查看自己的产品（包括未激活的）
CREATE POLICY "Merchants can view own tours"
  ON tours FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- 商家可以管理自己的产品
CREATE POLICY "Merchants can manage own tours"
  ON tours FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- RLS Policies: Bookings
-- ============================================
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  USING (
    auth.uid() = user_id OR
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can create own bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Merchants can update own product bookings"
  ON bookings FOR UPDATE
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- RLS Policies: Cart Items
-- ============================================
CREATE POLICY "Users can manage own cart"
  ON cart_items FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- RLS Policies: Wishlist
-- ============================================
CREATE POLICY "Users can manage own wishlist"
  ON wishlist FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- RLS Policies: Reviews
-- ============================================
CREATE POLICY "Anyone can view visible reviews"
  ON reviews FOR SELECT
  USING (is_visible = true OR auth.uid() = user_id);

CREATE POLICY "Users can create own reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- RLS Policies: Settlements
-- ============================================
CREATE POLICY "Merchants can view own settlements"
  ON settlements FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all settlements"
  ON settlements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- RLS Policies: Emails
-- ============================================
CREATE POLICY "Users can view own emails"
  ON emails FOR SELECT
  USING (
    auth.uid() = user_id OR
    to_email IN (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can view all emails"
  ON emails FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- RLS Policies: User Settings
-- ============================================
CREATE POLICY "Users can manage own settings"
  ON user_settings FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- RLS Policies: User Activity Logs
-- ============================================
CREATE POLICY "Users can view own activity logs"
  ON user_activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own activity logs"
  ON user_activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RLS Policies: Audit Logs
-- ============================================
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 19. 创建LoveKorea商家账户
-- ============================================
DO $$
DECLARE
  v_user_id UUID;
  v_merchant_id UUID;
  v_email TEXT := 'lovekorea@gmail.com';
BEGIN
  -- 检查用户是否已存在
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '⚠️  用户账户不存在！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '请先在 Supabase Dashboard 中创建用户：';
    RAISE NOTICE '';
    RAISE NOTICE '1. 打开 Supabase Dashboard';
    RAISE NOTICE '2. 进入 Authentication → Users';
    RAISE NOTICE '3. 点击 "Add user" → "Create new user"';
    RAISE NOTICE '4. 填写信息：';
    RAISE NOTICE '   - Email: lovekorea@gmail.com';
    RAISE NOTICE '   - Password: lovekorea';
    RAISE NOTICE '   - Auto Confirm User: ✅ (重要！)';
    RAISE NOTICE '5. 点击 "Create user"';
    RAISE NOTICE '6. 创建完成后，再次执行此脚本';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RETURN;
  END IF;
  
  RAISE NOTICE '✓ 找到用户 ID: %', v_user_id;
  
  -- 创建或更新用户profile
  INSERT INTO user_profiles (id, full_name, role, auth_provider)
  VALUES (v_user_id, 'LoveKorea Admin', 'merchant', 'email')
  ON CONFLICT (id) DO UPDATE SET
    full_name = 'LoveKorea Admin',
    role = 'merchant',
    auth_provider = COALESCE(user_profiles.auth_provider, 'email');
  
  RAISE NOTICE '✓ 用户资料已创建/更新';
  
  -- 检查是否已存在商家记录
  SELECT id INTO v_merchant_id
  FROM merchants
  WHERE user_id = v_user_id;
  
  IF v_merchant_id IS NOT NULL THEN
    RAISE NOTICE '✓ 商家记录已存在，正在更新...';
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
    RAISE NOTICE '✓ 创建新的商家记录...';
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
  
  RAISE NOTICE '✓ 商家 ID: %', v_merchant_id;
  
  -- 创建默认设置
  INSERT INTO merchant_settings (merchant_id)
  VALUES (v_merchant_id)
  ON CONFLICT (merchant_id) DO NOTHING;
  
  RAISE NOTICE '✓ 默认设置已创建';
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ LoveKorea 商家账户创建成功！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '登录信息：';
  RAISE NOTICE '  📧 Email: %', v_email;
  RAISE NOTICE '  🔑 Password: lovekorea';
  RAISE NOTICE '  🌐 登录地址: http://localhost:3000/merchant/login';
  RAISE NOTICE '  🏢 商家 ID: %', v_merchant_id;
  RAISE NOTICE '  ✅ 状态: active (已激活)';
  RAISE NOTICE '  ✅ 验证: true (已验证)';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ 错误: %', SQLERRM;
END $$;

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 数据库初始化完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '已创建的表（共18个）：';
  RAISE NOTICE '  1. ✓ user_profiles (用户资料表) - 包含头像、个人信息、SNS登录信息';
  RAISE NOTICE '  2. ✓ user_settings (用户设置表) - 通知偏好、隐私设置';
  RAISE NOTICE '  3. ✓ user_activity_logs (用户活动日志表) - 用于Dashboard的Recent Activity';
  RAISE NOTICE '  4. ✓ merchants (商家表)';
  RAISE NOTICE '  5. ✓ merchant_settings (商家设置表)';
  RAISE NOTICE '  6. ✓ tours (旅游产品表)';
  RAISE NOTICE '  7. ✓ pickup_points (接送点表)';
  RAISE NOTICE '  8. ✓ product_inventory (产品库存表)';
  RAISE NOTICE '  9. ✓ bookings (订单表) - 用于Upcoming Tours、My Bookings、History';
  RAISE NOTICE '  10. ✓ cart_items (购物车表)';
  RAISE NOTICE '  11. ✓ wishlist (收藏表) - 用于Wishlist页面';
  RAISE NOTICE '  12. ✓ reviews (评价表) - 用于Reviews页面';
  RAISE NOTICE '  13. ✓ settlements (结算表)';
  RAISE NOTICE '  14. ✓ settlement_bookings (结算订单关联表)';
  RAISE NOTICE '  15. ✓ promo_codes (优惠券表)';
  RAISE NOTICE '  16. ✓ emails (邮件/消息表)';
  RAISE NOTICE '  17. ✓ audit_logs (审计日志表)';
  RAISE NOTICE '';
  RAISE NOTICE '已创建：';
  RAISE NOTICE '  ✓ 所有索引';
  RAISE NOTICE '  ✓ 所有触发器';
  RAISE NOTICE '  ✓ Row Level Security (RLS) 策略';
  RAISE NOTICE '';
  RAISE NOTICE '如果 LoveKorea 账户未创建，';
  RAISE NOTICE '请先在 Authentication → Users 中创建用户，';
  RAISE NOTICE '然后重新执行此脚本的账户创建部分。';
  RAISE NOTICE '========================================';
END $$;

