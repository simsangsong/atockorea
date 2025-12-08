# Resend 邮件接收系统 - Vercel 和环境变量配置指南

## 📋 概述

在 Vercel 部署邮件接收系统需要配置以下环境变量和设置。

**⚠️ 重要：** 本地环境变量（`.env.local`）和生产环境变量（Vercel）是分开的！必须配置两个地方。

**详细说明：** 查看 `docs/ENVIRONMENT_VARIABLES_EXPLAINED.md`

---

## 🔧 环境变量配置

### 必需的环境变量

#### 1. Resend API Key（发送邮件）

**变量名：** `RESEND_API_KEY`

**用途：** 用于发送验证码邮件等

**获取方式：**
1. 登录 Resend Dashboard
2. 进入 **API Keys** 页面（左侧菜单 → API Keys）
3. 点击 **"Create API Key"** 按钮
4. 填写信息：
   - **Name:** `AtoCKorea Production`（或自定义名称）
   - **Permission:** 选择 **"Sending access"**
   - **Domain:** 选择 **"All domains"** 或 `atockorea.com`
5. 点击 **"Create"** 或 **"Add"**
6. ⚠️ **重要：** 立即复制完整的 API Key（格式：`re_xxxxxxxxxxxxx`）
   - API Key 只显示一次！
   - 如果关闭页面，无法再次查看完整 Key

**详细步骤：** 查看 `docs/RESEND_API_KEY_GUIDE.md`

**在 Vercel 中配置：**
1. Vercel Dashboard → 你的项目 → **Settings** → **Environment Variables**
2. 添加：
   - **Key:** `RESEND_API_KEY`
   - **Value:** `re_你的API_Key`
   - **Environment:** Production, Preview, Development（全选）
3. 点击 **"Save"**

**在本地 `.env.local` 中配置：**
```env
RESEND_API_KEY=re_你的API_Key
```

---

#### 2. Resend Webhook Secret（可选，但推荐）

**变量名：** `RESEND_WEBHOOK_SECRET`

**用途：** 验证 webhook 请求的真实性，防止伪造请求

**获取方式：**
1. 在 Resend Dashboard → Webhooks
2. 创建或编辑 webhook
3. 查看 **"Webhook Secret"** 或 **"Signing Secret"**
4. 复制 Secret 值

**在 Vercel 中配置：**
1. Vercel Dashboard → 你的项目 → **Settings** → **Environment Variables**
2. 添加：
   - **Key:** `RESEND_WEBHOOK_SECRET`
   - **Value:** `你的Webhook_Secret`
   - **Environment:** Production, Preview, Development（全选）
3. 点击 **"Save"**

**在本地 `.env.local` 中配置：**
```env
RESEND_WEBHOOK_SECRET=你的Webhook_Secret
```

**⚠️ 注意：** 如果 Resend 没有提供 Webhook Secret，可以暂时不配置，但建议联系 Resend 支持获取。

---

#### 3. Supabase 环境变量（如果还没有）

**必需变量：**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase匿名Key
SUPABASE_SERVICE_ROLE_KEY=你的Supabase服务角色Key
```

**在 Vercel 中配置：**
- 确保这些变量已在 Vercel Environment Variables 中配置

---

#### 4. 应用 URL（用于 webhook）

**变量名：** `NEXT_PUBLIC_APP_URL` 或 `VERCEL_URL`

**用途：** Webhook URL 和回调地址

**在 Vercel 中：**
- Vercel 自动提供 `VERCEL_URL` 环境变量
- 如果需要自定义，可以添加 `NEXT_PUBLIC_APP_URL`

**在本地 `.env.local` 中配置：**
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**在 Vercel 中配置（如果需要）：**
```env
NEXT_PUBLIC_APP_URL=https://atockorea.com
```

---

## 📋 完整环境变量清单

### 本地开发（`.env.local`）

```env
# Resend
RESEND_API_KEY=re_你的API_Key
RESEND_WEBHOOK_SECRET=你的Webhook_Secret（可选）

# Supabase
NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase匿名Key
SUPABASE_SERVICE_ROLE_KEY=你的Supabase服务角色Key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Vercel 生产环境

在 Vercel Dashboard → Settings → Environment Variables 中添加：

| Key | Value | Environment |
|-----|-------|-------------|
| `RESEND_API_KEY` | `re_你的API_Key` | Production, Preview, Development |
| `RESEND_WEBHOOK_SECRET` | `你的Webhook_Secret` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_URL` | `你的Supabase项目URL` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `你的Supabase匿名Key` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `你的Supabase服务角色Key` | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL` | `https://atockorea.com` | Production |

---

## 🚀 Vercel 部署配置

### 步骤 1：确保代码已提交

```bash
git add .
git commit -m "Add email receiving system"
git push origin main
```

### 步骤 2：检查 Vercel 部署

1. **访问 Vercel Dashboard**
   - https://vercel.com/dashboard
   - 选择你的项目

2. **检查部署状态**
   - 确保最新部署成功
   - 查看部署日志，确认没有错误

3. **检查环境变量**
   - Settings → Environment Variables
   - 确认所有必需变量都已配置

### 步骤 3：验证 API 路由

1. **测试 Webhook 端点**
   - 访问：`https://atockorea.com/api/webhooks/resend`
   - 应该返回 JSON 响应（不是 404）

2. **检查 API 路由文件**
   - 确认 `app/api/webhooks/resend/route.ts` 已存在
   - 确认文件已提交到 Git

---

## 🔍 验证配置

### 1. 检查环境变量

**在 Vercel 中：**
1. Vercel Dashboard → 你的项目 → Settings → Environment Variables
2. 确认所有变量都已添加
3. 确认 Environment 选择正确（Production, Preview, Development）

**在本地：**
1. 检查 `.env.local` 文件
2. 确认所有变量都已配置
3. 重启开发服务器：`npm run dev`

### 2. 测试 Webhook 端点

**方法 1：直接访问**
```
https://atockorea.com/api/webhooks/resend
```

应该返回：
```json
{
  "message": "Resend webhook endpoint is active",
  "timestamp": "2024-..."
}
```

**方法 2：使用 curl**
```bash
curl https://atockorea.com/api/webhooks/resend
```

### 3. 测试邮件接收

1. **发送测试邮件**
   - 从任何邮箱发送邮件到 `support@atockorea.com`
   - 主题：`Test Email`

2. **检查 Resend Dashboard**
   - Resend Dashboard → Webhooks → 查看日志
   - 确认 webhook 被触发

3. **检查数据库**
   - Supabase Dashboard → Table Editor → `received_emails`
   - 查看是否有新邮件记录

4. **检查管理界面**
   - 访问 `https://atockorea.com/admin/emails`
   - 查看邮件列表

---

## ⚠️ 常见问题

### Q: Vercel 部署后 webhook 返回 404？

**A:**
1. 确认 `app/api/webhooks/resend/route.ts` 文件存在
2. 确认文件已提交到 Git
3. 确认 Vercel 已重新部署
4. 检查文件路径是否正确

### Q: Webhook 收到请求但无法保存到数据库？

**A:**
1. 检查 `SUPABASE_SERVICE_ROLE_KEY` 是否正确配置
2. 检查数据库表 `received_emails` 是否已创建
3. 查看 Vercel 函数日志（Vercel Dashboard → Deployments → 点击部署 → Functions）

### Q: 环境变量在本地可以，但在 Vercel 不行？

**A:**
1. 确认环境变量已在 Vercel Dashboard 中配置
2. 确认 Environment 选择正确（Production）
3. 重新部署项目（Vercel 会自动使用新环境变量）

### Q: 如何查看 Vercel 函数日志？

**A:**
1. Vercel Dashboard → 你的项目
2. 点击最新的部署
3. 查看 **"Functions"** 标签
4. 点击函数名称查看日志

---

## ✅ 完成检查清单

### 环境变量配置

- [ ] `RESEND_API_KEY` 已配置（本地 + Vercel）
- [ ] `RESEND_WEBHOOK_SECRET` 已配置（可选，但推荐）
- [ ] `NEXT_PUBLIC_SUPABASE_URL` 已配置
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 已配置
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 已配置
- [ ] `NEXT_PUBLIC_APP_URL` 已配置（Vercel 可选，使用 VERCEL_URL）

### Vercel 部署

- [ ] 代码已提交到 Git
- [ ] Vercel 部署成功
- [ ] 所有环境变量已在 Vercel 中配置
- [ ] Webhook 端点可以访问（`https://atockorea.com/api/webhooks/resend`）

### 功能验证

- [ ] 数据库表 `received_emails` 已创建
- [ ] Resend Webhook 已配置（URL: `https://atockorea.com/api/webhooks/resend`）
- [ ] 测试邮件已发送
- [ ] 邮件已保存到数据库
- [ ] 管理界面可以访问（`/admin/emails`）

---

## 🎯 快速配置步骤

### 1. 在 Vercel 中添加环境变量

```
Vercel Dashboard
  ↓
你的项目 → Settings
  ↓
Environment Variables
  ↓
Add New
  ↓
添加所有必需变量
  ↓
Save
```

### 2. 重新部署

```
Vercel Dashboard
  ↓
你的项目 → Deployments
  ↓
点击 "..." → Redeploy
```

### 3. 验证配置

```
访问: https://atockorea.com/api/webhooks/resend
  ↓
应该返回 JSON 响应
  ↓
配置 Resend Webhook
  ↓
测试邮件接收
```

---

祝你配置顺利！🎉

