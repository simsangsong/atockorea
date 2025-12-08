# Resend 邮件接收系统设置指南

## 📋 概述

本系统允许你接收发送到 `support@atockorea.com` 的邮件，并在后台管理界面中查看和管理这些邮件。

---

## 🔧 设置步骤

### 步骤 1：创建数据库表

在 Supabase SQL Editor 中执行：

```sql
-- 复制 supabase/email-schema.sql 中的内容并执行
```

或直接执行：

```sql
-- 邮件表
CREATE TABLE IF NOT EXISTS received_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id TEXT UNIQUE NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  subject TEXT,
  text_content TEXT,
  html_content TEXT,
  headers JSONB DEFAULT '{}'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_spam BOOLEAN DEFAULT false,
  category TEXT,
  related_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_received_emails_to_email ON received_emails(to_email);
CREATE INDEX IF NOT EXISTS idx_received_emails_received_at ON received_emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_received_emails_is_read ON received_emails(is_read);
```

---

### 步骤 2：配置 Resend Webhook

**⚠️ 重要：必须使用生产环境 URL，不能使用 localhost！**

**详细说明：** 查看 `docs/RESEND_WEBHOOK_URL_GUIDE.md`

1. **登录 Resend Dashboard**
   - 访问 https://resend.com
   - 登录你的账户

2. **进入 Webhooks 设置**
   - 左侧菜单 → **Webhooks**
   - 或访问：https://resend.com/webhooks

3. **创建新 Webhook**
   - 点击 **"Add Webhook"** 或 **"Create Webhook"**
   - 填写以下信息：
     - **Name:** `AtoCKorea Email Receiver`
     - **URL:** ⚠️ **必须使用生产环境地址**
       - ✅ **生产环境：** `https://atockorea.com/api/webhooks/resend`（**使用这个！**）
       - ❌ **本地开发：** `http://localhost:3000/api/webhooks/resend`（仅用于本地测试，主机关机时无法接收）

   **⚠️ 重要提示：**
   - **必须填写生产环境的 URL**（`https://atockorea.com/api/webhooks/resend`）
   - `localhost` 只能在本机访问，Resend 无法从外部访问
   - 如果主机关机，webhook 无法接收邮件
   - 本地开发地址仅用于本地测试，不能用于生产环境

   - **Events:** 选择 `email.received`（邮件接收事件）

4. **保存 Webhook**
   - 点击 **"Save"** 或 **"Create"**
   - 复制 Webhook Secret（如果提供）

5. **配置环境变量**
   - 在 `.env.local` 中添加（如果 Resend 提供了签名验证）：
     ```env
     RESEND_WEBHOOK_SECRET=your_webhook_secret
     ```
   - **在 Vercel 中也要配置：** Vercel Dashboard → Settings → Environment Variables

**详细环境变量配置指南：** 查看 `docs/RESEND_VERCEL_ENV_SETUP.md`

---

### 步骤 3：启用邮件接收（MX 记录）

确保你已经按照之前的指南添加了 Enable Receiving MX 记录：

- **Type:** MX
- **Host:** `@`
- **Value:** `inbound-smtp.ap-northeast-1.amazonaws.com`（从 Resend Dashboard 复制）
- **Priority:** `9`

---

### 步骤 4：测试邮件接收

1. **发送测试邮件**
   - 从任何邮箱发送邮件到 `support@atockorea.com`
   - 主题：`Test Email`
   - 内容：`This is a test email`

2. **检查 Webhook**
   - 在 Resend Dashboard → Webhooks 中查看日志
   - 确认 webhook 被触发

3. **检查数据库**
   - 在 Supabase Dashboard → Table Editor → `received_emails`
   - 查看是否有新邮件记录

4. **检查管理界面**
   - 访问 `/admin/emails`
   - 查看邮件列表

---

## 📱 使用管理界面

### 访问邮件管理

1. **登录管理员账户**
   - 访问 `/admin` 或 `/admin/emails`
   - 使用管理员账户登录

2. **查看邮件列表**
   - 左侧显示所有收到的邮件
   - 未读邮件有蓝色圆点标记
   - 点击邮件查看详情

3. **过滤和搜索**
   - 按分类过滤（Support, Inquiry, Complaint, Booking, Other）
   - 按已读/未读状态过滤
   - 搜索邮件内容

4. **管理邮件**
   - 点击邮件查看完整内容
   - 标记为已读（自动）
   - 归档邮件

---

## 🔍 API 端点

### 获取邮件列表

**GET** `/api/admin/emails`

**查询参数：**
- `page` - 页码（默认：1）
- `limit` - 每页数量（默认：20）
- `category` - 分类过滤
- `is_read` - 已读状态（true/false）
- `search` - 搜索关键词

**响应：**
```json
{
  "emails": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

### 获取单封邮件

**GET** `/api/admin/emails/[id]`

**响应：**
```json
{
  "email": {
    "id": "...",
    "from_email": "...",
    "subject": "...",
    "text_content": "...",
    ...
  }
}
```

### 更新邮件状态

**PATCH** `/api/admin/emails`

**请求体：**
```json
{
  "email_id": "...",
  "updates": {
    "is_read": true,
    "is_archived": true,
    "category": "support"
  }
}
```

---

## 🎯 功能特性

### 自动分类

系统会根据邮件主题和内容自动分类：
- **Support** - 包含 "support", "help", "assistance"
- **Inquiry** - 包含 "inquiry", "question", "ask"
- **Complaint** - 包含 "complaint", "refund", "cancel"
- **Booking** - 包含 "booking", "reservation", "tour"
- **Other** - 其他邮件

### 邮件状态

- **未读** - 蓝色圆点标记
- **已读** - 灰色背景
- **已归档** - 从列表中移除

### 附件支持

- 自动保存附件信息
- 显示附件文件名、类型、大小

---

## 🆘 故障排除

### Q: 邮件没有保存到数据库？

**A:**
1. 检查 webhook 是否配置正确
2. 检查 Resend Dashboard → Webhooks 中的日志
3. 检查服务器日志是否有错误
4. 确认数据库表已创建

### Q: Webhook 没有被触发？

**A:**
1. 确认 MX 记录已正确配置
2. 确认邮件确实发送到了 `support@atockorea.com`
3. 检查 Resend Dashboard 中的邮件日志
4. 确认 webhook URL 可访问

### Q: 无法访问管理界面？

**A:**
1. 确认已使用管理员账户登录
2. 检查用户角色是否为 `admin`
3. 确认 RLS 策略已正确配置

---

## ✅ 完成检查清单

- [ ] 数据库表已创建
- [ ] Resend Webhook 已配置
- [ ] MX 记录已添加（Enable Receiving）
- [ ] 环境变量已配置
- [ ] 测试邮件已发送
- [ ] 邮件已保存到数据库
- [ ] 管理界面可以访问
- [ ] 邮件列表正常显示

---

祝你使用愉快！🎉

