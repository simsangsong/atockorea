# Vercel 环境变量配置检查清单

## 📋 基于你的 Vercel Dashboard 截图

从你的截图可以看到，大部分环境变量已经配置。以下是检查和建议：

---

## ✅ 已配置的环境变量

### 1. Supabase 变量 ✅

- ✅ `NEXT_PUBLIC_SUPABASE_URL` = `hyvbwmijqpahnoduyv.supabase.co`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGci...`（已配置）
- ✅ `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGci...`（已配置）

**状态：** ✅ 已正确配置

---

### 2. Resend 变量 ✅

- ✅ `RESEND_API_KEY` = `re_ZoEsbtSP_PShzeGLLov7aaQ8mrJUDpR3x`

**状态：** ✅ 已配置

**建议添加（如果 Resend 提供）：**
- ⚠️ `RESEND_WEBHOOK_SECRET` - 如果 Resend Webhook 提供了 Secret，建议添加

---

### 3. LINE OAuth 变量 ✅

- ✅ `LINE_CHANNEL_ID` = `2008645877`
- ✅ `LINE_CHANNEL_SECRET` = `e932aa18a9c056c6bf04cc504bf42bff`

**状态：** ✅ 已配置

---

## ⚠️ 需要修改的环境变量

### 1. NEXT_PUBLIC_APP_URL ⚠️ **重要！**

**当前值：** `http://localhost:3000`

**问题：**
- ❌ 这是本地开发地址
- ❌ 生产环境应该使用生产 URL
- ❌ 会影响 webhook 和 OAuth 回调地址

**应该改为：**
- ✅ `https://atockorea.com`（生产环境，推荐）
- 或 `https://atockorea.vercel.app`（Vercel 默认域名）

**修改步骤：**
1. 在 Vercel Dashboard → Environment Variables
2. 找到 `NEXT_PUBLIC_APP_URL`
3. 点击编辑图标（铅笔图标 ✏️）
4. 将 Value 改为：`https://atockorea.com`
5. **确认 Environment 选择了 Production**（必须！）
6. 点击 **"Save"**
7. **重新部署项目**（重要！）

**影响：**
- Webhook URL 会使用这个值
- OAuth 回调地址会使用这个值
- 如果使用 `localhost`，生产环境功能会失败

---

## 📋 完整环境变量清单

### 必需变量（检查是否都已配置）

- [x] `NEXT_PUBLIC_SUPABASE_URL` ✅ 已配置
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅ 已配置
- [x] `SUPABASE_SERVICE_ROLE_KEY` ✅ 已配置
- [x] `RESEND_API_KEY` ✅ 已配置
- [x] `LINE_CHANNEL_ID` ✅ 已配置
- [x] `LINE_CHANNEL_SECRET` ✅ 已配置
- [ ] `NEXT_PUBLIC_APP_URL` ⚠️ **需要修改**（改为生产环境 URL）
- [ ] `RESEND_WEBHOOK_SECRET` ⚠️ **可选**（如果 Resend 提供）

---

## 🔧 需要做的操作

### 1. 修改 NEXT_PUBLIC_APP_URL

**步骤：**
1. Vercel Dashboard → 项目 → Settings → Environment Variables
2. 找到 `NEXT_PUBLIC_APP_URL`
3. 点击编辑图标（铅笔图标）
4. 修改 Value：
   - 从：`http://localhost:3000`
   - 改为：`https://atockorea.com`
5. 确认 Environment 选择了 **Production**（必须）
6. 点击 **"Save"**

### 2. 添加 RESEND_WEBHOOK_SECRET（可选）

**如果 Resend Webhook 提供了 Secret：**
1. 在 Resend Dashboard → Webhooks 中获取 Secret
2. Vercel Dashboard → Environment Variables
3. 点击 **"Add New"**
4. 填写：
   - **Key:** `RESEND_WEBHOOK_SECRET`
   - **Value:** `你的Webhook_Secret`
   - **Environment:** Production, Preview, Development（全选）
5. 点击 **"Save"**

### 3. 重新部署项目

**修改环境变量后必须重新部署：**
1. Vercel Dashboard → Deployments
2. 点击最新部署的 **"..."** 菜单
3. 选择 **"Redeploy"**
4. 确认重新部署

---

## ✅ 完成检查清单

### 环境变量配置

- [x] Supabase 变量已配置 ✅
- [x] Resend API Key 已配置 ✅
- [x] LINE OAuth 变量已配置 ✅
- [ ] `NEXT_PUBLIC_APP_URL` 已修改为生产环境 URL ⚠️
- [ ] `RESEND_WEBHOOK_SECRET` 已添加（如果使用）⚠️

### 部署

- [ ] 环境变量修改后已重新部署
- [ ] 部署成功
- [ ] 功能测试正常

---

## 🎯 快速修复步骤

```
Vercel Dashboard
  ↓
项目 → Settings → Environment Variables
  ↓
找到 NEXT_PUBLIC_APP_URL
  ↓
点击编辑图标（铅笔）
  ↓
修改 Value: https://atockorea.com
  ↓
确认 Environment: Production（必须）
  ↓
Save
  ↓
重新部署项目
  ↓
完成！
```

---

## ⚠️ 警告说明

### 关于警告图标

你看到的一些警告图标是正常的：

1. **`NEXT_PUBLIC_SUPABASE_ANON_KEY` 的警告**
   - 这是正常的，因为 `NEXT_PUBLIC_` 前缀的变量会暴露到浏览器
   - Supabase Anon Key 是设计为可以公开的（有 RLS 保护）

2. **`NEXT_PUBLIC_APP_URL` 的警告**
   - 当前值是 `localhost`，这是问题所在
   - 修改为生产环境 URL 后，警告可能会消失或改变

---

## 🎉 总结

**已配置：** ✅ 大部分环境变量都已正确配置

**需要修改：**
- ⚠️ `NEXT_PUBLIC_APP_URL` - 改为 `https://atockorea.com`

**可选添加：**
- ⚠️ `RESEND_WEBHOOK_SECRET` - 如果 Resend 提供

修改后记得重新部署项目！🎉

