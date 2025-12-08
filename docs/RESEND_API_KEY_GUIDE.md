# Resend API Key 获取指南

## 📋 概述

在 Resend Dashboard 中创建和获取 API Key 的详细步骤。

---

## 🔧 步骤 1：进入 API Keys 页面

1. **登录 Resend Dashboard**
   - 访问 https://resend.com
   - 登录你的账户

2. **进入 API Keys 页面**
   - 左侧菜单 → **API Keys**
   - 或直接访问：https://resend.com/api-keys

---

## 🔧 步骤 2：创建新的 API Key

### 方法 A：创建新 API Key

1. **点击 "Create API Key" 按钮**
   - 在 API Keys 页面右上角
   - 或页面中间的 "Create API Key" 按钮

2. **填写 API Key 信息**
   - **Name（名称）：** 输入一个描述性名称
     - 例如：`AtoCKorea Production`
     - 或：`AtoCKorea Email Service`
   
   - **Permission（权限）：** 选择权限
     - ✅ **Sending access** - 发送邮件权限（推荐）
     - ⚠️ **Full access** - 完整权限（如果只需要发送邮件，选择 Sending access 即可）

   - **Domain（域名）：** 选择域名
     - ✅ **All domains** - 所有域名（推荐）
     - 或选择特定域名：`atockorea.com`

3. **创建 API Key**
   - 点击 **"Create"** 或 **"Add"** 按钮

4. **复制 API Key**
   - ⚠️ **重要：** API Key 只显示一次！
   - 立即复制完整的 API Key
   - 格式：`re_xxxxxxxxxxxxx`
   - 保存到安全的地方

---

## 🔧 步骤 3：查看现有 API Key

### 如果已有 API Key（如 "Onboarding"）：

1. **点击 API Key 名称**
   - 在 API Keys 列表中，点击 "Onboarding" 或其他 API Key

2. **查看 Token 部分**
   - 在 API Key 详情页面，找到 **"TOKEN"** 部分
   - 如果显示 `re_9mQwKszm...`（被截断），可能需要：
     - 点击 **"Show"** 或 **"Reveal"** 按钮显示完整 Key
     - 或点击复制图标复制完整 Key

3. **如果无法查看完整 Key**
   - API Key 可能只显示一次
   - 需要创建新的 API Key

---

## 🔧 步骤 4：使用 API Key

### 在本地 `.env.local` 中：

```env
RESEND_API_KEY=re_你的完整API_Key
```

### 在 Vercel 中：

1. **Vercel Dashboard**
   - 你的项目 → **Settings** → **Environment Variables**

2. **添加环境变量**
   - **Key:** `RESEND_API_KEY`
   - **Value:** `re_你的完整API_Key`
   - **Environment:** Production, Preview, Development（全选）

3. **保存**
   - 点击 **"Save"**

4. **重新部署**
   - 环境变量更新后，需要重新部署项目
   - Vercel Dashboard → Deployments → 点击 "..." → Redeploy

---

## ⚠️ 重要提示

### 1. API Key 只显示一次

- ⚠️ **创建后立即复制！**
- 如果关闭页面，无法再次查看完整 Key
- 只能看到部分 Key（如 `re_9mQwKszm...`）

### 2. 如果忘记或丢失 API Key

**解决方案：**
1. 创建新的 API Key
2. 更新环境变量（本地 + Vercel）
3. 删除旧的 API Key（可选，为了安全）

### 3. API Key 安全

- ✅ 不要提交到 Git（已在 `.gitignore` 中）
- ✅ 不要在代码中硬编码
- ✅ 只在环境变量中使用
- ✅ 定期轮换 API Key（可选）

---

## 📋 API Key 信息说明

从你的截图可以看到：

- **Name:** Onboarding
- **Permission:** Sending access ✅（正确）
- **Domain:** All domains ✅（正确）
- **Token:** `re_9mQwKszm...`（被截断）

### 如何获取完整 Key：

1. **如果显示 "Show" 或 "Reveal" 按钮**
   - 点击显示完整 Key
   - 复制完整 Key

2. **如果没有显示按钮**
   - 需要创建新的 API Key
   - 旧 Key 可能无法再次查看

---

## ✅ 完成检查清单

- [ ] 已进入 Resend Dashboard → API Keys
- [ ] 已创建新的 API Key（或找到现有 Key）
- [ ] 已复制完整的 API Key（格式：`re_xxxxxxxxxxxxx`）
- [ ] 已在本地 `.env.local` 中配置
- [ ] 已在 Vercel Environment Variables 中配置
- [ ] 已重新部署 Vercel 项目（如果更新了环境变量）
- [ ] 已测试发送验证码邮件（确认 API Key 有效）

---

## 🎯 快速操作流程

```
Resend Dashboard
  ↓
左侧菜单 → API Keys
  ↓
点击 "Create API Key"
  ↓
填写信息：
  Name: AtoCKorea Production
  Permission: Sending access
  Domain: All domains
  ↓
点击 "Create"
  ↓
立即复制完整 API Key
  ↓
配置到环境变量（本地 + Vercel）
  ↓
完成！
```

---

## 🆘 常见问题

### Q: 看不到完整的 API Key？

**A:**
- API Key 只显示一次
- 如果已关闭页面，需要创建新的 API Key
- 点击 API Key 名称，查看是否有 "Show" 按钮

### Q: 可以使用现有的 "Onboarding" API Key 吗？

**A:**
- 可以，如果能看到完整 Key
- 如果只能看到部分 Key（如 `re_9mQwKszm...`），建议创建新的
- 确保 Permission 是 "Sending access" 或 "Full access"

### Q: 创建多个 API Key 可以吗？

**A:**
- 可以，建议为不同用途创建不同的 Key
- 例如：
  - `AtoCKorea Production` - 生产环境
  - `AtoCKorea Development` - 开发环境

### Q: API Key 格式是什么？

**A:**
- 格式：`re_` + 随机字符串
- 例如：`re_9mQwKszmAbCdEfGhIjKlMnOpQrStUvWxYz`
- 长度：通常 30-40 个字符

---

祝你配置顺利！🎉

