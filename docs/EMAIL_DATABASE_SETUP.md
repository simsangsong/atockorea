# 邮件数据库表设置指南

## 📋 概述

需要在 Supabase 中创建邮件接收系统的数据库表，用于存储发送到 `support@atockorea.com` 的邮件。

---

## ✅ 步骤 1：打开 Supabase SQL Editor

1. **登录 Supabase Dashboard**
   - 访问 https://supabase.com
   - 登录你的账户
   - 选择你的项目

2. **进入 SQL Editor**
   - 左侧菜单 → **SQL Editor**
   - 或直接访问：`https://supabase.com/dashboard/project/[your-project]/sql`

3. **创建新查询**
   - 点击 **"New query"** 按钮
   - 或点击 **"+"** 图标

---

## ✅ 步骤 2：执行 SQL 脚本

### 方法 A：复制粘贴（推荐）

1. **打开 SQL 文件**
   - 在项目中打开 `supabase/email-schema.sql`
   - 复制全部内容

2. **粘贴到 SQL Editor**
   - 将复制的 SQL 代码粘贴到 Supabase SQL Editor

3. **执行查询**
   - 点击 **"Run"** 按钮（或按 `Ctrl+Enter` / `Cmd+Enter`）
   - 等待执行完成

### 方法 B：直接执行（如果文件内容有问题）

如果复制粘贴有问题，可以直接在 SQL Editor 中执行以下 SQL：

```sql
-- ============================================
-- AtoCKorea 邮件接收系统 Schema
-- ============================================

-- 邮件表
CREATE TABLE IF NOT EXISTS received_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- 邮件基本信息
  message_id TEXT UNIQUE NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  subject TEXT,
  text_content TEXT,
  html_content TEXT,
  
  -- 邮件元数据
  headers JSONB DEFAULT '{}'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  
  -- 状态
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_spam BOOLEAN DEFAULT false,
  
  -- 分类标签
  category TEXT,
  
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

-- 邮件回复表（可选）
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
```

---

## ✅ 步骤 3：验证表已创建

### 方法 1：在 SQL Editor 中查询

执行以下 SQL 查询：

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'received_emails';
```

如果返回结果，说明表已创建成功。

### 方法 2：在 Table Editor 中查看

1. **进入 Table Editor**
   - 左侧菜单 → **Table Editor**

2. **查找表**
   - 在表列表中查找 `received_emails`
   - 如果看到这个表，说明创建成功

3. **查看表结构**
   - 点击 `received_emails` 表
   - 查看所有列和数据类型

---

## ⚠️ 常见问题

### Q: 执行 SQL 时出现错误？

**A: 常见错误和解决方案：**

1. **错误：`relation "bookings" does not exist`**
   - **原因：** `bookings` 表不存在
   - **解决：** 先创建 `bookings` 表，或删除 `related_booking_id` 的外键约束
   - **临时方案：** 将 `REFERENCES bookings(id)` 改为 `REFERENCES bookings(id) ON DELETE SET NULL` 或直接删除这行

2. **错误：`relation "user_profiles" does not exist`**
   - **原因：** `user_profiles` 表不存在
   - **解决：** 先创建 `user_profiles` 表，或修改 RLS 策略

3. **错误：`function "uuid_generate_v4" does not exist`**
   - **原因：** UUID 扩展未启用
   - **解决：** 在 SQL 开头添加：`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`

### Q: 如何修改 SQL 以适应现有数据库？

**A: 如果某些表不存在，可以修改 SQL：**

```sql
-- 如果 bookings 表不存在，删除这行：
-- related_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,

-- 改为：
related_booking_id UUID,
```

---

## ✅ 完成检查清单

执行 SQL 后，确认：

- [ ] SQL 执行成功（没有错误）
- [ ] `received_emails` 表已创建
- [ ] `email_replies` 表已创建（可选）
- [ ] 所有索引已创建
- [ ] RLS 策略已启用
- [ ] 在 Table Editor 中可以看见表

---

## 🎯 下一步

表创建完成后：

1. ✅ 配置 Resend Webhook（见 `docs/RESEND_EMAIL_RECEIVING_SETUP.md`）
2. ✅ 测试邮件接收
3. ✅ 访问 `/admin/emails` 查看邮件

---

祝你设置顺利！🎉

