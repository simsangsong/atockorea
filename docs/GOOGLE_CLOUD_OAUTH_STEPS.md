# Google Cloud Console - 创建 OAuth 凭证步骤

## 🎯 从首页导航到 OAuth 设置

### 步骤1：进入 APIs & Services

1. **在左侧菜单中查找**
   - 找到 **"APIs & Services"**（API 및 서비스）
   - 点击展开

2. **或者使用搜索**
   - 在顶部搜索框输入：`credentials` 或 `OAuth`
   - 选择 "Credentials"（자격 증명）

### 步骤2：进入 Credentials 页面

1. **点击 "Credentials"**
   - APIs & Services → **Credentials**（자격 증명）

2. **你会看到：**
   - "Create Credentials" 按钮
   - 现有的凭证列表（如果有）

### 步骤3：配置 OAuth Consent Screen（首次需要）

如果这是第一次创建 OAuth 凭证，需要先配置 OAuth consent screen：

1. **点击 "OAuth consent screen"**（OAuth 동의 화면）
   - 在左侧菜单或 Credentials 页面顶部

2. **选择 User Type**
   - **External** - 选择这个（个人项目或测试）
   - Internal - 仅限 Google Workspace 组织

3. **填写应用信息**
   - App name: `AtoCKorea`
   - User support email: 你的邮箱
   - Developer contact information: 你的邮箱
   - 点击 **"Save and Continue"**

4. **Scopes（作用域）**
   - 保持默认设置
   - 点击 **"Save and Continue"**

5. **Test users（测试用户）**
   - 可以跳过（如果应用还在测试阶段）
   - 点击 **"Save and Continue"**

6. **完成**
   - 点击 **"Back to Dashboard"**

### 步骤4：创建 OAuth Client ID

1. **回到 Credentials 页面**
   - APIs & Services → Credentials

2. **点击 "Create Credentials"**
   - 选择 **"OAuth client ID"**

3. **选择应用类型**
   - Application type: **Web application**
   - Name: `AtoCKorea Web Client`

4. **添加 Authorized redirect URIs**
   - 点击 **"Add URI"**
   - 输入：
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
     ```
   - 点击 **"Create"**

5. **复制凭证**
   - 会显示一个弹窗
   - **Client ID**: 复制这个
   - **Client Secret**: 复制这个（只显示一次！）
   - 点击 **"OK"**

---

## 📍 快速导航路径

### 方法1：通过左侧菜单

```
Google Cloud Console
  └── APIs & Services (API 및 서비스)
      └── Credentials (자격 증명)
          └── Create Credentials
              └── OAuth client ID
```

### 方法2：通过搜索

1. 顶部搜索框输入：`OAuth client`
2. 选择 "OAuth client ID"
3. 直接进入创建页面

---

## 🎯 关键选择

### Application Type（应用类型）

选择：**Web application** ✅

**不要选择：**
- ❌ Desktop app
- ❌ iOS
- ❌ Android
- ❌ Chrome App
- ❌ TV and Limited Input devices

### Authorized redirect URIs

**必须添加：**
```
https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
```

**格式要求：**
- ✅ 必须以 `https://` 开头
- ✅ 必须完全匹配 Supabase 的 Callback URL
- ✅ 不能有多余的斜杠或空格

---

## ✅ 完成后的操作

1. **复制 Client ID**
   - 格式：`数字-字符串.apps.googleusercontent.com`

2. **复制 Client Secret**
   - 格式：`GOCSPX-字符串`
   - ⚠️ 只显示一次，立即复制！

3. **回到 Supabase**
   - 粘贴到 Supabase 的 Google OAuth 配置页面
   - 保存配置

---

## 🆘 如果找不到

### 找不到 "APIs & Services"？

**方法1：使用顶部菜单**
- 点击左上角的三条横线（☰）
- 在菜单中找到 "APIs & Services"

**方法2：使用搜索**
- 顶部搜索框输入：`credentials`
- 选择 "Credentials"

**方法3：直接访问**
- 访问：`https://console.cloud.google.com/apis/credentials`

---

## 📝 快速检查清单

- [ ] 已进入 APIs & Services → Credentials
- [ ] 已配置 OAuth consent screen（首次需要）
- [ ] 已点击 "Create Credentials" → "OAuth client ID"
- [ ] 已选择 "Web application"
- [ ] 已添加 Redirect URI
- [ ] 已复制 Client ID 和 Client Secret
- [ ] 已在 Supabase 中填写并保存

---

## 🎯 下一步

获取凭证后：
1. 回到 Supabase Dashboard
2. 填写 Client ID 和 Client Secret
3. 保存配置
4. 测试 Google 登录

祝你配置顺利！🎉

