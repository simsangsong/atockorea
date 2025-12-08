# Kakao OAuth 配置详细步骤

## 📋 概述

配置 Kakao OAuth 登录，让用户可以使用 Kakao 账户登录 AtoCKorea。

---

## 🔧 步骤1：访问 Kakao Developers

### 1.1 登录 Kakao Developers

1. **访问 Kakao Developers**
   - [https://developers.kakao.com/](https://developers.kakao.com/)

2. **登录**
   - 使用你的 Kakao 账户登录
   - 如果没有账户，先注册

3. **进入应用管理**
   - 登录后，点击 **"내 애플리케이션"** (My Applications)

---

## 🔧 步骤2：创建应用

### 2.1 添加新应用

1. **点击 "애플리케이션 추가하기"** (Add Application)
   - 在应用列表页面右上角

2. **填写应用信息**
   - 앱 이름 (App Name): `AtoCKorea`
   - 사업자명 (Business Name): 你的名字或公司名
   - 点击 **"저장"** (Save)

---

## 🔧 步骤3：配置平台设置

### 3.1 注册 Web 平台

1. **进入平台设置**
   - 在应用 Dashboard 中
   - 左侧菜单 → **앱 설정** (App Settings) → **플랫폼** (Platform)

2. **添加 Web 平台**
   - 找到 **"Web 플랫폼 등록"** (Register Web Platform)
   - 点击 **"Web 플랫폼 추가"** (Add Web Platform)

3. **配置站点域名**
   - 사이트 도메인 (Site Domain):
     ```
     cghyvbwmijqpahnoduyv.supabase.co
     ```
   - 点击 **"저장"** (Save)

### 3.2 配置 Redirect URI

1. **进入 카카오 로그인 (Kakao Login) 设置**
   - 左侧菜单 → **제품 설정** (Product Settings) → **카카오 로그인** (Kakao Login)
   - ⚠️ **注意：** 不是 "고급" (Advanced) 页面，是 "카카오 로그인" 的主设置页面

2. **找到 Redirect URI 设置**
   - 在 카카오 로그인 设置页面中
   - 找到 **"Redirect URI"** 或 **"리디렉션 URI"** 部分
   - 如果看不到，可能需要先启用 카카오 로그인

3. **启用 카카오 로그인**（如果未启用）
   - 在 카카오 로그인 设置页面顶部
   - 点击 **"활성화 설정"** (Activate) 或 **"활성화"** (Enable)

4. **配置 Redirect URI**
   - 找到 **"Redirect URI"** 输入框
   - 添加：
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
     ```
   - 点击 **"저장"** (Save) 或 **"등록"** (Register)

**⚠️ 重要提示：**
- Redirect URI 设置在 **"카카오 로그인"** 主页面，不是 "고급" (Advanced) 页面
- "고급" 页面是用于高级功能（如 Logout Redirect URI），不是基本 OAuth 配置

---

## 🔧 步骤4：获取 REST API Key

### 4.1 查看 앱 키 (App Keys)

1. **进入 앱 설정** (App Settings)
   - 左侧菜单 → **앱 설정** → **앱 키** (App Keys)

2. **复制 REST API 키**
   - **REST API 키**: 显示在页面中
   - 格式：字符串（如：`abcdef1234567890abcdef1234567890`）
   - ⚠️ **重要：** 复制这个 Key，稍后会用到

### 4.2 创建 Client Secret（可选但推荐）

1. **进入 카카오 로그인** (Kakao Login) 设置
   - 左侧菜单 → **제품 설정** → **카카오 로그인** → **보안** (Security)

2. **生成 Client Secret**
   - 找到 **"Client Secret"**
   - 点击 **"생성"** (Generate)
   - ⚠️ **重要：** 立即复制 Client Secret，它只显示一次！

---

## 🔧 步骤5：在 Supabase 中配置

### 5.1 进入 Kakao 配置页面

1. **Supabase Dashboard**
   - 左侧菜单 → **Authentication** → **Providers**

2. **找到 Kakao**
   - 在提供商列表中，找到 **Kakao**
   - 点击启用开关

### 5.2 填写配置信息

1. **Client ID (for OAuth)**
   - 填写：你的 **Kakao REST API Key**
   - 格式：字符串

2. **Client Secret (for OAuth)**
   - 填写：你的 **Kakao Client Secret**（如果有）
   - 如果没有创建 Client Secret，可以留空
   - 点击眼睛图标可以显示/隐藏

3. **Callback URL**
   - 已自动填充：
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
     ```
   - 确保这个 URL 已在 Kakao 的 Redirect URI 中添加

### 5.3 保存配置

1. **检查所有字段**
   - ✅ Enable Sign in with Kakao: 已启用
   - ✅ Client ID: 已填写（REST API Key）
   - ✅ Client Secret: 已填写（如果有）
   - ✅ Callback URL: 已自动填充

2. **点击 "Save"**
   - 配置保存成功

---

## ✅ 验证配置

### 检查清单

- [ ] Kakao 应用已创建
- [ ] Web 平台已注册
- [ ] Redirect URI 已添加
- [ ] REST API Key 已复制
- [ ] Client Secret 已创建（可选）
- [ ] Supabase 中已填写 REST API Key
- [ ] Supabase 中已填写 Client Secret（如果有）
- [ ] 已点击 "Save" 保存配置

### 测试登录

1. **访问登录页面**
   - `http://localhost:3000/signin`

2. **点击 "Kakao" 按钮**
   - 应该跳转到 Kakao 授权页面

3. **完成授权**
   - 选择 Kakao 账户
   - 点击 "동의하고 계속하기" (Agree and Continue)

4. **验证结果**
   - 应该自动返回应用
   - 自动创建用户账户
   - 自动跳转到 `/mypage`

---

## 🆘 常见问题

### Q: 找不到 "내 애플리케이션"？

**A:**
- 确保已登录 Kakao Developers
- 访问：https://developers.kakao.com/console/app

### Q: REST API Key 在哪里？

**A:**
- 앱 설정 (App Settings) → 앱 키 (App Keys)
- 页面顶部会显示 REST API 키

### Q: Client Secret 是必需的吗？

**A:**
- 不是必需的，但推荐创建
- 可以提高安全性
- 如果没有，Supabase 中 Client Secret 可以留空

### Q: Redirect URI 不匹配？

**A:**
确保两个地方的 URL 完全一致：
- Kakao: `https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback`
- Supabase: `https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback`

**注意：**
- 必须完全一致（包括协议 https）
- 不能有多余的斜杠
- 不能有空格

### Q: 如何获取用户邮箱？

**A:**
1. 进入 카카오 로그인 (Kakao Login) → 동의항목 (Consent Items)
2. 启用 "이메일" (Email) 权限
3. 用户授权时会请求邮箱权限

---

## 📝 快速参考

### Kakao Developers 配置

```
应用名称: AtoCKorea
平台: Web
사이트 도메인: cghyvbwmijqpahnoduyv.supabase.co
Redirect URI:
  https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
```

### Supabase 配置

```
Enable Sign in with Kakao: ✅ ON
Client ID: [你的 Kakao REST API Key]
Client Secret: [你的 Kakao Client Secret] (可选)
Callback URL: https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
```

---

## 🎯 下一步

配置完成后：

1. ✅ 测试 Kakao 登录
2. ✅ 配置 LINE OAuth
3. ✅ 验证所有 OAuth 登录功能

祝你配置顺利！🎉

