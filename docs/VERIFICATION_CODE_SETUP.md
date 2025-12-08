# 验证码系统设置指南

## 📋 概述

设置自定义验证码系统，替代 Supabase 默认的链接邮件验证。

---

## 🗄️ 数据库设置

### 步骤1：创建验证码表

在 Supabase SQL Editor 中执行 `docs/VERIFICATION_CODE_DATABASE.sql` 文件中的 SQL，或直接执行以下 SQL：

```sql
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
```

**详细 SQL 脚本：** 查看 `docs/VERIFICATION_CODE_DATABASE.sql`

---

## 📧 邮件服务配置

### 选项1：使用 Resend（推荐，已集成）

#### 1.1 注册 Resend

1. 访问 [https://resend.com](https://resend.com)
2. 注册账户
3. 获取 API Key

#### 1.2 配置发送者邮箱

1. 在 Resend Dashboard 中添加域名 `atockorea.com`
2. 验证域名（添加 DNS 记录）
3. 设置发送者邮箱：`support@atockorea.com`

#### 1.3 安装 Resend SDK

```bash
npm install resend
```

#### 1.4 配置环境变量

在 `.env.local` 中添加：

```env
RESEND_API_KEY=你的Resend_API_Key
```

**注意：** API 路由已集成 Resend，配置好 API Key 后即可使用。

---

### 选项2：使用 Supabase Edge Function

#### 2.1 创建 Edge Function

在 Supabase Dashboard 中创建 Edge Function 来发送邮件。

---

### 选项3：使用 SendGrid

#### 3.1 注册 SendGrid

1. 访问 [https://sendgrid.com](https://sendgrid.com)
2. 注册账户
3. 获取 API Key

#### 3.2 配置环境变量

```env
SENDGRID_API_KEY=你的SendGrid_API_Key
```

---

## 🔧 邮件模板

### 邮件内容

**Subject:** AtoCKorea Verification Code

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .code { background: #fff; border: 2px dashed #667eea; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; margin: 20px 0; border-radius: 8px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AtoCKorea</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>AtoCKorea sent you a verification code, please confirm:</p>
      <div class="code">{{CODE}}</div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>© 2024 AtoCKorea. All rights reserved.</p>
      <p>This email was sent from support@atockorea.com</p>
    </div>
  </div>
</body>
</html>
```

**Body (Plain Text):**
```
Hello,

AtoCKorea sent you a verification code, please confirm:

{{CODE}}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

© 2024 AtoCKorea. All rights reserved.
This email was sent from support@atockorea.com
```

---

## 📝 配置发送者邮箱

### Resend 配置

1. 在 Resend Dashboard 中添加域名 `atockorea.com`
2. 验证域名
3. 设置发送者邮箱：`support@atockorea.com`

### SendGrid 配置

1. 在 SendGrid Dashboard 中验证发送者邮箱
2. 设置发送者：`support@atockorea.com`

---

## ✅ 测试

### 1. 测试发送验证码

```bash
curl -X POST http://localhost:3000/api/auth/send-verification-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### 2. 测试验证验证码

```bash
curl -X POST http://localhost:3000/api/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"123456"}'
```

---

## 🎯 完成！

配置完成后，signup 页面将使用自定义验证码系统，而不是 Supabase 的链接邮件。

