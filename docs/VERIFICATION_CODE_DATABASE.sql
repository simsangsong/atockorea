-- 验证码系统数据库表
-- 在 Supabase SQL Editor 中执行此脚本

-- 创建验证码表
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_email_code ON verification_codes(email, code);

-- 创建清理过期验证码的函数
CREATE OR REPLACE FUNCTION cleanup_expired_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM verification_codes
  WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;

-- 可选：设置自动清理（需要在 Supabase Dashboard 中配置 Cron Job）
-- 或者定期手动执行：SELECT cleanup_expired_codes();

-- 添加注释
COMMENT ON TABLE verification_codes IS '存储邮箱验证码，用于用户注册验证';
COMMENT ON COLUMN verification_codes.email IS '用户邮箱地址';
COMMENT ON COLUMN verification_codes.code IS '6位数字验证码';
COMMENT ON COLUMN verification_codes.used IS '是否已使用';
COMMENT ON COLUMN verification_codes.expires_at IS '过期时间（10分钟后）';

