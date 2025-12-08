# Facebook OAuth 配置详细步骤

## 📋 概述

配置 Facebook OAuth 登录，让用户可以使用 Facebook 账户登录 AtoCKorea。

---

## 🔧 步骤1：创建 Facebook 应用

### 1.1 访问 Facebook Developers

1. **打开 Facebook Developers**
   - [https://developers.facebook.com/](https://developers.facebook.com/)

2. **登录**
   - 使用你的 Facebook 账户登录

3. **进入 My Apps**
   - 点击右上角的 **"My Apps"**
   - 或访问：https://developers.facebook.com/apps/

### 1.2 创建新应用

1. **点击 "Create App"**
   - 在 My Apps 页面右上角

2. **选择应用类型**
   - 选择 **"Consumer"**（消费者）
   - 点击 **"Next"**

3. **填写应用信息**
   - App Display Name: `AtoCKorea`
   - App Contact Email: 你的邮箱
   - 点击 **"Create App"**

---

## 🔧 步骤2：添加 Facebook Login 产品

### 2.1 添加产品

1. **在应用 Dashboard 中**
   - 找到 **"Add a Product"** 或 **"제품 추가"**

2. **找到 Facebook Login**
   - 在产品列表中，找到 **"Facebook Login"**
   - 点击 **"Set Up"** 或 **"설정"**

3. **选择平台**
   - 选择 **"Web"**（网页）
   - 点击 **"Next"**

---

## 🔧 步骤3：配置 Facebook Login

### 3.1 基本设置

1. **进入 Facebook Login 设置**
   - 左侧菜单 → **Products** → **Facebook Login** → **Settings**

2. **配置 Valid OAuth Redirect URIs**
   - 找到 **"Valid OAuth Redirect URIs"** 或 **"유효한 OAuth 리디렉션 URI"**
   - 点击 **"Add URI"** 或 **"URI 추가"**
   - 添加以下 URL：
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
     ```
   - 点击 **"Save Changes"** 或 **"변경사항 저장"**

### 3.2 获取 App ID 和 App Secret

1. **进入基本设置**
   - 左侧菜单 → **Settings** → **Basic**

2. **查看应用信息**
   - **App ID**: 显示在页面顶部
   - **App Secret**: 点击 **"Show"** 按钮显示
   - ⚠️ **重要：** 立即复制 App Secret，它只显示一次！

---

## 🔧 步骤4：在 Supabase 中配置

### 4.1 进入 Facebook 配置页面

1. **Supabase Dashboard**
   - 左侧菜单 → **Authentication** → **Providers**

2. **找到 Facebook**
   - 在提供商列表中，找到 **Facebook**
   - 点击启用开关

### 4.2 填写配置信息

1. **Client ID (for OAuth)**
   - 填写：你的 **Facebook App ID**
   - 格式：数字（如：`1234567890123456`）

2. **Client Secret (for OAuth)**
   - 填写：你的 **Facebook App Secret**
   - 格式：字符串（如：`abcdef1234567890abcdef1234567890`）
   - 点击眼睛图标可以显示/隐藏

3. **Callback URL**
   - 已自动填充：
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
     ```
   - 确保这个 URL 已在 Facebook 的 "Valid OAuth Redirect URIs" 中添加

### 4.3 保存配置

1. **检查所有字段**
   - ✅ Enable Sign in with Facebook: 已启用
   - ✅ Client ID: 已填写
   - ✅ Client Secret: 已填写
   - ✅ Callback URL: 已自动填充

2. **点击 "Save"**
   - 配置保存成功

---

## ✅ 验证配置

### 检查清单

- [ ] Facebook 应用已创建
- [ ] Facebook Login 产品已添加
- [ ] Valid OAuth Redirect URI 已添加
- [ ] App ID 已复制
- [ ] App Secret 已复制
- [ ] Supabase 中已填写 App ID
- [ ] Supabase 中已填写 App Secret
- [ ] 已点击 "Save" 保存配置

### 测试登录

1. **访问登录页面**
   - `http://localhost:3000/signin`

2. **点击 "Facebook" 按钮**
   - 应该跳转到 Facebook 授权页面

3. **完成授权**
   - 选择 Facebook 账户
   - 点击 "Continue" 或 "계속"

4. **验证结果**
   - 应该自动返回应用
   - 自动创建用户账户
   - 自动跳转到 `/mypage`

---

## 🆘 常见问题

### Q: 找不到 "Add a Product"？

**A:**
- 确保你在应用 Dashboard 中
- 左侧菜单 → **Products** → **Add Product**

### Q: App Secret 忘记了？

**A:**
1. Settings → Basic
2. 找到 App Secret
3. 点击 "Show" 显示
4. 或点击 "Reset" 重置（会生成新的）

### Q: Redirect URI 不匹配？

**A:**
确保两个地方的 URL 完全一致：
- Facebook: `https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback`
- Supabase: `https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback`

**注意：**
- 必须完全一致（包括协议 https）
- 不能有多余的斜杠
- 不能有空格

### Q: 应用状态是 "Development"？

**A:**
- Development 模式只能用于测试用户
- 如果要公开使用，需要：
  1. 完成应用审核
  2. 切换到 "Live" 模式

---

## 📝 快速参考

### Facebook Developers 配置

```
应用类型: Consumer
应用名称: AtoCKorea
产品: Facebook Login (Web)
Valid OAuth Redirect URIs:
  https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
```

### Supabase 配置

```
Enable Sign in with Facebook: ✅ ON
Client ID: [你的 Facebook App ID]
Client Secret: [你的 Facebook App Secret]
Callback URL: https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
```

---

## 🎯 下一步

配置完成后：

1. ✅ 测试 Facebook 登录
2. ✅ 配置其他平台（Kakao、LINE）
3. ✅ 验证用户自动创建

祝你配置顺利！🎉

