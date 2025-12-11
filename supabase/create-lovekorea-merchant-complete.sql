-- ============================================
-- Complete Script to Create LoveKorea Merchant Account
-- 完整的 LoveKorea 商家账户创建脚本
-- ============================================
-- 
-- 使用方法：
-- 1. 在 Supabase Dashboard 中打开 SQL Editor
-- 2. 复制并执行此脚本
-- 3. 注意：需要先在 Authentication → Users 中手动创建用户
--    或者使用 Supabase Management API
--
-- ============================================

-- 步骤1: 在 Supabase Dashboard 的 Authentication → Users 中创建用户
-- Email: lovekorea@lovekorea.com
-- Password: lovekorea
-- Auto Confirm User: ✅
--
-- 步骤2: 获取创建的用户 ID，然后执行下面的 SQL

-- ============================================
-- 方法1: 如果你知道用户ID，直接执行下面的代码
-- ============================================

-- 首先，查找用户ID（如果用户已创建）
DO $$
DECLARE
  v_user_id UUID;
  v_merchant_id UUID;
  v_email TEXT := 'lovekorea@lovekorea.com';
BEGIN
  -- 查找用户ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found. Please create user first in Authentication → Users with email: %', v_email;
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
  
  -- 创建审计日志（如果表存在）
  BEGIN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details
    ) VALUES (
      v_user_id,
      'merchant_created',
      'merchant',
      v_merchant_id,
      jsonb_build_object(
        'company_name', 'LoveKorea Travel',
        'contact_email', v_email,
        'created_by', 'sql_script'
      )
    )
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Audit log created';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Audit log table might not exist, skipping...';
  END;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ LoveKorea merchant account created!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Login Credentials:';
  RAISE NOTICE '  Email: %', v_email;
  RAISE NOTICE '  Password: lovekorea';
  RAISE NOTICE '  Login URL: http://localhost:3000/merchant/login';
  RAISE NOTICE '========================================';
  
END $$;


