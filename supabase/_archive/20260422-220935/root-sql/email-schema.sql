-- ============================================
-- AtoCKorea 邮件接收系统 Schema
-- ============================================

-- 邮件表
CREATE TABLE IF NOT EXISTS received_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- 邮件基本信息
  message_id TEXT UNIQUE NOT NULL, -- Resend 消息 ID
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL, -- support@atockorea.com
  subject TEXT,
  text_content TEXT,
  html_content TEXT,
  
  -- 邮件元数据
  headers JSONB DEFAULT '{}'::jsonb, -- 邮件头信息
  attachments JSONB DEFAULT '[]'::jsonb, -- 附件信息 [{filename, content_type, size}]
  
  -- 状态
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_spam BOOLEAN DEFAULT false,
  
  -- 分类标签
  category TEXT, -- 'support', 'inquiry', 'complaint', 'other'
  
  -- 关联信息
  related_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- 时间戳
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_received_emails_to_email ON received_emails(to_email);
CREATE INDEX IF NOT EXISTS idx_received_emails_from_email ON received_emails(from_email);
CREATE INDEX IF NOT EXISTS idx_received_emails_received_at ON received_emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_received_emails_is_read ON received_emails(is_read);
CREATE INDEX IF NOT EXISTS idx_received_emails_category ON received_emails(category);
CREATE INDEX IF NOT EXISTS idx_received_emails_message_id ON received_emails(message_id);

-- 邮件回复表（可选，用于跟踪回复）
CREATE TABLE IF NOT EXISTS email_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_email_id UUID REFERENCES received_emails(id) ON DELETE CASCADE,
  reply_message_id TEXT UNIQUE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_replies_original_email_id ON email_replies(original_email_id);

-- 更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_received_emails_updated_at 
  BEFORE UPDATE ON received_emails 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 策略（仅管理员可以查看）
ALTER TABLE received_emails ENABLE ROW LEVEL SECURITY;

-- 管理员可以查看所有邮件
CREATE POLICY "Admins can view all emails"
  ON received_emails FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- 管理员可以更新邮件状态
CREATE POLICY "Admins can update emails"
  ON received_emails FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- 允许服务角色插入（用于 webhook）
CREATE POLICY "Service role can insert emails"
  ON received_emails FOR INSERT
  WITH CHECK (true);

