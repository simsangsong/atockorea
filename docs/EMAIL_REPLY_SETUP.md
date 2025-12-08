# 邮件回复功能设置指南

## 📋 概述

现在系统已经支持在后台管理界面中查看和回复收到的邮件。

---

## ✅ 已完成的功能

### 1. 数据表 ✅
- `received_emails` - 存储收到的邮件
- `email_replies` - 存储发送的回复记录

### 2. API 路由 ✅
- `GET /api/admin/emails` - 获取邮件列表（支持筛选、搜索、分页）
- `GET /api/admin/emails/[id]` - 获取单封邮件详情
- `PATCH /api/admin/emails` - 更新邮件状态（标记已读、归档）
- `POST /api/admin/emails/[id]/reply` - 发送邮件回复

### 3. 前端界面 ✅
- `/admin/emails` - 邮件管理页面
  - 邮件列表（支持筛选和搜索）
  - 邮件详情查看
  - 回复邮件功能
  - 归档功能

---

## 🔧 安装依赖

### 步骤 1：安装 Resend 包

```bash
npm install resend
```

**注意：** 如果已经安装过，可以跳过此步骤。

---

## 📝 环境变量检查

确保以下环境变量已配置：

### 本地开发 (`.env.local`)
```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Vercel 生产环境
确保在 Vercel Dashboard 中已配置：
- `RESEND_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**详细步骤：** 查看 `docs/VERCEL_ENV_VARIABLES_SETUP.md`

---

## 🚀 使用方法

### 1. 访问邮件管理页面

1. **登录管理员账户**
   - 访问 `/signin`
   - 使用管理员账户登录

2. **进入邮件管理**
   - 访问 `/admin/emails`
   - 或从管理员后台导航进入

### 2. 查看邮件

- **邮件列表**：左侧显示所有收到的邮件
- **筛选功能**：
  - 按分类筛选（Support, Inquiry, Complaint, Booking, Other）
  - 按已读/未读状态筛选
  - 搜索邮件（主题、发件人、内容）
- **邮件详情**：点击邮件查看完整内容

### 3. 回复邮件

1. **选择邮件**
   - 在邮件列表中点击要回复的邮件

2. **点击回复按钮**
   - 在邮件详情右上角点击 "Reply" 按钮

3. **填写回复内容**
   - **Subject（主题）**：自动添加 "Re:" 前缀
   - **Message（内容）**：输入回复内容

4. **发送回复**
   - 点击 "Send Reply" 按钮
   - 系统会自动：
     - 发送邮件到原发件人
     - 在邮件中包含原始邮件内容（引用）
     - 保存回复记录到数据库

---

## 📧 邮件格式

### 回复邮件包含：
- **发件人**：`AtoCKorea <support@atockorea.com>`
- **收件人**：原始邮件的发件人
- **主题**：自动添加 "Re:" 前缀
- **内容**：
  - 你的回复内容
  - 原始邮件引用（包含发件人、日期、主题、内容）

---

## 🔍 功能特性

### 邮件分类
系统会自动根据邮件主题和内容分类：
- **Support** - 支持请求
- **Inquiry** - 咨询
- **Complaint** - 投诉
- **Booking** - 预订相关
- **Other** - 其他

### 邮件状态
- **已读/未读**：点击邮件自动标记为已读
- **归档**：可以归档不需要的邮件

### 回复记录
- 所有回复都会记录在 `email_replies` 表中
- 可以追踪每封邮件的回复历史

---

## 🛠️ 故障排除

### 问题 1：无法发送回复

**可能原因：**
- Resend API Key 未配置
- 环境变量未正确设置

**解决方法：**
1. 检查 `.env.local` 或 Vercel 环境变量
2. 确认 `RESEND_API_KEY` 已正确设置
3. 重启开发服务器（本地）或重新部署（生产）

### 问题 2：回复按钮不显示

**可能原因：**
- 未登录管理员账户
- 权限不足

**解决方法：**
1. 确认已使用管理员账户登录
2. 检查 `user_profiles` 表中 `role` 字段是否为 `'admin'`

### 问题 3：邮件发送失败

**可能原因：**
- Resend 域名未验证
- DNS 记录未正确配置

**解决方法：**
1. 检查 Resend Dashboard 中的域名状态
2. 确认所有 DNS 记录已正确配置
3. 查看 `docs/RESEND_DOMAIN_SETUP.md`

---

## 📚 相关文档

- `docs/DATABASE_TABLES_CHECK.md` - 数据表检查报告
- `docs/RESEND_DOMAIN_SETUP.md` - Resend 域名设置
- `docs/RESEND_EMAIL_RECEIVING_SETUP.md` - 邮件接收设置
- `docs/VERCEL_ENV_VARIABLES_SETUP.md` - Vercel 环境变量设置

---

## ✅ 下一步

1. **测试邮件接收**
   - 发送一封测试邮件到 `support@atockorea.com`
   - 确认邮件出现在 `/admin/emails` 页面

2. **测试邮件回复**
   - 选择一封邮件
   - 点击 "Reply" 按钮
   - 填写并发送回复
   - 确认收件人收到回复邮件

3. **配置邮件模板**（可选）
   - 可以自定义回复邮件的 HTML 模板
   - 修改 `app/api/admin/emails/[id]/reply/route.ts` 中的模板

---

## 🎉 完成！

邮件回复功能已完全配置完成，可以开始使用了！

