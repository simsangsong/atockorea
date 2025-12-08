# Supabase Google OAuth 配置详细步骤

## 📋 配置页面说明

你在 Supabase Dashboard → Authentication → Providers → Google 配置页面。

---

## 🔧 配置步骤

### 步骤1：启用 Google Sign-in

✅ **Enable Sign in with Google** - 已启用（绿色开关）

这个开关已经打开了，很好！

---

### 步骤2：获取 Google OAuth 凭证

#### 2.1 访问 Google Cloud Console

1. **打开 Google Cloud Console**
   - [https://console.cloud.google.com/](https://console.cloud.google.com/)

2. **选择或创建项目**
   - 如果已有项目，选择它
   - 如果没有，点击 "Select a project" → "New Project"
   - 项目名称：`AtoCKorea`（或你喜欢的名称）
   - 点击 "Create"

#### 2.2 启用 Google+ API

1. **进入 API Library**
   - 左侧菜单 → **APIs & Services** → **Library**

2. **搜索并启用 API**
   - 搜索 "Google+ API" 或 "Google Identity"
   - 点击 "Google Identity" 或 "Google+ API"
   - 点击 **Enable**

#### 2.3 创建 OAuth 2.0 凭证

1. **进入 Credentials**
   - 左侧菜单 → **APIs & Services** → **Credentials**

2. **创建 OAuth Client ID**
   - 点击 **Create Credentials** → **OAuth client ID**
   - 如果提示配置 OAuth consent screen，先完成配置：
     - User Type: **External**（如果是个人项目）
     - App name: `AtoCKorea`
     - User support email: 你的邮箱
     - Developer contact: 你的邮箱
     - 点击 "Save and Continue"
     - Scopes: 保持默认，点击 "Save and Continue"
     - Test users: 可以跳过，点击 "Save and Continue"
     - 点击 "Back to Dashboard"

3. **创建 OAuth Client ID（继续）**
   - Application type: **Web application**
   - Name: `AtoCKorea Web Client`
   - **Authorized redirect URIs** - 添加以下 URL：
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
     ```
   - 点击 **Create**

4. **复制凭证**
   - 会显示一个弹窗，包含：
     - **Client ID**: `xxxxx.apps.googleusercontent.com`
     - **Client Secret**: `GOCSPX-xxxxx`
   - ⚠️ **重要：** 立即复制这两个值，Client Secret 只显示一次！

---

### 步骤3：在 Supabase 中填写配置

回到 Supabase 的 Google OAuth 配置页面：

#### 3.1 Client IDs

**填写：** 粘贴刚才复制的 **Client ID**

例如：
```
123456789-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com
```

**说明：**
- 这是 Google OAuth Client ID
- 格式：`数字-字符串.apps.googleusercontent.com`
- 如果有多个 Client ID，用逗号分隔

#### 3.2 Client Secret (for OAuth)

**填写：** 粘贴刚才复制的 **Client Secret**

例如：
```
GOCSPX-abcdefghijklmnopqrstuvwxyz123456
```

**说明：**
- 这是 Google OAuth Client Secret
- 格式：`GOCSPX-` 开头
- ⚠️ **保密！** 不要分享给他人
- 点击眼睛图标可以显示/隐藏

#### 3.3 Callback URL

**已自动填充：**
```
https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
```

**说明：**
- 这是 Supabase 自动生成的回调 URL
- 必须与 Google Cloud Console 中配置的 Redirect URI 完全一致
- 可以点击 "Copy" 按钮复制

**重要：** 确保这个 URL 已经在 Google Cloud Console 的 "Authorized redirect URIs" 中添加！

---

### 步骤4：其他设置（可选）

#### Skip nonce checks

**默认：关闭（推荐）**

**说明：**
- 如果开启，允许任何 nonce 的 ID token（安全性较低）
- 通常用于 iOS 等无法访问 nonce 的场景
- **建议保持关闭**

#### Allow users without an email

**默认：关闭（推荐）**

**说明：**
- 如果开启，允许没有邮箱的用户登录
- 大多数情况下，Google 用户都有邮箱
- **建议保持关闭**

---

### 步骤5：保存配置

1. **检查所有字段**
   - ✅ Enable Sign in with Google: 已启用
   - ✅ Client IDs: 已填写
   - ✅ Client Secret: 已填写
   - ✅ Callback URL: 已自动填充

2. **点击 "Save" 按钮**
   - 配置会保存到 Supabase

---

## ✅ 验证配置

### 检查清单

- [ ] Google Cloud Console 中已创建 OAuth Client ID
- [ ] Redirect URI 已添加到 Google Cloud Console
- [ ] Client ID 已填入 Supabase
- [ ] Client Secret 已填入 Supabase
- [ ] Callback URL 与 Google 中的 Redirect URI 一致
- [ ] 已点击 "Save" 保存配置

### 测试登录

1. **访问登录页面**
   - `http://localhost:3000/signin`

2. **点击 "Google" 按钮**
   - 应该跳转到 Google 授权页面

3. **完成授权**
   - 选择 Google 账户
   - 点击 "允许"

4. **验证结果**
   - 应该自动返回应用
   - 自动创建用户账户
   - 自动跳转到 `/mypage`

---

## 🆘 常见问题

### Q: Client Secret 忘记了怎么办？

**A:**
1. 回到 Google Cloud Console
2. APIs & Services → Credentials
3. 找到你的 OAuth Client ID
4. 点击编辑（铅笔图标）
5. 可以重置 Client Secret

### Q: Redirect URI 不匹配？

**A:**
确保两个地方的 URL 完全一致：
- Google Cloud Console: `https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback`
- Supabase Callback URL: `https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback`

**注意：**
- 必须完全一致（包括协议 https）
- 不能有多余的斜杠
- 不能有空格

### Q: 测试时显示错误？

**A:**
检查：
1. Google Cloud Console 中 OAuth consent screen 是否已配置
2. Redirect URI 是否已添加
3. Client ID 和 Secret 是否正确
4. Supabase 中是否已保存配置

### Q: 开发环境如何测试？

**A:**
- 使用相同的 Redirect URI（Supabase 的 URL）
- Supabase 会自动处理回调，然后重定向到你的应用
- 不需要为 localhost 单独配置

---

## 📝 快速参考

### Google Cloud Console 配置

```
项目: AtoCKorea
OAuth Client ID: Web application
Authorized redirect URIs:
  https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
```

### Supabase 配置

```
Enable Sign in with Google: ✅ ON
Client IDs: [你的 Google Client ID]
Client Secret: [你的 Google Client Secret]
Callback URL: https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
```

---

## 🎯 下一步

配置完成后：

1. ✅ 测试 Google 登录
2. ✅ 配置其他平台（Facebook、Kakao、LINE）
3. ✅ 验证用户自动创建

祝你使用愉快！🎉

