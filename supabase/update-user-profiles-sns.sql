-- ============================================
-- 更新 user_profiles 表以支持 SNS 登录信息
-- Update user_profiles table to support SNS login information
-- ============================================
-- 
-- 如果已经执行了 complete-database-init.sql，此脚本会添加SNS相关字段
-- 如果还没有执行，可以直接使用 complete-database-init.sql（已包含SNS字段）
--
-- ============================================

-- 检查并添加 auth_provider 字段
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'auth_provider'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN auth_provider TEXT;
    RAISE NOTICE '✓ 已添加 auth_provider 字段';
  ELSE
    RAISE NOTICE '✓ auth_provider 字段已存在';
  END IF;
END $$;

-- 检查并添加 provider_user_id 字段
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'provider_user_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN provider_user_id TEXT;
    RAISE NOTICE '✓ 已添加 provider_user_id 字段';
  ELSE
    RAISE NOTICE '✓ provider_user_id 字段已存在';
  END IF;
END $$;

-- 检查并添加 provider_metadata 字段
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'provider_metadata'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN provider_metadata JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE '✓ 已添加 provider_metadata 字段';
  ELSE
    RAISE NOTICE '✓ provider_metadata 字段已存在';
  END IF;
END $$;

-- 检查并添加 last_login_method 字段
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'last_login_method'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_login_method TEXT;
    RAISE NOTICE '✓ 已添加 last_login_method 字段';
  ELSE
    RAISE NOTICE '✓ last_login_method 字段已存在';
  END IF;
END $$;

-- 检查并添加 last_login_at 字段
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE '✓ 已添加 last_login_at 字段';
  ELSE
    RAISE NOTICE '✓ last_login_at 字段已存在';
  END IF;
END $$;

-- 检查并添加 linked_accounts 字段
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'linked_accounts'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN linked_accounts JSONB DEFAULT '[]'::jsonb;
    RAISE NOTICE '✓ 已添加 linked_accounts 字段';
  ELSE
    RAISE NOTICE '✓ linked_accounts 字段已存在';
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_provider ON user_profiles(auth_provider);
CREATE INDEX IF NOT EXISTS idx_user_profiles_provider_user_id ON user_profiles(provider_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_login_at ON user_profiles(last_login_at DESC);

-- 更新现有用户：从 auth.users 的 user_metadata 中提取 SNS 信息
DO $$
DECLARE
  v_user RECORD;
  v_provider TEXT;
  v_provider_user_id TEXT;
BEGIN
  FOR v_user IN 
    SELECT 
      u.id,
      u.email,
      u.user_metadata,
      u.app_metadata,
      u.created_at
    FROM auth.users u
    LEFT JOIN user_profiles up ON up.id = u.id
    WHERE up.id IS NOT NULL
  LOOP
    -- 从 user_metadata 中提取 provider 信息
    v_provider := NULL;
    v_provider_user_id := NULL;
    
    -- 检查是否有 provider 信息
    IF v_user.user_metadata IS NOT NULL THEN
      -- 检查 provider 字段
      IF v_user.user_metadata ? 'provider' THEN
        v_provider := v_user.user_metadata->>'provider';
      END IF;
      
      -- 检查各种 SNS 的 user_id
      IF v_user.user_metadata ? 'google_user_id' THEN
        v_provider := 'google';
        v_provider_user_id := v_user.user_metadata->>'google_user_id';
      ELSIF v_user.user_metadata ? 'facebook_user_id' THEN
        v_provider := 'facebook';
        v_provider_user_id := v_user.user_metadata->>'facebook_user_id';
      ELSIF v_user.user_metadata ? 'kakao_user_id' THEN
        v_provider := 'kakao';
        v_provider_user_id := v_user.user_metadata->>'kakao_user_id';
      ELSIF v_user.user_metadata ? 'line_user_id' THEN
        v_provider := 'line';
        v_provider_user_id := v_user.user_metadata->>'line_user_id';
      END IF;
      
      -- 如果没有找到 provider，默认为 email
      IF v_provider IS NULL THEN
        v_provider := 'email';
      END IF;
    ELSE
      v_provider := 'email';
    END IF;
    
    -- 更新 user_profiles
    UPDATE user_profiles
    SET 
      auth_provider = COALESCE(auth_provider, v_provider),
      provider_user_id = COALESCE(provider_user_id, v_provider_user_id),
      provider_metadata = COALESCE(provider_metadata, '{}'::jsonb) || COALESCE(v_user.user_metadata, '{}'::jsonb)
    WHERE id = v_user.id;
  END LOOP;
  
  RAISE NOTICE '✓ 已更新现有用户的 SNS 信息';
END $$;

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ user_profiles 表已更新支持 SNS 登录';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '新增字段：';
  RAISE NOTICE '  ✓ auth_provider - 登录提供商';
  RAISE NOTICE '  ✓ provider_user_id - 提供商用户ID';
  RAISE NOTICE '  ✓ provider_metadata - 提供商元数据';
  RAISE NOTICE '  ✓ last_login_method - 最后登录方式';
  RAISE NOTICE '  ✓ last_login_at - 最后登录时间';
  RAISE NOTICE '  ✓ linked_accounts - 关联账户列表';
  RAISE NOTICE '';
  RAISE NOTICE '支持的登录提供商：';
  RAISE NOTICE '  - email (邮箱登录)';
  RAISE NOTICE '  - google (Google登录)';
  RAISE NOTICE '  - facebook (Facebook登录)';
  RAISE NOTICE '  - kakao (Kakao登录)';
  RAISE NOTICE '  - line (LINE登录)';
  RAISE NOTICE '';
  RAISE NOTICE '已创建索引：';
  RAISE NOTICE '  ✓ idx_user_profiles_auth_provider';
  RAISE NOTICE '  ✓ idx_user_profiles_provider_user_id';
  RAISE NOTICE '  ✓ idx_user_profiles_last_login_at';
  RAISE NOTICE '========================================';
END $$;

