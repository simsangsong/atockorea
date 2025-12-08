# Google API Key 限制设置指南

## 📍 在哪里设置 Application Restrictions

### 步骤 1：进入 Google Cloud Console

1. **访问 Google Cloud Console**
   - 网址：https://console.cloud.google.com/
   - 使用你的 Google 账户登录

2. **选择项目**
   - 点击顶部项目选择器
   - 选择你的项目（例如：`AtoCKorea`）

---

### 步骤 2：进入 Credentials（凭证）页面

**方法 A：通过左侧菜单**
1. 左侧菜单 → **APIs & Services**（API 및 서비스）
2. 点击 **Credentials**（자격 증명）

**方法 B：直接访问**
- 直接访问：https://console.cloud.google.com/apis/credentials

**方法 C：通过搜索**
1. 点击顶部搜索框
2. 输入：`credentials` 或 `API key`
3. 选择 "Credentials"

---

### 步骤 3：找到你的 API Key

1. **查看 API Keys 列表**
   - 在 Credentials 页面，你会看到 "API keys" 部分
   - 显示所有已创建的 API Key

2. **找到要编辑的 Key**
   - 查看 Key 名称或创建日期
   - 找到你用于 OAuth 或 Maps 的 API Key

3. **点击 API Key 名称**
   - 点击 Key 名称进入编辑页面
   - 或者点击右侧的 **"Edit"**（编辑）图标（铅笔图标）

---

### 步骤 4：设置 Application Restrictions

进入 API Key 编辑页面后，你会看到两个主要部分：

#### 4.1 Application restrictions（应用程序限制）

**位置：** 在编辑页面的上半部分

**选项：**

1. **None（无限制）** ⚠️ 不推荐
   - 任何网站都可以使用这个 Key
   - 安全性最低

2. **HTTP referrers (web sites)（HTTP 引用网站）** ✅ 推荐用于 Web 应用
   - 限制只有特定网站可以使用
   - 适合 Next.js 应用

3. **IP addresses (web servers, cron jobs, etc.)（IP 地址）**
   - 限制只有特定 IP 地址可以使用
   - 适合服务器端 API 调用

4. **Android apps（Android 应用）**
   - 限制只有特定 Android 应用可以使用

5. **iOS apps（iOS 应用）**
   - 限制只有特定 iOS 应用可以使用

---

### 步骤 5：配置 HTTP referrers（推荐）

如果选择 **"HTTP referrers (web sites)"**：

1. **点击 "HTTP referrers (web sites)"** 单选按钮

2. **点击 "Add an item"（添加项目）**

3. **添加网站限制**

   添加以下网站（每行一个）：

   ```
   http://localhost:3000/*
   https://atockorea.com/*
   https://*.vercel.app/*
   ```

   **说明：**
   - `http://localhost:3000/*` - 本地开发环境
   - `https://atockorea.com/*` - 生产环境
   - `https://*.vercel.app/*` - Vercel 预览环境

4. **通配符说明**
   - `*` 表示匹配任意字符
   - `/*` 表示匹配该域名下的所有路径
   - `*.vercel.app` 表示匹配所有 Vercel 子域名

5. **保存更改**
   - 点击页面底部的 **"Save"**（保存）按钮
   - 等待几秒钟让更改生效

---

### 步骤 6：设置 API Restrictions（API 限制）

**位置：** 在 Application restrictions 下方

**选项：**

1. **Don't restrict key（不限制 Key）** ⚠️ 不推荐
   - Key 可以访问项目中的所有 API
   - 安全性较低

2. **Restrict key（限制 Key）** ✅ 推荐
   - 只允许访问指定的 API
   - 更安全

**如果选择 "Restrict key"：**

1. **点击 "Restrict key"** 单选按钮

2. **在 "Select APIs"（选择 API）下拉菜单中**

   勾选需要的 API：

   **OAuth 相关：**
   - ✅ Google+ API（如果使用）
   - ✅ Identity Toolkit API（如果使用）

   **Maps 相关：**
   - ✅ Maps JavaScript API
   - ✅ Places API
   - ✅ Geocoding API
   - ✅ Directions API（如果使用）

3. **保存更改**
   - 点击 **"Save"** 按钮

---

## 📸 可视化步骤

```
Google Cloud Console
  └── 顶部项目选择器
      └── 选择你的项目
          └── 左侧菜单
              └── APIs & Services
                  └── Credentials
                      └── API keys 列表
                          └── 点击你的 API Key 名称
                              └── 编辑页面
                                  ├── Application restrictions
                                  │   └── 选择 "HTTP referrers (web sites)"
                                  │       └── 添加网站：
                                  │           ├── http://localhost:3000/*
                                  │           ├── https://atockorea.com/*
                                  │           └── https://*.vercel.app/*
                                  │
                                  └── API restrictions
                                      └── 选择 "Restrict key"
                                          └── 勾选需要的 API
                                              └── Save
```

---

## 🔒 安全最佳实践

### ✅ 推荐配置

1. **Application restrictions**
   - ✅ 选择 "HTTP referrers (web sites)"
   - ✅ 只添加你的域名

2. **API restrictions**
   - ✅ 选择 "Restrict key"
   - ✅ 只勾选需要的 API

### ⚠️ 注意事项

1. **不要选择 "None"**
   - 这会允许任何人使用你的 API Key
   - 可能导致费用超支

2. **定期检查使用情况**
   - 在 Google Cloud Console 中查看 API 使用量
   - 设置使用量警报

3. **使用不同的 Key**
   - 开发和生产环境可以使用不同的 Key
   - 或者使用同一个 Key 但正确设置限制

---

## 🐛 常见问题

### Q1: 找不到 Credentials 页面？

**A:** 
- 确保你在项目内部（不是组织级别）
- 尝试使用搜索功能：顶部搜索框输入 "credentials"
- 直接访问：https://console.cloud.google.com/apis/credentials

### Q2: 添加网站后还是显示错误？

**A:**
- 等待 5-10 分钟让更改生效
- 检查网站格式是否正确（包含 `http://` 或 `https://`）
- 确认通配符使用正确（`/*` 在末尾）

### Q3: 本地开发无法使用？

**A:**
- 确认已添加 `http://localhost:3000/*`
- 检查端口号是否正确
- 尝试添加 `http://localhost:*`（匹配所有端口）

### Q4: Vercel 预览环境无法使用？

**A:**
- 确认已添加 `https://*.vercel.app/*`
- 或者添加具体的预览 URL（例如：`https://atockorea-xxx.vercel.app/*`）

---

## 📝 完整配置示例

### 示例 1：开发和生产使用同一个 Key

**Application restrictions:**
```
http://localhost:3000/*
https://atockorea.com/*
https://*.vercel.app/*
```

**API restrictions:**
- Maps JavaScript API
- Places API
- Geocoding API
- Identity Toolkit API

### 示例 2：只用于生产环境

**Application restrictions:**
```
https://atockorea.com/*
```

**API restrictions:**
- Maps JavaScript API
- Places API
- Geocoding API

---

## ✅ 验证设置

### 1. 检查限制是否生效

1. 保存更改后，等待 5-10 分钟
2. 访问你的网站
3. 打开浏览器开发者工具（F12）
4. 查看 Console 标签
5. 确认没有 API Key 限制相关的错误

### 2. 测试不同环境

- ✅ 本地开发（localhost:3000）
- ✅ 生产环境（atockorea.com）
- ✅ Vercel 预览（*.vercel.app）

---

## 📚 相关文档

- `docs/GOOGLE_MAPS_API_SETUP.md` - Maps API 完整设置
- `docs/GOOGLE_MAPS_ADD_TO_EXISTING_PROJECT.md` - 在现有项目中添加 Maps API
- `docs/GOOGLE_CLOUD_OAUTH_STEPS.md` - OAuth 设置指南

---

## 🎯 快速参考

**设置位置：**
```
Google Cloud Console
  → APIs & Services
    → Credentials
      → 点击你的 API Key
        → Application restrictions（应用程序限制）
        → API restrictions（API 限制）
```

**推荐设置：**
- Application restrictions: HTTP referrers
- 添加的网站: `http://localhost:3000/*`, `https://atockorea.com/*`, `https://*.vercel.app/*`
- API restrictions: Restrict key
- 勾选的 API: 只勾选需要的 API

---

**完成！** 现在你知道在哪里设置 Application Restrictions 了。🔒

