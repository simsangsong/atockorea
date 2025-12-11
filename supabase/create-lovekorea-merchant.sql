-- ============================================
-- Create LoveKorea Merchant Account
-- 创建 LoveKorea 商家账户
-- ============================================
-- 
-- 使用方法：
-- 1. 在 Supabase Dashboard 中打开 SQL Editor
-- 2. 复制并执行此脚本
-- 3. 账户信息：
--    - Email: lovekorea@lovekorea.com
--    - Password: lovekorea
--    - Login URL: http://localhost:3000/merchant/login
--
-- ============================================

-- 注意：这个脚本需要在 Supabase Dashboard 的 SQL Editor 中执行
-- 因为它需要使用 auth.users 表的直接操作

DO $$
DECLARE
  v_user_id UUID;
  v_merchant_id UUID;
  v_email TEXT := 'lovekorea@lovekorea.com';
  v_password TEXT := 'lovekorea';
BEGIN
  -- 1. 检查用户是否已存在
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;
  
  IF v_user_id IS NOT NULL THEN
    RAISE NOTICE 'User already exists. Deleting old account...';
    -- 删除旧的商家记录
    DELETE FROM merchants WHERE user_id = v_user_id;
    DELETE FROM user_profiles WHERE id = v_user_id;
    DELETE FROM merchant_settings WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = v_user_id);
    DELETE FROM auth.users WHERE id = v_user_id;
    RAISE NOTICE 'Old account deleted';
  END IF;
  
  -- 2. 创建用户账户（使用 Supabase Auth 函数）
  -- 注意：在 Supabase SQL Editor 中，需要使用 auth.users 表的直接插入
  -- 但更安全的方式是使用 Supabase Dashboard 的 Authentication 界面创建用户
  -- 或者使用 Supabase Management API
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'LoveKorea Merchant Account Setup';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '请按照以下步骤操作：';
  RAISE NOTICE '';
  RAISE NOTICE '方法1：使用 Supabase Dashboard';
  RAISE NOTICE '1. 进入 Supabase Dashboard';
  RAISE NOTICE '2. 点击 Authentication → Users';
  RAISE NOTICE '3. 点击 "Add User" 按钮';
  RAISE NOTICE '4. 填写信息：';
  RAISE NOTICE '   - Email: lovekorea@lovekorea.com';
  RAISE NOTICE '   - Password: lovekorea';
  RAISE NOTICE '   - Auto Confirm User: ✅ (勾选)';
  RAISE NOTICE '5. 点击 "Create User"';
  RAISE NOTICE '6. 复制创建的用户 ID (UUID)';
  RAISE NOTICE '7. 在下面的 SQL 中替换 <USER_ID_HERE> 为用户 ID';
  RAISE NOTICE '8. 执行下面的 SQL 代码';
  RAISE NOTICE '';
  RAISE NOTICE '方法2：使用 Supabase CLI';
  RAISE NOTICE '运行: supabase auth users create lovekorea@lovekorea.com --password lovekorea';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  
END $$;

-- ============================================
-- 执行以下 SQL（在创建用户后）
-- 将 <USER_ID_HERE> 替换为实际创建的用户 ID
-- ============================================

/*
-- 替换 <USER_ID_HERE> 为从 Supabase Dashboard 获取的用户 ID
DO $$
DECLARE
  v_user_id UUID := '<USER_ID_HERE>'; -- 替换为实际用户ID
  v_merchant_id UUID;
BEGIN
  -- 1. 创建用户 profile
  INSERT INTO user_profiles (id, full_name, role)
  VALUES (v_user_id, 'LoveKorea Admin', 'merchant')
  ON CONFLICT (id) DO UPDATE SET
    full_name = 'LoveKorea Admin',
    role = 'merchant';
  
  RAISE NOTICE '✓ User profile created';
  
  -- 2. 创建商家记录
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
    'lovekorea@lovekorea.com',
    '010-0000-0000',
    '123 Travel Street',
    'Seoul',
    'Seoul',
    '00000',
    'South Korea',
    'active',
    true
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_merchant_id;
  
  -- 获取 merchant_id（如果已存在）
  IF v_merchant_id IS NULL THEN
    SELECT id INTO v_merchant_id FROM merchants WHERE user_id = v_user_id;
  END IF;
  
  RAISE NOTICE '✓ Merchant record created: %', v_merchant_id;
  
  -- 3. 创建默认设置
  INSERT INTO merchant_settings (merchant_id)
  VALUES (v_merchant_id)
  ON CONFLICT (merchant_id) DO NOTHING;
  
  RAISE NOTICE '✓ Default settings created';
  
  -- 4. 创建审计日志（如果表存在）
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
        'contact_email', 'lovekorea@lovekorea.com',
        'created_by', 'script'
      )
    );
    RAISE NOTICE '✓ Audit log created';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠ Audit log table might not exist, skipping...';
  END;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ LoveKorea merchant account created!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Login Credentials:';
  RAISE NOTICE '  Email: lovekorea@lovekorea.com';
  RAISE NOTICE '  Password: lovekorea';
  RAISE NOTICE '  Login URL: http://localhost:3000/merchant/login';
  RAISE NOTICE '========================================';
  
END $$;
*/


