# Vercel 环境变量配置详细指南

## 📋 重要说明

**Vercel 不需要 `.env` 文件！**

环境变量通过 **Vercel Dashboard 的 Web 界面**配置，不会出现在代码中。

---

## 🎯 为什么 `.env.local` 不会同步到 Vercel？

### `.gitignore` 的作用

`.env.local` 文件在 `.gitignore` 中，意味着：
- ✅ 不会提交到 Git
- ✅ 不会推送到 GitHub
- ✅ 不会同步到 Vercel

**这是正确的安全做法！** 环境变量不应该出现在代码仓库中。

---

## ✅ 正确的配置方式

### Vercel 环境变量配置（通过 Web 界面）

**不需要创建文件！** 直接在 Vercel Dashboard 中配置。

---

## 🔧 详细配置步骤

### 步骤 1：登录 Vercel Dashboard

1. **访问 Vercel**
   - 访问 https://vercel.com
   - 登录你的账户

2. **选择项目**
   - 在 Dashboard 中找到你的项目（atockorea）
   - 点击项目名称进入项目页面

---

### 步骤 2：进入环境变量设置

1. **进入 Settings**
   - 在项目页面顶部，点击 **"Settings"** 标签

2. **进入 Environment Variables**
   - 左侧菜单 → **Environment Variables**
   - 或直接访问：`https://vercel.com/[你的用户名]/[项目名]/settings/environment-variables`

---

### 步骤 3：添加环境变量

#### 3.1 添加第一个环境变量（示例：RESEND_API_KEY）

1. **点击 "Add New" 按钮**
   - 在 Environment Variables 页面，找到 **"Add New"** 或 **"Add"** 按钮
   - 点击按钮

2. **填写环境变量信息**
   - **Key（键名）：** 输入 `RESEND_API_KEY`
   - **Value（值）：** 输入你的 API Key（例如：`re_你的完整API_Key`）
   - **Environment（环境）：** 选择以下选项：
     - ✅ **Production** - 生产环境（必须）
     - ✅ **Preview** - 预览环境（推荐）
     - ✅ **Development** - 开发环境（可选）

3. **保存**
   - 点击 **"Save"** 按钮
   - 环境变量会立即保存

#### 3.2 添加其他环境变量

重复步骤 3.1，添加所有必需的环境变量：

| Key | Value | Environment |
|-----|-------|-------------|
| `RESEND_API_KEY` | `re_你的API_Key` | Production, Preview, Development |
| `RESEND_WEBHOOK_SECRET` | `你的Webhook_Secret` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `你的Service_Role_Key` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_URL` | `你的Supabase项目URL` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `你的Supabase匿名Key` | Production, Preview, Development |

---

### 步骤 4：重新部署项目

**⚠️ 重要：** 添加或修改环境变量后，需要重新部署项目才能生效。

#### 方法 1：自动重新部署

1. **触发新的部署**
   - 推送代码到 Git：`git push origin main`
   - Vercel 会自动检测并部署
   - 新部署会使用最新的环境变量

#### 方法 2：手动重新部署

1. **进入 Deployments 页面**
   - 项目页面 → **Deployments** 标签

2. **重新部署**
   - 找到最新的部署
   - 点击 **"..."** 菜单
   - 选择 **"Redeploy"**
   - 确认重新部署

---

## 📊 环境变量列表示例

### 在 Vercel Dashboard 中应该看到：

```
Environment Variables

┌─────────────────────────┬──────────────────────────┬──────────────┐
│ Key                     │ Value                    │ Environment  │
├─────────────────────────┼──────────────────────────┼──────────────┤
│ RESEND_API_KEY          │ re_9mQwKszm... (隐藏)     │ Production   │
│                         │                          │ Preview      │
│                         │                          │ Development  │
├─────────────────────────┼──────────────────────────┼──────────────┤
│ RESEND_WEBHOOK_SECRET   │ ... (隐藏)               │ Production   │
│                         │                          │ Preview      │
│                         │                          │ Development  │
├─────────────────────────┼──────────────────────────┼──────────────┤
│ SUPABASE_SERVICE_ROLE_  │ ... (隐藏)               │ Production   │
│ KEY                     │                          │ Preview      │
│                         │                          │ Development  │
└─────────────────────────┴──────────────────────────┴──────────────┘
```

---

## 🔍 如何验证环境变量已配置

### 方法 1：在 Vercel Dashboard 中查看

1. **进入 Environment Variables 页面**
2. **查看变量列表**
   - 应该能看到所有已添加的变量
   - Value 会显示为 `...`（隐藏保护）

### 方法 2：在部署日志中查看（不推荐，可能泄露敏感信息）

1. **进入 Deployments 页面**
2. **点击最新的部署**
3. **查看 Build Logs**
   - 环境变量会在构建时加载
   - ⚠️ 注意：不要在生产日志中暴露敏感信息

### 方法 3：通过功能测试

1. **测试发送验证码**
   - 访问 `/signup`
   - 输入邮箱，发送验证码
   - 如果成功，说明 `RESEND_API_KEY` 配置正确

2. **测试邮件接收**
   - 发送邮件到 `support@atockorea.com`
   - 在 `/admin/emails` 查看
   - 如果收到，说明 webhook 和环境变量配置正确

---

## ⚠️ 重要提示

### 1. 环境变量不会出现在代码中

- ✅ 环境变量存储在 Vercel 的云端
- ✅ 不会出现在 Git 仓库中
- ✅ 不会出现在部署的代码中
- ✅ 这是安全的做法

### 2. 环境变量是隐藏的

- 在 Vercel Dashboard 中，Value 会显示为 `...`
- 这是为了保护敏感信息
- 可以点击 **"Show"** 查看（需要权限）

### 3. 修改环境变量需要重新部署

- 添加或修改环境变量后
- 必须重新部署项目
- 新部署才会使用新的环境变量

---

## 📋 完整配置清单

### 必需的环境变量

在 Vercel Dashboard → Settings → Environment Variables 中添加：

- [ ] `RESEND_API_KEY` = `re_你的API_Key`
- [ ] `RESEND_WEBHOOK_SECRET` = `你的Webhook_Secret`（可选）
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = `你的Service_Role_Key`
- [ ] `NEXT_PUBLIC_SUPABASE_URL` = `你的Supabase项目URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `你的Supabase匿名Key`

### 每个变量的 Environment 设置

- [ ] 所有变量都选择了 **Production**（必须）
- [ ] 所有变量都选择了 **Preview**（推荐）
- [ ] 所有变量都选择了 **Development**（可选）

### 部署

- [ ] 已重新部署项目
- [ ] 部署成功
- [ ] 功能测试正常

---

## 🎯 快速操作流程

```
Vercel Dashboard
  ↓
选择项目（atockorea）
  ↓
Settings 标签
  ↓
Environment Variables（左侧菜单）
  ↓
点击 "Add New"
  ↓
填写：
  Key: RESEND_API_KEY
  Value: re_你的API_Key
  Environment: Production, Preview, Development（全选）
  ↓
点击 "Save"
  ↓
重复添加其他变量
  ↓
重新部署项目
  ↓
完成！
```

---

## 🆘 常见问题

### Q: 为什么 `.env.local` 不会同步到 Vercel？

**A:**
- `.env.local` 在 `.gitignore` 中，不会提交到 Git
- Vercel 从 Git 仓库部署，所以不会包含 `.env.local`
- **这是正确的安全做法！**

### Q: 如何在 Vercel 中配置环境变量？

**A:**
- 通过 Vercel Dashboard 的 Web 界面配置
- 不需要创建文件
- Settings → Environment Variables → Add New

### Q: 环境变量会出现在代码中吗？

**A:**
- ❌ 不会！环境变量存储在 Vercel 云端
- ❌ 不会出现在 Git 仓库
- ❌ 不会出现在部署的代码中
- ✅ 这是安全的

### Q: 如何确认环境变量已配置？

**A:**
1. 在 Vercel Dashboard → Environment Variables 中查看
2. 通过功能测试验证
3. 查看部署日志（注意不要暴露敏感信息）

---

## ✅ 总结

**关键点：**

1. ✅ **Vercel 不需要 `.env` 文件**
2. ✅ **通过 Vercel Dashboard Web 界面配置**
3. ✅ **环境变量存储在 Vercel 云端**
4. ✅ **不会出现在代码中（安全）**
5. ✅ **配置后需要重新部署**

**步骤：**
1. Vercel Dashboard → 项目 → Settings → Environment Variables
2. 点击 "Add New"
3. 填写 Key、Value、Environment
4. 保存
5. 重复添加所有变量
6. 重新部署项目

祝你配置顺利！🎉

