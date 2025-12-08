# OAuth 第三方登录 - 快速开始

## 🎯 已完成的工作

✅ **前端代码已实现**
- 登录页面支持 OAuth
- 注册页面支持 OAuth
- OAuth 回调处理页面

✅ **支持的平台**
- Google
- Facebook
- Kakao
- LINE

---

## 📋 配置步骤（按顺序）

### 步骤1：在 Supabase 中启用 OAuth 提供商

1. **登录 Supabase Dashboard**
   - [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - 选择你的项目

2. **进入 Authentication → Providers**
   - 左侧菜单 → **Authentication**
   - 点击 **Providers** 标签

3. **启用各个提供商**
   - 找到 Google、Facebook、Kakao、LINE
   - 逐个启用（先不填 Client ID 和 Secret，稍后配置）

---

### 步骤2：获取各平台的 OAuth 凭证

#### 2.1 Google OAuth

1. **访问 Google Cloud Console**
   - [https://console.cloud.google.com/](https://console.cloud.google.com/)

2. **创建项目和应用**
   - 创建新项目或选择现有项目
   - APIs & Services → Credentials
   - Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Authorized redirect URIs:
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
     http://localhost:3000/auth/callback
     ```
   - 复制 **Client ID** 和 **Client Secret**

#### 2.2 Facebook OAuth

1. **访问 Facebook Developers**
   - [https://developers.facebook.com/](https://developers.facebook.com/)

2. **创建应用**
   - My Apps → Create App
   - 添加 "Facebook Login" 产品
   - Settings → Basic：复制 **App ID** 和 **App Secret**
   - Facebook Login → Settings：
     - Valid OAuth Redirect URIs:
       ```
       https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
       http://localhost:3000/auth/callback
       ```

#### 2.3 Kakao OAuth

1. **访问 Kakao Developers**
   - [https://developers.kakao.com/](https://developers.kakao.com/)

2. **创建应用**
   - 내 애플리케이션 → 애플리케이션 추가하기
   - 앱 키 → REST API 키（复制）
   - 플랫폼 → Web 플랫폼 등록
   - Redirect URI:
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
     http://localhost:3000/auth/callback
     ```

#### 2.4 LINE OAuth

1. **访问 LINE Developers**
   - [https://developers.line.biz/](https://developers.line.biz/)

2. **创建 Provider 和 Channel**
   - 创建 Provider
   - 创建 LINE Login Channel
   - Channel Settings → Callback URL:
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
     http://localhost:3000/auth/callback
     ```
   - 复制 **Channel ID** 和 **Channel Secret**

---

### 步骤3：在 Supabase 中配置凭证

1. **回到 Supabase Dashboard**
   - Authentication → Providers

2. **配置每个提供商**
   - **Google:**
     - Client ID: 你的 Google Client ID
     - Client Secret: 你的 Google Client Secret
   - **Facebook:**
     - Client ID: 你的 Facebook App ID
     - Client Secret: 你的 Facebook App Secret
   - **Kakao:**
     - Client ID: 你的 Kakao REST API Key
     - Client Secret: 你的 Kakao Client Secret（如果有）
   - **LINE:**
     - Client ID: 你的 LINE Channel ID
     - Client Secret: 你的 LINE Channel Secret

3. **保存配置**
   - 每个提供商配置后点击 "Save"

---

## ✅ 验证

### 测试步骤

1. **访问登录页面**
   - `http://localhost:3000/signin`

2. **点击社交登录按钮**
   - 应该跳转到对应平台的授权页面

3. **授权后**
   - 应该自动返回应用
   - 自动创建用户账户
   - 自动跳转到 `/mypage`

---

## 🔐 重要提示

### Redirect URI 格式

所有平台的 Redirect URI 必须完全匹配：

**Supabase 回调 URL：**
```
https://[your-project-id].supabase.co/auth/v1/callback
```

**应用回调 URL（开发环境）：**
```
http://localhost:3000/auth/callback
```

**应用回调 URL（生产环境）：**
```
https://atockorea.com/auth/callback
```

### 开发 vs 生产

- **开发环境：** 使用 `http://localhost:3000`
- **生产环境：** 使用 `https://atockorea.com`
- 两个环境都需要在各平台配置对应的 Redirect URI

---

## 🆘 常见问题

### Q: OAuth 登录后没有创建用户？

**A:** 
- 检查 Supabase 中 OAuth 提供商是否已正确配置
- 检查 Redirect URI 是否匹配
- 查看浏览器控制台是否有错误

### Q: 跳转后显示错误？

**A:**
- 检查各平台的 Redirect URI 配置
- 确保 Supabase 中已启用对应的 OAuth 提供商
- 检查 Client ID 和 Secret 是否正确

### Q: 如何测试？

**A:**
1. 确保 Supabase 中已配置 OAuth
2. 访问登录页面
3. 点击社交登录按钮
4. 完成授权
5. 应该自动返回并登录

---

## 📚 详细文档

- `docs/OAUTH_SETUP.md` - 完整的 OAuth 设置指南
- [Supabase OAuth 文档](https://supabase.com/docs/guides/auth/social-login)

---

## 🎯 下一步

配置完成后：
1. ✅ 测试各个 OAuth 登录
2. ✅ 验证用户自动创建
3. ✅ 检查用户资料是否正确

祝你使用愉快！🎉

