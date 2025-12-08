# 在现有 Google Cloud 项目中添加 Maps API

## ✅ 完全可以！

你可以在**同一个 Google Cloud 项目**中同时使用：
- ✅ Google OAuth（用于登录）
- ✅ Google Maps API（用于地图功能）

这样更便于管理，而且不需要创建多个项目。

---

## 🚀 快速步骤

### 步骤 1：进入现有项目

1. **访问 Google Cloud Console**
   - 网址：https://console.cloud.google.com/
   - 登录你的 Google 账户

2. **选择现有项目**
   - 点击顶部项目选择器
   - 选择你之前用于 Google OAuth 的项目（例如：`AtoCKorea` 或你创建的项目名称）

---

### 步骤 2：启用 Maps API

1. **进入 API Library**
   - 左侧菜单 → **APIs & Services** → **Library**
   - 或直接访问：https://console.cloud.google.com/apis/library

2. **搜索并启用 Maps JavaScript API**
   - 在搜索框中输入：`Maps JavaScript API`
   - 点击进入详情页
   - 点击 **"Enable"** 按钮

3. **启用 Places API**
   - 搜索：`Places API`
   - 点击 **"Enable"** 按钮

4. **启用 Geocoding API**
   - 搜索：`Geocoding API`
   - 点击 **"Enable"** 按钮

---

### 步骤 3：配置 API Key（两种方案）

#### 方案 A：使用现有的 API Key（推荐）

如果你之前已经创建了 API Key，可以直接使用它：

1. **进入 Credentials**
   - 左侧菜单 → **APIs & Services** → **Credentials**
   - 或访问：https://console.cloud.google.com/apis/credentials

2. **编辑现有 API Key**
   - 找到你之前创建的 API Key（用于 OAuth 的那个）
   - 点击 API Key 名称进入编辑页面

3. **更新 API 限制**
   - 在 **API restrictions** 部分
   - 选择 **"Restrict key"**
   - 勾选以下 API：
     - ✅ **Maps JavaScript API**（新增）
     - ✅ **Places API**（新增）
     - ✅ **Geocoding API**（新增）
     - ✅ **Google+ API**（如果之前有，保留）
     - ✅ **Identity Toolkit API**（如果之前有，保留）
     - ✅ 其他 OAuth 相关的 API（保留）

4. **更新网站限制**（如果之前设置了）
   - 在 **Application restrictions** 部分
   - 确认已添加：
     - `http://localhost:3000/*`
     - `https://atockorea.com/*`
     - `https://*.vercel.app/*`

5. **保存更改**
   - 点击 **"Save"** 按钮

#### 方案 B：创建新的 API Key（可选）

如果你想为 Maps API 创建单独的 Key：

1. **创建新 API Key**
   - 点击 **"+ CREATE CREDENTIALS"**
   - 选择 **"API key"**

2. **限制 API Key**
   - 点击刚创建的 API Key 进行编辑
   - **Application restrictions**：
     - 选择 **"HTTP referrers (web sites)"**
     - 添加：
       - `http://localhost:3000/*`
       - `https://atockorea.com/*`
       - `https://*.vercel.app/*`
   - **API restrictions**：
     - 选择 **"Restrict key"**
     - 只勾选 Maps 相关的 API：
       - Maps JavaScript API
       - Places API
       - Geocoding API

3. **复制新 API Key**
   - 复制生成的 API Key

---

### 步骤 4：更新环境变量

#### 如果使用方案 A（同一个 Key）

**不需要更改**，继续使用现有的 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 环境变量，值就是你的 OAuth API Key。

#### 如果使用方案 B（新 Key）

**本地开发** (`.env.local`):
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=新的Maps_API_Key
```

**Vercel 生产环境**:
1. Vercel Dashboard → Settings → Environment Variables
2. 更新 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 的值
3. 重新部署

---

## 📋 已启用的 API 清单

在同一个项目中，你现在应该有：

### OAuth 相关（之前已启用）
- ✅ Google+ API（或 Identity Toolkit API）
- ✅ 其他 OAuth 相关 API

### Maps 相关（新启用）
- ✅ Maps JavaScript API
- ✅ Places API
- ✅ Geocoding API

---

## 💰 费用说明

### 免费额度
- **OAuth API**：通常免费
- **Maps JavaScript API**：每月 $200 免费额度
- **Places API**：每月 $200 免费额度
- **Geocoding API**：每月 $200 免费额度

**所有 API 的免费额度是共享的**，都在同一个项目中计算。

---

## 🔒 安全建议

### 如果使用同一个 API Key

**优点**：
- ✅ 管理简单
- ✅ 只需要维护一个 Key

**注意事项**：
- ⚠️ 确保正确设置 API 限制（只启用需要的 API）
- ⚠️ 确保正确设置网站限制（只允许你的域名使用）

### 如果使用不同的 API Key

**优点**：
- ✅ 更好的隔离
- ✅ 可以单独管理权限

**缺点**：
- ⚠️ 需要管理多个 Key

---

## ✅ 验证设置

### 1. 检查 API 是否已启用

1. 进入 **APIs & Services** → **Dashboard**
2. 查看已启用的 API 列表
3. 确认看到：
   - Maps JavaScript API
   - Places API
   - Geocoding API

### 2. 测试地图功能

1. 启动本地开发服务器：`npm run dev`
2. 访问商品详情页
3. 在预订侧边栏点击"在地图上标注"
4. 确认地图正常显示

### 3. 检查控制台错误

- 打开浏览器开发者工具（F12）
- 查看 Console 标签
- 确认没有 API Key 相关的错误

---

## 🐛 常见问题

### Q1: 使用同一个 API Key 安全吗？

**A:** 是的，只要正确设置了限制：
- API 限制：只启用需要的 API
- 网站限制：只允许你的域名使用

### Q2: 可以同时用于 OAuth 和 Maps 吗？

**A:** 完全可以！同一个 API Key 可以用于多个 API，只要在限制中勾选了相应的 API。

### Q3: 如果之前没有设置网站限制怎么办？

**A:** 
1. 进入 API Key 编辑页面
2. 在 **Application restrictions** 中选择 **"HTTP referrers"**
3. 添加你的域名
4. 保存

### Q4: 启用 API 后多久生效？

**A:** 通常立即生效，但可能需要等待几分钟。如果地图不显示，等待 5-10 分钟后重试。

---

## 📚 相关文档

- `docs/GOOGLE_MAPS_API_SETUP.md` - Maps API 完整设置指南
- `docs/GOOGLE_CLOUD_OAUTH_STEPS.md` - Google OAuth 设置指南

---

## ✅ 完成检查清单

- [ ] 进入现有 Google Cloud 项目
- [ ] 启用 Maps JavaScript API
- [ ] 启用 Places API
- [ ] 启用 Geocoding API
- [ ] 更新现有 API Key 的限制（或创建新 Key）
- [ ] 确认网站限制已设置
- [ ] 测试地图功能
- [ ] 确认没有控制台错误

---

**完成！** 现在你可以在同一个项目中使用 OAuth 和 Maps API 了。🎉

