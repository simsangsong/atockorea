# OAuth 第三方登录设置指南

## 📋 支持的提供商

- ✅ Google
- ✅ Facebook
- ✅ Kakao
- ✅ LINE

---

## 🔧 设置步骤

### 步骤1：在 Supabase 中启用 OAuth

1. **登录 Supabase Dashboard**
   - 访问 [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - 选择你的项目

2. **进入 Authentication 设置**
   - 左侧菜单 → **Authentication**
   - 点击 **Providers** 标签

3. **启用各个提供商**
   - 找到 Google、Facebook、Kakao、LINE
   - 逐个启用并配置

---

## 🔑 各平台配置

### 1. Google OAuth

#### 1.1 创建 Google OAuth 应用

1. **访问 Google Cloud Console**
   - [https://console.cloud.google.com/](https://console.cloud.google.com/)

2. **创建项目**
   - 点击 "Select a project" → "New Project"
   - 项目名称：`AtoCKorea`
   - 点击 "Create"

3. **启用 Google+ API**
   - APIs & Services → Library
   - 搜索 "Google+ API"
   - 点击 "Enable"

4. **创建 OAuth 2.0 凭证**
   - APIs & Services → Credentials
   - 点击 "Create Credentials" → "OAuth client ID"
   - Application type: **Web application**
   - Name: `AtoCKorea Web Client`
   - Authorized redirect URIs:
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
     http://localhost:3000/auth/callback
     ```
     **注意：** 添加两个 URL（生产环境和开发环境）
   - 点击 "Create"
   - **复制 Client ID 和 Client Secret**

#### 1.2 在 Supabase 中配置

1. **Supabase Dashboard** → Authentication → Providers
2. **启用 Google**
3. **填写信息：**
   - Client ID (for OAuth): 你的 Google Client ID
   - Client Secret (for OAuth): 你的 Google Client Secret
4. **点击 "Save"**

---

### 2. Facebook OAuth

#### 2.1 创建 Facebook App

1. **访问 Facebook Developers**
   - [https://developers.facebook.com/](https://developers.facebook.com/)

2. **创建应用**
   - 点击 "My Apps" → "Create App"
   - 选择 "Consumer" 类型
   - 填写应用信息
   - 点击 "Create App"

3. **添加 Facebook Login 产品**
   - 在应用 Dashboard 中
   - 点击 "Add Product"
   - 找到 "Facebook Login" → "Set Up"

4. **配置 OAuth 设置**
   - Facebook Login → Settings
   - Valid OAuth Redirect URIs:
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
     http://localhost:3000/auth/callback
     ```
     **注意：** 添加两个 URL（生产环境和开发环境）
   - 点击 "Save Changes"

5. **获取 App ID 和 App Secret**
   - Settings → Basic
   - **复制 App ID 和 App Secret**

#### 2.2 在 Supabase 中配置

1. **Supabase Dashboard** → Authentication → Providers
2. **启用 Facebook**
3. **填写信息：**
   - Client ID (for OAuth): 你的 Facebook App ID
   - Client Secret (for OAuth): 你的 Facebook App Secret
4. **点击 "Save"**

---

### 3. Kakao OAuth

#### 3.1 创建 Kakao 应用

1. **访问 Kakao Developers**
   - [https://developers.kakao.com/](https://developers.kakao.com/)

2. **创建应用**
   - 登录后，点击 "내 애플리케이션" (My Applications)
   - 点击 "애플리케이션 추가하기" (Add Application)
   - 填写应用信息
   - 点击 "저장" (Save)

3. **配置 Redirect URI**
   - 应用设置 → 플랫폼 (Platform)
   - Web 플랫폼 등록 (Register Web Platform)
   - 사이트 도메인 (Site Domain):
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co
     ```
   - Redirect URI:
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
     http://localhost:3000/auth/callback
     ```
     **注意：** 添加两个 URL（生产环境和开发环境）
   - 点击 "저장" (Save)

4. **获取 REST API Key**
   - 앱 키 (App Keys) → REST API 키 (REST API Key)
   - **复制 REST API Key**

5. **创建 Client Secret（可选但推荐）**
   - 제품 설정 (Product Settings) → 카카오 로그인 (Kakao Login)
   - 활성화 (Activate)
   - Client Secret 생성 (Generate Client Secret)

#### 3.2 在 Supabase 中配置

1. **Supabase Dashboard** → Authentication → Providers
2. **启用 Kakao**
3. **填写信息：**
   - Client ID (for OAuth): 你的 Kakao REST API Key
   - Client Secret (for OAuth): 你的 Kakao Client Secret（如果有）
4. **点击 "Save"**

---

### 4. LINE OAuth

#### 4.1 创建 LINE 应用

1. **访问 LINE Developers**
   - [https://developers.line.biz/](https://developers.line.biz/)

2. **创建 Provider**
   - 登录后，点击 "Create"
   - 填写 Provider 信息
   - 点击 "Create"

3. **创建 Channel**
   - 在 Provider 中，点击 "Create a channel"
   - 选择 "LINE Login"
   - 填写 Channel 信息
   - 点击 "Create"

4. **配置 Callback URL**
   - Channel Settings → Callback URL
   - 添加：
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
     http://localhost:3000/auth/callback
     ```
     **注意：** 添加两个 URL（生产环境和开发环境）
   - 点击 "Update"

5. **获取 Channel ID 和 Channel Secret**
   - Channel Settings → Basic settings
   - **复制 Channel ID 和 Channel Secret**

#### 4.2 在 Supabase 中配置

1. **Supabase Dashboard** → Authentication → Providers
2. **启用 LINE**
3. **填写信息：**
   - Client ID (for OAuth): 你的 LINE Channel ID
   - Client Secret (for OAuth): 你的 LINE Channel Secret
4. **点击 "Save"**

---

## 💻 前端实现

### ✅ 已完成

登录和注册页面已经实现了 OAuth 登录功能：

- ✅ `app/signin/page.tsx` - 登录页面，支持 OAuth
- ✅ `app/signup/page.tsx` - 注册页面，支持 OAuth
- ✅ `app/auth/callback/page.tsx` - OAuth 回调处理页面

### 功能说明

1. **点击社交登录按钮**
   - 跳转到对应平台的授权页面
   - 用户授权后返回应用

2. **自动创建用户**
   - OAuth 登录成功后自动创建用户账户
   - 自动创建用户资料（user_profiles）

3. **自动登录**
   - 登录成功后自动跳转到 `/mypage`

---

## 🔐 安全注意事项

1. **不要暴露 Client Secret**
   - Client Secret 只在 Supabase Dashboard 中配置
   - 不要提交到代码中

2. **Redirect URI 必须匹配**
   - 确保各平台的 Redirect URI 与 Supabase 的完全一致
   - 格式：`https://[your-project].supabase.co/auth/v1/callback`

3. **测试环境配置**
   - 开发环境可以使用 `http://localhost:3000` 进行测试
   - 生产环境必须使用 HTTPS

---

## ✅ 验证步骤

### 1. 检查 Supabase 配置

- [ ] Google 已启用并配置
- [ ] Facebook 已启用并配置
- [ ] Kakao 已启用并配置
- [ ] LINE 已启用并配置

### 2. 测试登录

1. 访问登录页面
2. 点击各个社交登录按钮
3. 应该跳转到对应平台的授权页面
4. 授权后应该跳转回应用

---

## 🆘 常见问题

### Q: Redirect URI 不匹配？

**A:** 确保：
- 各平台的 Redirect URI 与 Supabase 的完全一致
- 使用 HTTPS（生产环境）
- 没有多余的斜杠或空格

### Q: OAuth 登录后没有创建用户？

**A:** 检查：
- Supabase 中 OAuth 提供商是否已正确配置
- 用户是否授权了必要的权限
- Supabase 日志中是否有错误

### Q: 如何获取用户的邮箱等信息？

**A:** 在 Supabase Dashboard → Authentication → Providers 中：
- 确保启用了 "Email" 权限
- 某些平台（如 Kakao）可能需要额外配置

---

## 📚 相关文档

- [Supabase OAuth 文档](https://supabase.com/docs/guides/auth/social-login)
- [Google OAuth 文档](https://developers.google.com/identity/protocols/oauth2)
- [Facebook OAuth 文档](https://developers.facebook.com/docs/facebook-login)
- [Kakao OAuth 文档](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)
- [LINE OAuth 文档](https://developers.line.biz/en/docs/line-login/)

